/**
 * @fileoverview Core API service for the Baby Cry Analyzer web application
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { io, Socket } from 'socket.io-client'; // ^4.6.0
import axiosRetry from 'axios-retry'; // ^3.5.0
import { AudioAnalysisResult, AudioFeatures } from '../types/audio.types';

// Constants for API configuration
const API_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const SOCKET_RECONNECTION_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 100;
const TOKEN_ROTATION_INTERVAL = 300000;

// Types for API service
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface ConnectionState {
  isConnected: boolean;
  lastHeartbeat: number;
  reconnectionAttempts: number;
}

interface RequestQueue {
  requests: number;
  windowStart: number;
}

/**
 * Enhanced API service class for secure communication with the backend
 */
export class ApiService {
  private httpClient: AxiosInstance;
  private socket: Socket | null = null;
  private connectionState: ConnectionState;
  private requestQueue: RequestQueue;
  private tokenRotationInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize API service with security configurations
   * @param baseUrl - Base URL for API endpoints
   * @param apiKey - API authentication key
   */
  constructor(private baseUrl: string, private apiKey: string) {
    // Validate inputs
    if (!baseUrl || !apiKey) {
      throw new Error('Invalid API configuration');
    }

    // Initialize connection state
    this.connectionState = {
      isConnected: false,
      lastHeartbeat: Date.now(),
      reconnectionAttempts: 0
    };

    // Initialize request queue for rate limiting
    this.requestQueue = {
      requests: 0,
      windowStart: Date.now()
    };

    // Configure axios instance with security measures
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Client-Version': '1.0.0',
      },
      withCredentials: true
    });

    // Configure retry mechanism
    axiosRetry(this.httpClient, {
      retries: MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429;
      }
    });

    // Setup request interceptor
    this.httpClient.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => this.handleRequestError(error)
    );

    // Setup response interceptor
    this.httpClient.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleResponseError(error)
    );
  }

  /**
   * Authenticate user and setup secure session
   * @param email - User email
   * @param password - User password
   * @returns Authentication response with tokens
   */
  public async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await this.httpClient.post<AuthResponse>('/auth/login', {
        email: this.sanitizeInput(email),
        password: this.sanitizeInput(password)
      });

      this.setupTokenRotation(response.data.accessToken);
      return response.data;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Analyze audio data with security measures and monitoring
   * @param audioData - Audio blob for analysis
   * @returns Analysis results
   */
  public async analyzeAudio(audioData: Blob): Promise<AudioAnalysisResult> {
    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioData);

      const response = await this.httpClient.post<AudioAnalysisResult>(
        '/analysis/audio',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return this.validateAnalysisResult(response.data);
    } catch (error) {
      this.handleAnalysisError(error);
      throw error;
    }
  }

  /**
   * Start secure real-time monitoring with WebSocket
   * @param babyId - Unique identifier for the baby
   */
  public async startMonitoring(babyId: string): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.baseUrl, {
      transports: ['websocket'],
      reconnectionAttempts: SOCKET_RECONNECTION_ATTEMPTS,
      auth: {
        token: await this.getAuthToken()
      }
    });

    this.setupSocketHandlers(babyId);
  }

  /**
   * Handle request interceptor with security measures
   */
  private async handleRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    const token = await this.getAuthToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`
      };
    }

    // Add security headers
    config.headers = {
      ...config.headers,
      'X-Request-ID': this.generateRequestId(),
      'X-Timestamp': Date.now().toString()
    };

    return config;
  }

  /**
   * Setup secure WebSocket handlers with monitoring
   */
  private setupSocketHandlers(babyId: string): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.connectionState.isConnected = true;
      this.socket?.emit('subscribe', { babyId });
    });

    this.socket.on('disconnect', () => {
      this.connectionState.isConnected = false;
      this.handleDisconnection();
    });

    this.socket.on('error', this.handleSocketError.bind(this));
    this.socket.on('analysis_update', this.handleAnalysisUpdate.bind(this));
    
    // Setup heartbeat mechanism
    setInterval(() => {
      if (this.connectionState.isConnected) {
        this.socket?.emit('heartbeat');
      }
    }, 30000);
  }

  /**
   * Validate and sanitize analysis results
   */
  private validateAnalysisResult(result: AudioAnalysisResult): AudioAnalysisResult {
    if (!result.needType || typeof result.confidence !== 'number') {
      throw new Error('Invalid analysis result format');
    }

    return {
      ...result,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      timestamp: Date.now()
    };
  }

  /**
   * Setup secure token rotation mechanism
   */
  private setupTokenRotation(initialToken: string): void {
    if (this.tokenRotationInterval) {
      clearInterval(this.tokenRotationInterval);
    }

    this.tokenRotationInterval = setInterval(
      async () => {
        try {
          const response = await this.httpClient.post<AuthResponse>('/auth/rotate-token');
          this.updateAuthToken(response.data.accessToken);
        } catch (error) {
          this.handleTokenRotationError(error);
        }
      },
      TOKEN_ROTATION_INTERVAL
    );
  }

  /**
   * Check rate limiting quota
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.requestQueue.windowStart >= RATE_LIMIT_WINDOW) {
      this.requestQueue = {
        requests: 1,
        windowStart: now
      };
      return true;
    }

    this.requestQueue.requests++;
    return this.requestQueue.requests <= MAX_REQUESTS_PER_WINDOW;
  }

  // Additional private helper methods for security and error handling...
  private sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleAuthError(error: any): void {
    console.error('Authentication error:', error);
    // Implement specific auth error handling
  }

  private handleAnalysisError(error: any): void {
    console.error('Analysis error:', error);
    // Implement specific analysis error handling
  }

  private handleSocketError(error: any): void {
    console.error('Socket error:', error);
    // Implement specific socket error handling
  }

  private handleDisconnection(): void {
    // Implement disconnection recovery logic
  }

  private handleTokenRotationError(error: any): void {
    console.error('Token rotation error:', error);
    // Implement specific token rotation error handling
  }

  private async getAuthToken(): Promise<string | null> {
    // Implement secure token retrieval
    return null;
  }

  private updateAuthToken(token: string): void {
    // Implement secure token update
  }

  private handleAnalysisUpdate(update: any): void {
    // Handle real-time analysis updates
  }
}