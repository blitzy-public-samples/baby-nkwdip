import { Controller, Post, Body, UseGuards } from '@nestjs/common'; // ^9.0.0
import { ApiTags, ApiOperation } from '@nestjs/swagger'; // ^5.0.0
import { RateLimit } from '@nestjs/throttler'; // ^4.0.0
import { NotificationService } from './notification.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Logger } from '@nestjs/common';

/**
 * Controller handling notification-related endpoints with comprehensive security,
 * rate limiting, and error handling for the Baby Cry Analyzer system.
 */
@Controller('notifications')
@ApiTags('notifications')
@UseGuards(RolesGuard)
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Sends a single push notification with enhanced error handling and rate limiting
   */
  @Post()
  @ApiOperation({
    summary: 'Send push notification',
    description: 'Sends a single push notification with priority support and delivery tracking'
  })
  @Roles('Parent', 'Caregiver', 'Admin')
  @RateLimit({
    ttl: 60,
    limit: 50,
    keyPrefix: 'notification_send'
  })
  async sendNotification(
    @Body() notificationDto: SendNotificationDto
  ): Promise<void> {
    try {
      this.logger.log({
        message: 'Processing notification request',
        userId: notificationDto.userId,
        type: notificationDto.type
      });

      await this.notificationService.sendNotification(notificationDto);

      this.logger.log({
        message: 'Notification sent successfully',
        userId: notificationDto.userId,
        type: notificationDto.type,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to send notification',
        error: error.message,
        userId: notificationDto.userId,
        type: notificationDto.type
      });
      throw error;
    }
  }

  /**
   * Sends multiple notifications in batch with optimized delivery and error handling
   */
  @Post('batch')
  @ApiOperation({
    summary: 'Send batch notifications',
    description: 'Sends multiple notifications in optimized batch with delivery tracking'
  })
  @Roles('Admin')
  @RateLimit({
    ttl: 60,
    limit: 20,
    keyPrefix: 'notification_batch'
  })
  async sendBatchNotifications(
    @Body() notifications: SendNotificationDto[]
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    try {
      this.logger.log({
        message: 'Processing batch notification request',
        count: notifications.length
      });

      const result = await this.notificationService.sendBatchNotifications(
        notifications
      );

      this.logger.log({
        message: 'Batch notifications processed',
        successful: result.successful,
        failed: result.failed,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      this.logger.error({
        message: 'Failed to process batch notifications',
        error: error.message,
        count: notifications.length
      });
      throw error;
    }
  }
}