import { Injectable } from '@nestjs/common'; // ^9.0.0
import * as admin from 'firebase-admin'; // ^11.0.0
import * as apn from 'apn'; // ^2.2.0
import { RateLimiter } from 'rate-limiter-flexible'; // ^2.4.1
import { SendNotificationDto, NotificationType } from './dto/send-notification.dto';
import { UserService } from '../user/user.service';
import { Logger } from '@nestjs/common';

interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}

@Injectable()
export class NotificationService {
  private readonly firebaseApp: admin.app.App;
  private readonly apnProvider: apn.Provider;
  private readonly rateLimiter: RateLimiter;
  private readonly logger = new Logger(NotificationService.name);

  // Constants for rate limiting and batch processing
  private readonly RATE_LIMIT_POINTS = 100;
  private readonly RATE_LIMIT_DURATION = 60; // 60 seconds
  private readonly BATCH_SIZE = 500;
  private readonly MAX_RETRIES = 3;

  constructor(private readonly userService: UserService) {
    // Initialize Firebase Admin SDK with retry configuration
    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    // Initialize APN Provider with enhanced certificates
    this.apnProvider = new apn.Provider({
      token: {
        key: process.env.APN_KEY_PATH,
        keyId: process.env.APN_KEY_ID,
        teamId: process.env.APN_TEAM_ID,
      },
      production: process.env.NODE_ENV === 'production',
    });

    // Configure rate limiter
    this.rateLimiter = new RateLimiter({
      points: this.RATE_LIMIT_POINTS,
      duration: this.RATE_LIMIT_DURATION,
      blockDuration: this.RATE_LIMIT_DURATION,
    });
  }

  /**
   * Sends a notification to a user with enhanced security and monitoring
   * @param notificationDto Notification data transfer object
   */
  async sendNotification(notificationDto: SendNotificationDto): Promise<void> {
    try {
      // Check rate limit
      await this.rateLimiter.consume(notificationDto.userId);

      // Get user device tokens
      const user = await this.userService.findOne(notificationDto.userId);
      if (!user) {
        throw new Error(`User not found: ${notificationDto.userId}`);
      }

      const deviceTokens = await this.userService.getDeviceTokens(notificationDto.userId);
      if (!deviceTokens?.length) {
        this.logger.warn(`No device tokens found for user: ${notificationDto.userId}`);
        return;
      }

      // Prepare notification payload with security considerations
      const securePayload = this.prepareSecurePayload(notificationDto);

      // Send to both FCM and APNS with retry logic
      await Promise.all([
        this.sendToFCM(deviceTokens.android, securePayload),
        this.sendToAPNS(deviceTokens.ios, securePayload),
      ]);

      // Log successful delivery
      this.logger.log({
        message: 'Notification sent successfully',
        userId: notificationDto.userId,
        type: notificationDto.type,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to send notification',
        error: error.message,
        userId: notificationDto.userId,
        type: notificationDto.type,
      });
      throw error;
    }
  }

  /**
   * Processes batch notifications efficiently with parallel processing
   * @param notifications Array of notification DTOs
   */
  async sendBatchNotifications(notifications: SendNotificationDto[]): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Group notifications by user for rate limiting
    const userGroups = this.groupByUser(notifications);

    // Process in parallel chunks
    for (const [userId, userNotifications] of userGroups) {
      try {
        await this.rateLimiter.consume(userId);
        
        // Process notifications in chunks
        const chunks = this.chunkArray(userNotifications, this.BATCH_SIZE);
        
        for (const chunk of chunks) {
          const promises = chunk.map(notification =>
            this.sendNotificationWithRetry(notification)
          );

          const results = await Promise.allSettled(promises);
          
          // Track results
          results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
              result.successful++;
            } else {
              result.failed++;
              result.errors.push({
                userId: chunk[index].userId,
                error: res.reason.message,
              });
            }
          });
        }
      } catch (error) {
        this.logger.error({
          message: 'Batch processing error',
          userId,
          error: error.message,
        });
      }
    }

    return result;
  }

  private async sendNotificationWithRetry(
    notification: SendNotificationDto,
    retryCount = 0
  ): Promise<void> {
    try {
      await this.sendNotification(notification);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return this.sendNotificationWithRetry(notification, retryCount + 1);
      }
      throw error;
    }
  }

  private async sendToFCM(
    tokens: string[],
    payload: admin.messaging.MessagingPayload
  ): Promise<void> {
    if (!tokens?.length) return;

    try {
      const response = await this.firebaseApp.messaging().sendMulticast({
        tokens,
        ...payload,
        android: {
          priority: 'high',
          ...payload.android,
        },
      });

      if (response.failureCount > 0) {
        this.logger.warn({
          message: 'FCM partial delivery failure',
          success: response.successCount,
          failure: response.failureCount,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'FCM delivery failed',
        error: error.message,
        tokens: tokens.length,
      });
      throw error;
    }
  }

  private async sendToAPNS(
    tokens: string[],
    payload: any
  ): Promise<void> {
    if (!tokens?.length) return;

    const notification = new apn.Notification({
      alert: {
        title: payload.notification.title,
        body: payload.notification.body,
      },
      payload: payload.data,
      topic: process.env.APN_BUNDLE_ID,
      expiry: Math.floor(Date.now() / 1000) + 24 * 3600, // 24 hour expiry
    });

    try {
      const response = await this.apnProvider.send(notification, tokens);
      
      if (response.failed.length > 0) {
        this.logger.warn({
          message: 'APNS partial delivery failure',
          success: response.sent.length,
          failure: response.failed.length,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'APNS delivery failed',
        error: error.message,
        tokens: tokens.length,
      });
      throw error;
    }
  }

  private prepareSecurePayload(dto: SendNotificationDto): admin.messaging.MessagingPayload {
    return {
      notification: {
        title: dto.title,
        body: dto.message,
      },
      data: {
        type: dto.type,
        timestamp: new Date().toISOString(),
        ...dto.data,
      },
    };
  }

  private groupByUser(notifications: SendNotificationDto[]): Map<string, SendNotificationDto[]> {
    return notifications.reduce((groups, notification) => {
      const group = groups.get(notification.userId) || [];
      group.push(notification);
      groups.set(notification.userId, group);
      return groups;
    }, new Map<string, SendNotificationDto[]>());
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
      array.slice(index * size, (index + 1) * size)
    );
  }
}