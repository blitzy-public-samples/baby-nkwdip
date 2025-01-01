import { Test, TestingModule } from '@nestjs/testing'; // ^8.0.0
import { NotificationController } from '../notification.controller';
import { NotificationService } from '../notification.service';
import { SendNotificationDto, NotificationType } from '../dto/send-notification.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

// Mock NotificationService
jest.mock('../notification.service');

// Mock RolesGuard
jest.mock('../../common/guards/roles.guard');

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: jest.Mocked<NotificationService>;
  let rolesGuard: jest.Mocked<RolesGuard>;

  const mockUser = {
    id: 'user123',
    roles: ['Parent']
  };

  const mockNotification: SendNotificationDto = {
    userId: 'user123',
    title: 'Cry Detected',
    message: 'Baby cry pattern detected at 14:30',
    type: NotificationType.CRY_DETECTED,
    data: {
      cryIntensity: 0.8,
      confidence: 0.95,
      timestamp: '2023-09-20T14:30:00Z'
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useFactory: () => ({
            sendNotification: jest.fn(),
            sendBatchNotifications: jest.fn(),
            validateNotification: jest.fn()
          })
        }
      ]
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<NotificationController>(NotificationController);
    notificationService = module.get(NotificationService);
    rolesGuard = module.get(RolesGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should successfully send a single notification', async () => {
      notificationService.sendNotification.mockResolvedValue(undefined);

      await expect(controller.sendNotification(mockNotification))
        .resolves.toBeUndefined();

      expect(notificationService.sendNotification).toHaveBeenCalledWith(mockNotification);
    });

    it('should handle validation errors', async () => {
      const invalidNotification = { ...mockNotification, title: '' };

      await expect(controller.sendNotification(invalidNotification))
        .rejects.toThrow(BadRequestException);
    });

    it('should enforce rate limits', async () => {
      // Simulate rate limit exceeded
      const error = new Error('Rate limit exceeded');
      notificationService.sendNotification.mockRejectedValue(error);

      await expect(controller.sendNotification(mockNotification))
        .rejects.toThrow(error);
    });

    it('should validate user authorization', async () => {
      rolesGuard.canActivate.mockResolvedValue(false);

      await expect(controller.sendNotification(mockNotification))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Service unavailable');
      notificationService.sendNotification.mockRejectedValue(error);

      await expect(controller.sendNotification(mockNotification))
        .rejects.toThrow(error);
    });
  });

  describe('sendBatchNotifications', () => {
    const mockBatch = [mockNotification, { ...mockNotification, userId: 'user456' }];
    const mockBatchResult = {
      successful: 1,
      failed: 1,
      errors: [{ userId: 'user456', error: 'User not found' }]
    };

    it('should successfully process batch notifications', async () => {
      notificationService.sendBatchNotifications.mockResolvedValue(mockBatchResult);

      const result = await controller.sendBatchNotifications(mockBatch);

      expect(result).toEqual(mockBatchResult);
      expect(notificationService.sendBatchNotifications).toHaveBeenCalledWith(mockBatch);
    });

    it('should handle empty batch requests', async () => {
      await expect(controller.sendBatchNotifications([]))
        .rejects.toThrow(BadRequestException);
    });

    it('should enforce batch size limits', async () => {
      const largeBatch = Array(101).fill(mockNotification);

      await expect(controller.sendBatchNotifications(largeBatch))
        .rejects.toThrow(BadRequestException);
    });

    it('should validate all notifications in batch', async () => {
      const invalidBatch = [
        mockNotification,
        { ...mockNotification, type: 'INVALID_TYPE' as NotificationType }
      ];

      await expect(controller.sendBatchNotifications(invalidBatch))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle partial batch failures', async () => {
      const partialFailure = {
        successful: 1,
        failed: 1,
        errors: [{ userId: 'user456', error: 'Delivery failed' }]
      };

      notificationService.sendBatchNotifications.mockResolvedValue(partialFailure);

      const result = await controller.sendBatchNotifications(mockBatch);

      expect(result).toEqual(partialFailure);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent notification requests', async () => {
      const concurrentRequests = Array(10)
        .fill(mockNotification)
        .map(() => controller.sendNotification(mockNotification));

      await expect(Promise.all(concurrentRequests)).resolves.toBeDefined();
    });

    it('should process large batch notifications efficiently', async () => {
      const largeBatch = Array(50).fill(mockNotification);
      const startTime = Date.now();

      await controller.sendBatchNotifications(largeBatch);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      notificationService.sendNotification.mockRejectedValue(networkError);

      await expect(controller.sendNotification(mockNotification))
        .rejects.toThrow(networkError);
    });

    it('should handle invalid notification types', async () => {
      const invalidNotification = {
        ...mockNotification,
        type: 'INVALID_TYPE' as NotificationType
      };

      await expect(controller.sendNotification(invalidNotification))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle service unavailability', async () => {
      const serviceError = new Error('Service unavailable');
      notificationService.sendBatchNotifications.mockRejectedValue(serviceError);

      await expect(controller.sendBatchNotifications([mockNotification]))
        .rejects.toThrow(serviceError);
    });
  });

  describe('Authorization Tests', () => {
    it('should allow parent access to notifications', async () => {
      rolesGuard.canActivate.mockResolvedValue(true);

      await expect(controller.sendNotification(mockNotification))
        .resolves.toBeUndefined();
    });

    it('should restrict admin-only batch operations', async () => {
      rolesGuard.canActivate.mockResolvedValue(false);

      await expect(controller.sendBatchNotifications([mockNotification]))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should validate user roles for notification access', async () => {
      rolesGuard.canActivate.mockImplementation((context) => {
        const request = context.switchToHttp().getRequest();
        return request.user?.roles.includes('Parent');
      });

      await expect(controller.sendNotification(mockNotification))
        .resolves.toBeUndefined();
    });
  });
});