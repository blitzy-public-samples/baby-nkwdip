import { IsString, IsNotEmpty, IsEnum, Length, IsOptional } from 'class-validator'; // ^0.13.0
import { ApiProperty } from '@nestjs/swagger'; // ^5.0.0

/**
 * Enumeration of supported notification types in the Baby Cry Analyzer system
 */
export enum NotificationType {
  /**
   * Notification for when a baby cry is detected by the system
   */
  CRY_DETECTED = 'CRY_DETECTED',

  /**
   * Notification for when cry pattern analysis is completed
   */
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',

  /**
   * Notification for care recommendations based on cry analysis
   */
  RECOMMENDATION = 'RECOMMENDATION'
}

/**
 * Data Transfer Object for handling push notification requests
 * Implements comprehensive validation rules and Swagger documentation
 */
export class SendNotificationDto {
  /**
   * Unique identifier of the user who will receive the notification
   */
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'Unique identifier of the notification recipient',
    example: 'user123'
  })
  userId: string;

  /**
   * Title of the notification to be displayed
   * Limited to 100 characters for optimal display across devices
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  @ApiProperty({
    description: 'Notification title',
    example: 'Cry Detected',
    maxLength: 100
  })
  title: string;

  /**
   * Detailed message content of the notification
   * Limited to 500 characters to ensure compatibility with push notification services
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  @ApiProperty({
    description: 'Detailed notification message',
    example: 'Baby cry pattern detected at 14:30',
    maxLength: 500
  })
  message: string;

  /**
   * Category of the notification for proper handling and display
   */
  @IsEnum(NotificationType)
  @IsNotEmpty()
  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.CRY_DETECTED
  })
  type: NotificationType;

  /**
   * Optional additional data payload for the notification
   * Can contain specific details based on notification type
   */
  @IsOptional()
  @ApiProperty({
    description: 'Additional notification payload data',
    required: false,
    example: {
      cryIntensity: 0.8,
      confidence: 0.95,
      timestamp: '2023-09-20T14:30:00Z'
    }
  })
  data?: Record<string, any>;
}