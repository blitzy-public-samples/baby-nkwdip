/**
 * @fileoverview Enhanced authentication service implementing secure user authentication,
 * token management, and session handling with comprehensive security measures
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // ^3.1.2
import CryptoJS from 'crypto-js'; // ^4.1.1
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  UserRole,
  TokenValidation
} from '../types/user.types';

// Constants for authentication configuration
const TOKEN_REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes before expiry
const MAX_LOGIN_ATTEMPTS = 3;
const ATTEMPT_RESET_TIME_MS = 300000; // 5 minutes
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;
const AUTH_STORAGE_KEY = 'encrypted_auth_state';

/**
 * Enhanced authentication service implementing singleton pattern with security measures
 */
export class AuthService {
  private static instance: AuthService;
  private apiService: ApiService;
  private storageService: StorageService;
  private currentUser: User | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private failedAttempts: Map<string, number> = new Map();

  /**
   * Private constructor implementing singleton pattern
   */
  private constructor() {
    this.apiService = new ApiService(
      process.env.API_BASE_URL || '',
      process.env.API_KEY || ''
    );
    this.storageService = StorageService.getInstance();
    this.initializeAuthState();
  }

  /**
   * Gets singleton instance with thread-safe implementation
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize authentication state from secure storage
   */
  private async initializeAuthState(): Promise<void> {
    try {
      const encryptedState = await this.storageService.secureRetrieve(AUTH_STORAGE_KEY);
      if (encryptedState) {
        const state = this.decryptAuthState(encryptedState);
        if (state && this.validateStoredState(state)) {
          this.currentUser = state.user;
          this.setupTokenRefresh(state.tokens.accessToken);
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      await this.logout();
    }
  }

  /**
   * Authenticate user with enhanced security measures
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      this.validateLoginAttempts(credentials.email);
      
      const response = await this.apiService.login(
        credentials.email,
        credentials.password
      );

      const validatedResponse = this.validateAuthResponse(response);
      await this.handleSuccessfulLogin(validatedResponse);
      
      return validatedResponse;
    } catch (error) {
      await this.handleLoginError(credentials.email, error);
      throw error;
    }
  }

  /**
   * Register new user with security validation
   */
  public async register(data: RegisterData): Promise<AuthResponse> {
    try {
      this.validateRegistrationData(data);
      
      const response = await this.apiService.register(data);
      const validatedResponse = this.validateAuthResponse(response);
      
      await this.handleSuccessfulLogin(validatedResponse);
      return validatedResponse;
    } catch (error) {
      console.error('Registration failed:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Securely log out user and clear sensitive data
   */
  public async logout(): Promise<void> {
    try {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }

      this.currentUser = null;
      await this.storageService.secureClear(AUTH_STORAGE_KEY);
      await this.apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout securely');
    }
  }

  /**
   * Get current authenticated user with role validation
   */
  public getCurrentUser(): User | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  /**
   * Check if user has specific role
   */
  public hasRole(role: UserRole): boolean {
    return this.currentUser?.roles.includes(role) || false;
  }

  /**
   * Refresh authentication token with security validation
   */
  private async refreshToken(): Promise<string> {
    try {
      const response = await this.apiService.refreshToken();
      const validatedToken = this.validateToken(response);
      
      await this.updateStoredTokens(validatedToken);
      this.setupTokenRefresh(validatedToken);
      
      return validatedToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.logout();
      throw new Error('Session expired. Please login again.');
    }
  }

  /**
   * Validate and decrypt authentication response
   */
  private validateAuthResponse(response: AuthResponse): AuthResponse {
    if (!response.accessToken || !response.refreshToken || !response.user) {
      throw new Error('Invalid authentication response');
    }

    const decodedToken = this.decodeToken(response.accessToken);
    if (!this.validateTokenPayload(decodedToken)) {
      throw new Error('Invalid token payload');
    }

    return response;
  }

  /**
   * Setup automatic token refresh before expiration
   */
  private setupTokenRefresh(token: string): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    const decodedToken = this.decodeToken(token);
    const expiresIn = decodedToken.exp * 1000 - Date.now();
    const refreshTime = expiresIn - (TOKEN_REFRESH_THRESHOLD_SECONDS * 1000);

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch(console.error);
      }, refreshTime);
    }
  }

  /**
   * Validate login attempts to prevent brute force
   */
  private validateLoginAttempts(email: string): void {
    const attempts = this.failedAttempts.get(email) || 0;
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new Error('Account temporarily locked. Please try again later.');
    }
  }

  /**
   * Handle successful login with secure state management
   */
  private async handleSuccessfulLogin(response: AuthResponse): Promise<void> {
    this.currentUser = response.user;
    this.failedAttempts.delete(response.user.email);
    
    const encryptedState = this.encryptAuthState({
      user: response.user,
      tokens: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken
      }
    });

    await this.storageService.secureStore(AUTH_STORAGE_KEY, encryptedState);
    this.setupTokenRefresh(response.accessToken);
  }

  /**
   * Handle login error with attempt tracking
   */
  private async handleLoginError(email: string, error: any): Promise<void> {
    const attempts = (this.failedAttempts.get(email) || 0) + 1;
    this.failedAttempts.set(email, attempts);

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      setTimeout(() => {
        this.failedAttempts.delete(email);
      }, ATTEMPT_RESET_TIME_MS);
    }

    throw new Error(`Authentication failed: ${error.message}`);
  }

  /**
   * Encrypt authentication state for storage
   */
  private encryptAuthState(state: any): string {
    return CryptoJS.AES.encrypt(
      JSON.stringify(state),
      TOKEN_ENCRYPTION_KEY!
    ).toString();
  }

  /**
   * Decrypt authentication state from storage
   */
  private decryptAuthState(encrypted: string): any {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, TOKEN_ENCRYPTION_KEY!);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return null;
    }
  }

  /**
   * Validate stored authentication state
   */
  private validateStoredState(state: any): boolean {
    return !!(
      state &&
      state.user &&
      state.user.id &&
      state.tokens &&
      state.tokens.accessToken &&
      state.tokens.refreshToken
    );
  }

  /**
   * Decode and validate JWT token
   */
  private decodeToken(token: string): any {
    try {
      return jwtDecode(token);
    } catch {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Validate token payload structure
   */
  private validateTokenPayload(payload: any): boolean {
    return !!(
      payload &&
      payload.sub &&
      payload.exp &&
      payload.roles &&
      Array.isArray(payload.roles)
    );
  }
}

// Export singleton instance
export default AuthService.getInstance();