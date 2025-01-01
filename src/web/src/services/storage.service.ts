/**
 * @fileoverview Enhanced storage service with secure data persistence, encryption, and caching
 * @version 1.0.0
 * @license MIT
 */

import AsyncStorage from '@react-native-async-storage/async-storage'; // v1.17.11
import { User } from '../types/user.types';
import {
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  clearSecureStorage
} from '../utils/storage.util';

// Storage keys for different data types
const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  AUDIO_SETTINGS: 'audio_settings',
  THEME: 'app_theme',
  LANGUAGE: 'app_language',
  CACHE_DATA: 'cache_data'
} as const;

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Storage quota in bytes (50MB)
const STORAGE_QUOTA = 50 * 1024 * 1024;

/**
 * Custom error class for storage service operations
 */
class StorageServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageServiceError';
  }
}

/**
 * Enhanced storage service implementing singleton pattern with secure operations
 */
export class StorageService {
  private static instance: StorageService;
  private cache: Map<string, { data: any; timestamp: number }>;
  private quota: number;

  /**
   * Private constructor implementing singleton pattern
   */
  private constructor() {
    this.cache = new Map();
    this.quota = STORAGE_QUOTA;
    this.initializeErrorHandlers();
  }

  /**
   * Initialize error handlers for storage operations
   */
  private initializeErrorHandlers(): void {
    AsyncStorage.setErrorHandler((error: Error) => {
      console.error('Storage Error:', error);
      throw new StorageServiceError(`Storage operation failed: ${error.message}`);
    });
  }

  /**
   * Gets singleton instance of StorageService
   * @returns StorageService instance
   */
  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Validates storage quota before saving data
   * @param data Data to be stored
   * @throws StorageServiceError if quota exceeded
   */
  private async validateQuota(data: any): Promise<void> {
    const size = new Blob([JSON.stringify(data)]).size;
    const keys = await AsyncStorage.getAllKeys();
    let totalSize = 0;
    
    for (const key of keys) {
      const item = await AsyncStorage.getItem(key);
      if (item) {
        totalSize += new Blob([item]).size;
      }
    }

    if (totalSize + size > this.quota) {
      throw new StorageServiceError('Storage quota exceeded');
    }
  }

  /**
   * Validates user data structure
   * @param user User data to validate
   * @throws StorageServiceError if validation fails
   */
  private validateUserData(user: User): void {
    if (!user.id || !user.email) {
      throw new StorageServiceError('Invalid user data structure');
    }
  }

  /**
   * Sanitizes user data for storage
   * @param user User data to sanitize
   * @returns Sanitized user data
   */
  private sanitizeUserData(user: User): Partial<User> {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      preferences: user.preferences,
      updatedAt: new Date()
    };
  }

  /**
   * Checks if cached data is valid
   * @param key Cache key
   * @returns boolean indicating cache validity
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    return now - cached.timestamp < CACHE_DURATION;
  }

  /**
   * Updates cache with new data
   * @param key Cache key
   * @param data Data to cache
   */
  private updateCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Saves user profile data securely
   * @param user User data to save
   * @throws StorageServiceError if operation fails
   */
  public async saveUserProfile(user: User): Promise<void> {
    try {
      this.validateUserData(user);
      const sanitizedUser = this.sanitizeUserData(user);
      await this.validateQuota(sanitizedUser);
      
      await setSecureItem(STORAGE_KEYS.USER_PROFILE, sanitizedUser);
      this.updateCache(STORAGE_KEYS.USER_PROFILE, sanitizedUser);
    } catch (error) {
      throw new StorageServiceError(
        `Failed to save user profile: ${error.message}`
      );
    }
  }

  /**
   * Retrieves user profile from storage
   * @returns User profile or null if not found
   * @throws StorageServiceError if operation fails
   */
  public async getUserProfile(): Promise<User | null> {
    try {
      // Check cache first
      if (this.isCacheValid(STORAGE_KEYS.USER_PROFILE)) {
        return this.cache.get(STORAGE_KEYS.USER_PROFILE)?.data || null;
      }

      const userData = await getSecureItem(STORAGE_KEYS.USER_PROFILE);
      if (!userData) return null;

      // Validate retrieved data
      this.validateUserData(userData);
      
      // Update cache
      this.updateCache(STORAGE_KEYS.USER_PROFILE, userData);
      
      return userData;
    } catch (error) {
      throw new StorageServiceError(
        `Failed to retrieve user profile: ${error.message}`
      );
    }
  }

  /**
   * Removes user profile from storage
   * @throws StorageServiceError if operation fails
   */
  public async removeUserProfile(): Promise<void> {
    try {
      await removeSecureItem(STORAGE_KEYS.USER_PROFILE);
      this.cache.delete(STORAGE_KEYS.USER_PROFILE);
    } catch (error) {
      throw new StorageServiceError(
        `Failed to remove user profile: ${error.message}`
      );
    }
  }

  /**
   * Clears all storage and cache
   * @throws StorageServiceError if operation fails
   */
  public async clearStorage(): Promise<void> {
    try {
      await clearSecureStorage();
      this.cache.clear();
    } catch (error) {
      throw new StorageServiceError(
        `Failed to clear storage: ${error.message}`
      );
    }
  }
}

// Export singleton instance
export default StorageService.getInstance();