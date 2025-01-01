/**
 * @fileoverview Advanced notification service for managing real-time alerts and push notifications
 * @version 1.0.0
 * @license MIT
 */

import { messaging } from '@react-native-firebase/messaging'; // ^18.0.0
import {
  INotification,
  INotificationPayload,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationHandler
} from '../types/notification.types';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

// Constants for notification configuration
const NOTIFICATION_CONFIG = {
  MAX_RETRIES: 3,
  BATCH_SIZE: 10,
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  RECONNECT_DELAY: 5000,
  MAX_QUEUE_SIZE: 100
};

// Rate limiter configuration
const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  TIME_WINDOW: 60000, // 1 minute
  BATCH_SIZE: 10
};

/**
 * Queue implementation for notification processing
 */
class NotificationQueue {
  private queue: INotificationPayload[] = [];
  private processing: boolean = false;

  public async enqueue(notification: INotificationPayload): Promise<void> {
    if (this.queue.length >= NOTIFICATION_CONFIG.MAX_QUEUE_SIZE) {
      await this.processQueue();
    }
    this.queue.push(notification);
  }

  public async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, RATE_LIMIT.BATCH_SIZE);
        await Promise.all(batch.map(notification => 
          NotificationService.getInstance().processNotification(notification)
        ));
      }
    } finally {
      this.processing = false;
    }
  }
}

/**
 * Rate limiter implementation for notification requests
 */
class RateLimiter {
  private requests: number = 0;
  private windowStart: number = Date.now();

  public async checkLimit(): Promise<boolean> {
    const now = Date.now();
    if (now - this.windowStart >= RATE_LIMIT.TIME_WINDOW) {
      this.requests = 0;
      this.windowStart = now;
    }

    if (this.requests >= RATE_LIMIT.MAX_REQUESTS) {
      return false;
    }

    this.requests++;
    return true;
  }
}

/**
 * Enhanced notification service implementing singleton pattern
 */
export class NotificationService {
  private static instance: NotificationService;
  private apiService: ApiService;
  private storageService: StorageService;
  private notificationHandlers: Map<NotificationType, NotificationHandler[]>;
  private wsConnection: WebSocket | null = null;
  private notificationQueue: NotificationQueue;
  private rateLimiter: RateLimiter;
  private fcmToken: string | null = null;

  /**
   * Private constructor implementing singleton pattern
   */
  private constructor() {
    this.apiService = new ApiService(process.env.API_BASE_URL!, process.env.API_KEY!);
    this.storageService = StorageService.getInstance();
    this.notificationHandlers = new Map();
    this.notificationQueue = new NotificationQueue();
    this.rateLimiter = new RateLimiter();
    this.initializeHandlers();
  }

  /**
   * Gets singleton instance of NotificationService
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initializes the notification service with required setup
   */
  public async initialize(): Promise<void> {
    try {
      await this.requestNotificationPermissions();
      await this.setupFCM();
      await this.connectWebSocket();
      this.setupAutoReconnect();
    } catch (error) {
      console.error('Notification service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Registers a notification handler for specific notification type
   */
  public registerHandler(
    type: NotificationType,
    handler: NotificationHandler,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ): void {
    const handlers = this.notificationHandlers.get(type) || [];
    handlers.push(handler);
    handlers.sort((a, b) => b.priority - a.priority);
    this.notificationHandlers.set(type, handlers);
  }

  /**
   * Processes a notification through the queue
   */
  public async processNotification(payload: INotificationPayload): Promise<void> {
    if (!(await this.rateLimiter.checkLimit())) {
      await this.notificationQueue.enqueue(payload);
      return;
    }

    const notification: INotification = {
      id: this.generateNotificationId(),
      userId: await this.getCurrentUserId(),
      title: payload.title,
      message: payload.message,
      type: payload.type,
      priority: payload.priority,
      status: NotificationStatus.UNREAD,
      data: payload.data,
      createdAt: new Date(),
      readAt: null
    };

    await this.saveNotification(notification);
    await this.triggerHandlers(notification);
    await this.showPushNotification(notification);
  }

  /**
   * Sets up Firebase Cloud Messaging
   */
  private async setupFCM(): Promise<void> {
    try {
      await messaging().registerDeviceForRemoteMessages();
      this.fcmToken = await messaging().getToken();
      
      messaging().onTokenRefresh(async (token) => {
        this.fcmToken = token;
        await this.updateFCMToken(token);
      });

      messaging().onMessage(async (remoteMessage) => {
        await this.handleFCMMessage(remoteMessage);
      });
    } catch (error) {
      console.error('FCM setup failed:', error);
      throw error;
    }
  }

  /**
   * Connects to WebSocket for real-time notifications
   */
  private async connectWebSocket(): Promise<void> {
    try {
      this.wsConnection = await this.apiService.connectWebSocket();
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw error;
    }
  }

  /**
   * Saves notification to secure storage
   */
  private async saveNotification(notification: INotification): Promise<void> {
    try {
      await this.storageService.saveEncryptedData(
        `notification_${notification.id}`,
        notification
      );
    } catch (error) {
      console.error('Failed to save notification:', error);
      throw error;
    }
  }

  /**
   * Shows push notification to user
   */
  private async showPushNotification(notification: INotification): Promise<void> {
    if (!this.fcmToken) return;

    try {
      await messaging().send({
        data: {
          notificationId: notification.id,
          type: notification.type,
          priority: notification.priority
        },
        notification: {
          title: notification.title,
          body: notification.message
        },
        token: this.fcmToken
      });
    } catch (error) {
      console.error('Push notification failed:', error);
      throw error;
    }
  }

  // Private helper methods
  private async requestNotificationPermissions(): Promise<void> {
    const authStatus = await messaging().requestPermission();
    if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
      throw new Error('Notification permissions denied');
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.wsConnection) return;

    this.wsConnection.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      await this.processNotification(data);
    };

    this.wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.reconnectWebSocket();
    };
  }

  private setupAutoReconnect(): void {
    setInterval(() => {
      if (!this.wsConnection || this.wsConnection.readyState === WebSocket.CLOSED) {
        this.reconnectWebSocket();
      }
    }, NOTIFICATION_CONFIG.RECONNECT_DELAY);
  }

  private async reconnectWebSocket(): Promise<void> {
    try {
      await this.connectWebSocket();
    } catch (error) {
      console.error('WebSocket reconnection failed:', error);
    }
  }

  private generateNotificationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getCurrentUserId(): Promise<string> {
    const user = await this.storageService.getUserProfile();
    if (!user) throw new Error('User not found');
    return user.id;
  }

  private async triggerHandlers(notification: INotification): Promise<void> {
    const handlers = this.notificationHandlers.get(notification.type) || [];
    await Promise.all(handlers.map(handler => handler(notification)));
  }

  private async handleFCMMessage(remoteMessage: any): Promise<void> {
    await this.processNotification({
      title: remoteMessage.notification.title,
      message: remoteMessage.notification.body,
      type: remoteMessage.data.type as NotificationType,
      priority: remoteMessage.data.priority as NotificationPriority,
      data: remoteMessage.data
    });
  }

  private async updateFCMToken(token: string): Promise<void> {
    try {
      await this.apiService.updateFCMToken(token);
    } catch (error) {
      console.error('FCM token update failed:', error);
    }
  }
}