import { Module } from '@nestjs/common'; // ^9.0.0
import { ConfigModule } from '@nestjs/config'; // ^2.0.0
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { UserModule } from '../user/user.module';

/**
 * NotificationModule configures and exports comprehensive notification functionality
 * for the Baby Cry Analyzer system. Implements secure, scalable push notification
 * services with monitoring and delivery guarantees through FCM and APNS.
 */
@Module({
  imports: [
    // Global configuration with secure caching
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.production', '.env'],
      validate: (config: Record<string, unknown>) => {
        const required = [
          'FIREBASE_PROJECT_ID',
          'APN_KEY_PATH',
          'APN_KEY_ID',
          'APN_TEAM_ID',
          'APN_BUNDLE_ID'
        ];
        
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
          }
        }
        return config;
      }
    }),

    // Import UserModule for device token management
    UserModule
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    // Configure notification settings with retry mechanisms
    {
      provide: 'NOTIFICATION_CONFIG',
      useValue: {
        // Retry configuration for enhanced delivery reliability
        retryAttempts: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        
        // Batch processing configuration for scalability
        batchSize: 100,
        batchTimeout: 5000,
        
        // Rate limiting for stability
        rateLimitPerMinute: 1000,
        
        // Monitoring configuration
        enableMetrics: true,
        metricsPrefix: 'notification_service',
        
        // Security settings
        requireSignedPayloads: true,
        validateTokens: true,
        
        // Platform-specific configurations
        fcm: {
          priority: 'high',
          timeToLive: 24 * 60 * 60, // 24 hours
          restrictedPackageName: process.env.ANDROID_PACKAGE_NAME
        },
        apns: {
          production: process.env.NODE_ENV === 'production',
          expiration: 24 * 60 * 60, // 24 hours
          priority: 10, // Immediate delivery
          topic: process.env.APN_BUNDLE_ID
        }
      }
    }
  ],
  exports: [NotificationService]
})
export class NotificationModule {
  // Module version for compatibility tracking
  static readonly moduleVersion = '1.0.0';

  // Notification configuration for external access
  static readonly notificationConfig = {
    maxRetries: 3,
    defaultPriority: 'high',
    deliveryTimeout: 30000, // 30 seconds
    supportedPlatforms: ['ios', 'android'] as const,
    notificationTypes: {
      CRY_DETECTED: 'CRY_DETECTED',
      ANALYSIS_COMPLETE: 'ANALYSIS_COMPLETE',
      RECOMMENDATION: 'RECOMMENDATION'
    }
  };
}