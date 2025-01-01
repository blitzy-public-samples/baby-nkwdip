import { Test, TestingModule } from '@nestjs/testing'; // ^9.0.0
import * as admin from 'firebase-admin'; // ^11.0.0
import * as apn from 'apn'; // ^2.2.0
import { RateLimiterService } from '@nestjs/throttler'; // ^4.0.0
import { Meter, MeterProvider } from '@opentelemetry/api'; // ^1.0.0
import { NotificationService } from '../notification.service';
import { UserService } from '../../user/user.service';
import { SendNotificationDto, NotificationType } from '../dto/send-notification.dto';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let userService: UserService;
  let rateLimiterService: RateLimiterService;
  let meter: Meter;

  // Mock Firebase Admin SDK
  const mockFirebaseApp = {
    messaging: jest.fn().mockReturnValue({
      sendMulticast: jest.fn()
    })
  };

  // Mock APN Provider
  const mockApnProvider = {
    send: jest.fn()
  };

  // Mock User Service
  const mockUserService = {
    findOne: jest.fn(),
    getDeviceTokens: jest.fn(),
    validateToken: jest.fn()
  };

  // Mock Rate Limiter
  const mockRateLimiter = {
    consume: jest.fn(),
    points: 100,
    duration: 60
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: UserService,
          useValue: mockUserService
        },
        {
          provide: RateLimiterService,
          useValue: mockRateLimiter
        },
        {
          provide: MeterProvider,
          useValue: {
            getMeter: () => ({
              createHistogram: jest.fn(),
              createCounter: jest.fn()
            })
          }
        }
      ]
    }).compile();

    notificationService = module.get<NotificationService>(NotificationService);
    userService = module.get<UserService>(UserService);
    rateLimiterService = module.get<RateLimiterService>(RateLimiterService);
    meter = module.get(MeterProvider).getMeter('notification-service');

    // Mock Firebase and APN initialization
    jest.spyOn(admin, 'initializeApp').mockReturnValue(mockFirebaseApp as any);
    jest.spyOn(apn, 'Provider').mockReturnValue(mockApnProvider as any);
  });

  describe('sendNotification', () => {
    const testNotification: SendNotificationDto = {
      userId: 'test-user-123',
      title: 'Test Notification',
      message: 'Test message content',
      type: NotificationType.CRY_DETECTED,
      data: {
        cryIntensity: 0.8,
        confidence: 0.95
      }
    };

    const mockDeviceTokens = {
      android: ['fcm-token-1', 'fcm-token-2'],
      ios: ['apn-token-1', 'apn-token-2']
    };

    it('should successfully send notifications to both FCM and APNS', async () => {
      // Arrange
      mockUserService.findOne.mockResolvedValue({ id: testNotification.userId });
      mockUserService.getDeviceTokens.mockResolvedValue(mockDeviceTokens);
      mockRateLimiter.consume.mockResolvedValue(true);
      mockFirebaseApp.messaging().sendMulticast.mockResolvedValue({ successCount: 2, failureCount: 0 });
      mockApnProvider.send.mockResolvedValue({ sent: ['token1', 'token2'], failed: [] });

      // Act
      await notificationService.sendNotification(testNotification);

      // Assert
      expect(mockRateLimiter.consume).toHaveBeenCalledWith(testNotification.userId);
      expect(mockUserService.findOne).toHaveBeenCalledWith(testNotification.userId);
      expect(mockUserService.getDeviceTokens).toHaveBeenCalledWith(testNotification.userId);
      expect(mockFirebaseApp.messaging().sendMulticast).toHaveBeenCalled();
      expect(mockApnProvider.send).toHaveBeenCalled();
    });

    it('should handle rate limiting correctly', async () => {
      // Arrange
      mockRateLimiter.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(notificationService.sendNotification(testNotification))
        .rejects.toThrow('Rate limit exceeded');
      
      expect(mockFirebaseApp.messaging().sendMulticast).not.toHaveBeenCalled();
      expect(mockApnProvider.send).not.toHaveBeenCalled();
    });

    it('should handle user not found scenario', async () => {
      // Arrange
      mockRateLimiter.consume.mockResolvedValue(true);
      mockUserService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(notificationService.sendNotification(testNotification))
        .rejects.toThrow('User not found');
    });
  });

  describe('sendBatchNotifications', () => {
    const testBatch = Array(10).fill(null).map((_, index) => ({
      userId: `user-${index}`,
      title: 'Batch Test',
      message: `Test message ${index}`,
      type: NotificationType.CRY_DETECTED,
      data: { batchId: index }
    }));

    it('should process batch notifications with rate limiting', async () => {
      // Arrange
      mockRateLimiter.consume.mockResolvedValue(true);
      mockUserService.findOne.mockResolvedValue({ id: 'test-user' });
      mockUserService.getDeviceTokens.mockResolvedValue({
        android: ['fcm-token'],
        ios: ['apn-token']
      });
      mockFirebaseApp.messaging().sendMulticast.mockResolvedValue({ successCount: 1, failureCount: 0 });
      mockApnProvider.send.mockResolvedValue({ sent: ['token'], failed: [] });

      // Act
      const result = await notificationService.sendBatchNotifications(testBatch);

      // Assert
      expect(result.successful).toBe(10);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockRateLimiter.consume).toHaveBeenCalledTimes(10);
    });

    it('should handle partial failures in batch processing', async () => {
      // Arrange
      mockRateLimiter.consume.mockResolvedValue(true);
      mockUserService.findOne.mockImplementation((userId) => 
        userId === 'user-0' ? null : { id: userId }
      );
      mockUserService.getDeviceTokens.mockResolvedValue({
        android: ['fcm-token'],
        ios: ['apn-token']
      });

      // Act
      const result = await notificationService.sendBatchNotifications(testBatch);

      // Assert
      expect(result.successful).toBe(9);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe('user-0');
    });
  });

  describe('retry mechanism', () => {
    const testNotification: SendNotificationDto = {
      userId: 'retry-test-user',
      title: 'Retry Test',
      message: 'Test retry mechanism',
      type: NotificationType.CRY_DETECTED
    };

    it('should retry failed notifications with exponential backoff', async () => {
      // Arrange
      mockRateLimiter.consume.mockResolvedValue(true);
      mockUserService.findOne.mockResolvedValue({ id: testNotification.userId });
      mockUserService.getDeviceTokens.mockResolvedValue({
        android: ['fcm-token'],
        ios: ['apn-token']
      });

      let attempts = 0;
      mockFirebaseApp.messaging().sendMulticast.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { successCount: 1, failureCount: 0 };
      });

      // Act
      await notificationService.sendNotification(testNotification);

      // Assert
      expect(attempts).toBe(3);
      expect(mockFirebaseApp.messaging().sendMulticast).toHaveBeenCalledTimes(3);
    });

    it('should fail after maximum retry attempts', async () => {
      // Arrange
      mockRateLimiter.consume.mockResolvedValue(true);
      mockUserService.findOne.mockResolvedValue({ id: testNotification.userId });
      mockUserService.getDeviceTokens.mockResolvedValue({
        android: ['fcm-token'],
        ios: ['apn-token']
      });
      mockFirebaseApp.messaging().sendMulticast.mockRejectedValue(new Error('Persistent failure'));

      // Act & Assert
      await expect(notificationService.sendNotification(testNotification))
        .rejects.toThrow('Persistent failure');
      expect(mockFirebaseApp.messaging().sendMulticast).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });
});