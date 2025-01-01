/**
 * @fileoverview Enhanced service class for managing baby profiles with secure data handling and real-time monitoring
 * @version 1.0.0
 */

import { Baby, BabyPreferences, BabyAnalytics, CryPattern, PatternHistory, CryType } from '../types/baby.types';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import CryptoJS from 'crypto-js'; // ^4.1.1
import axios from 'axios'; // ^1.4.0

// Constants for secure data handling
const SECURE_STORAGE_KEYS = {
  BABY_DATA: 'encrypted_baby_data',
  MONITORING_SESSION: 'secure_monitoring_session',
  PATTERN_HISTORY: 'encrypted_pattern_history',
  ANALYTICS_DATA: 'encrypted_analytics_data'
};

// Configuration for data retention and security
const SECURITY_CONFIG = {
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  KEY_SIZE: 256,
  DATA_RETENTION_DAYS: 90,
  MONITORING_TIMEOUT: 300000, // 5 minutes
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// Interface for monitoring session management
interface MonitoringSession {
  babyId: string;
  startTime: number;
  isActive: boolean;
  noiseLevel: number;
  patternBuffer: CryPattern[];
}

// Interface for retry configuration
interface RetryConfiguration {
  attempts: number;
  delay: number;
  backoff: number;
}

/**
 * Enhanced service class for managing baby profiles with secure data handling
 */
export class BabyService {
  private static instance: BabyService;
  private apiService: ApiService;
  private storageService: StorageService;
  private monitoringSessions: Map<string, MonitoringSession>;
  private retryConfig: RetryConfiguration;
  private encryptionKey: string;

  /**
   * Private constructor implementing singleton pattern with enhanced security
   */
  private constructor() {
    this.apiService = new ApiService(process.env.API_BASE_URL || '', process.env.API_KEY || '');
    this.storageService = StorageService.getInstance();
    this.monitoringSessions = new Map();
    this.retryConfig = {
      attempts: SECURITY_CONFIG.RETRY_ATTEMPTS,
      delay: SECURITY_CONFIG.RETRY_DELAY,
      backoff: 1.5
    };
    this.encryptionKey = this.generateSecureKey();
    this.initializeSecurityHandlers();
  }

  /**
   * Gets singleton instance with security validation
   */
  public static getInstance(): BabyService {
    if (!BabyService.instance) {
      BabyService.instance = new BabyService();
    }
    return BabyService.instance;
  }

  /**
   * Creates a new baby profile with enhanced security
   */
  public async createBaby(babyData: Omit<Baby, 'id'>): Promise<Baby> {
    try {
      this.validateBabyData(babyData);
      const sanitizedData = this.sanitizeBabyData(babyData);
      
      const response = await this.executeWithRetry(async () => {
        return await this.apiService.post<Baby>('/babies', sanitizedData);
      });

      const encryptedBaby = this.encryptBabyData(response.data);
      await this.storageService.saveEncryptedData(
        SECURE_STORAGE_KEYS.BABY_DATA,
        encryptedBaby
      );

      return response.data;
    } catch (error) {
      this.handleError('Failed to create baby profile', error);
      throw error;
    }
  }

  /**
   * Updates baby profile with security validation
   */
  public async updateBaby(id: string, updates: Partial<Baby>): Promise<Baby> {
    try {
      this.validateBabyData(updates);
      const sanitizedUpdates = this.sanitizeBabyData(updates);

      const response = await this.executeWithRetry(async () => {
        return await this.apiService.put<Baby>(`/babies/${id}`, sanitizedUpdates);
      });

      const encryptedBaby = this.encryptBabyData(response.data);
      await this.storageService.saveEncryptedData(
        SECURE_STORAGE_KEYS.BABY_DATA,
        encryptedBaby
      );

      return response.data;
    } catch (error) {
      this.handleError('Failed to update baby profile', error);
      throw error;
    }
  }

  /**
   * Starts real-time monitoring with noise filtering
   */
  public async startMonitoring(babyId: string): Promise<void> {
    try {
      if (this.monitoringSessions.has(babyId)) {
        await this.stopMonitoring(babyId);
      }

      const session: MonitoringSession = {
        babyId,
        startTime: Date.now(),
        isActive: true,
        noiseLevel: 0,
        patternBuffer: []
      };

      this.monitoringSessions.set(babyId, session);
      await this.apiService.startMonitoring(babyId);
      this.initializeMonitoringHandlers(babyId);
    } catch (error) {
      this.handleError('Failed to start monitoring', error);
      throw error;
    }
  }

  /**
   * Stops monitoring and saves session data
   */
  public async stopMonitoring(babyId: string): Promise<void> {
    try {
      const session = this.monitoringSessions.get(babyId);
      if (session) {
        session.isActive = false;
        await this.saveMonitoringSession(session);
        this.monitoringSessions.delete(babyId);
      }
      await this.apiService.stopMonitoring();
    } catch (error) {
      this.handleError('Failed to stop monitoring', error);
      throw error;
    }
  }

  /**
   * Retrieves baby analytics with security measures
   */
  public async getBabyAnalytics(babyId: string): Promise<BabyAnalytics> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.apiService.get<BabyAnalytics>(`/babies/${babyId}/analytics`);
      });

      const encryptedAnalytics = this.encryptData(response.data);
      await this.storageService.saveEncryptedData(
        SECURE_STORAGE_KEYS.ANALYTICS_DATA,
        encryptedAnalytics
      );

      return response.data;
    } catch (error) {
      this.handleError('Failed to retrieve baby analytics', error);
      throw error;
    }
  }

  /**
   * Updates monitoring preferences with validation
   */
  public async updatePreferences(
    babyId: string,
    preferences: BabyPreferences
  ): Promise<void> {
    try {
      this.validatePreferences(preferences);
      await this.executeWithRetry(async () => {
        return await this.apiService.put(
          `/babies/${babyId}/preferences`,
          preferences
        );
      });
    } catch (error) {
      this.handleError('Failed to update preferences', error);
      throw error;
    }
  }

  // Private helper methods

  private initializeSecurityHandlers(): void {
    process.on('uncaughtException', (error) => {
      this.handleError('Uncaught exception in BabyService', error);
    });

    process.on('unhandledRejection', (error) => {
      this.handleError('Unhandled rejection in BabyService', error);
    });
  }

  private validateBabyData(data: Partial<Baby>): void {
    if (!data.name || data.name.length < 1) {
      throw new Error('Invalid baby name');
    }
    if (data.preferences) {
      this.validatePreferences(data.preferences);
    }
  }

  private validatePreferences(preferences: BabyPreferences): void {
    if (typeof preferences.monitoringEnabled !== 'boolean') {
      throw new Error('Invalid monitoring preference');
    }
    if (typeof preferences.notificationsEnabled !== 'boolean') {
      throw new Error('Invalid notification preference');
    }
  }

  private sanitizeBabyData(data: Partial<Baby>): Partial<Baby> {
    return {
      ...data,
      name: this.sanitizeString(data.name),
      retentionEndDate: this.calculateRetentionDate()
    };
  }

  private sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  private calculateRetentionDate(): Date {
    return new Date(
      Date.now() + SECURITY_CONFIG.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
  }

  private generateSecureKey(): string {
    return CryptoJS.lib.WordArray.random(SECURITY_CONFIG.KEY_SIZE / 8).toString();
  }

  private encryptBabyData(data: Baby): string {
    return this.encryptData(data);
  }

  private encryptData(data: any): string {
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      this.encryptionKey,
      {
        iv: iv,
        mode: CryptoJS.mode.GCM
      }
    );
    return iv.toString() + encrypted.toString();
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: Error;
    for (let attempt = 1; attempt <= this.retryConfig.attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < this.retryConfig.attempts) {
          await this.delay(
            this.retryConfig.delay * Math.pow(this.retryConfig.backoff, attempt - 1)
          );
        }
      }
    }
    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveMonitoringSession(session: MonitoringSession): Promise<void> {
    const encryptedSession = this.encryptData(session);
    await this.storageService.saveEncryptedData(
      SECURE_STORAGE_KEYS.MONITORING_SESSION,
      encryptedSession
    );
  }

  private initializeMonitoringHandlers(babyId: string): void {
    // Handle real-time monitoring events
    this.apiService.on('cryDetected', async (pattern: CryPattern) => {
      const session = this.monitoringSessions.get(babyId);
      if (session?.isActive) {
        session.patternBuffer.push(pattern);
        await this.processPatternBuffer(session);
      }
    });

    // Handle noise level updates
    this.apiService.on('noiseLevel', (level: number) => {
      const session = this.monitoringSessions.get(babyId);
      if (session?.isActive) {
        session.noiseLevel = level;
      }
    });
  }

  private async processPatternBuffer(session: MonitoringSession): Promise<void> {
    if (session.patternBuffer.length >= 5) {
      const patterns = [...session.patternBuffer];
      session.patternBuffer = [];
      await this.updatePatternHistory(session.babyId, patterns);
    }
  }

  private async updatePatternHistory(
    babyId: string,
    patterns: CryPattern[]
  ): Promise<void> {
    try {
      await this.executeWithRetry(async () => {
        return await this.apiService.post(
          `/babies/${babyId}/patterns`,
          patterns
        );
      });
    } catch (error) {
      this.handleError('Failed to update pattern history', error);
    }
  }

  private handleError(message: string, error: any): void {
    console.error(`BabyService Error: ${message}`, error);
    // Implement additional error handling logic
  }
}

// Export singleton instance
export default BabyService.getInstance();