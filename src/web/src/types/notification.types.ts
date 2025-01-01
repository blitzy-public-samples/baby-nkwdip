/**
 * @fileoverview TypeScript type definitions for the notification system
 * @version 1.0.0
 * @license MIT
 */

import { User } from './user.types';

/**
 * Enumeration of all possible notification types in the system
 */
export enum NotificationType {
  CRY_DETECTED = 'CRY_DETECTED',
  ANALYSIS_COMPLETE = 'ANALYSIS_COMPLETE',
  RECOMMENDATION = 'RECOMMENDATION',
  SYSTEM = 'SYSTEM'
}

/**
 * Enumeration of notification priority levels for proper alert handling
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

/**
 * Enumeration of possible notification status states
 */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Comprehensive interface for notification objects with full tracking capabilities
 */
export interface INotification {
  /** Unique identifier for the notification */
  id: string;
  
  /** ID of the user receiving the notification */
  userId: string;
  
  /** Notification title */
  title: string;
  
  /** Notification message content */
  message: string;
  
  /** Type of notification */
  type: NotificationType;
  
  /** Priority level of notification */
  priority: NotificationPriority;
  
  /** Current status of notification */
  status: NotificationStatus;
  
  /** Additional notification payload data */
  data: Record<string, any>;
  
  /** Timestamp when notification was created */
  createdAt: Date;
  
  /** Timestamp when notification was read by user */
  readAt: Date | null;
}

/**
 * Interface for creating new notifications with required fields
 */
export interface INotificationPayload {
  /** Notification title */
  title: string;
  
  /** Notification message */
  message: string;
  
  /** Type of notification */
  type: NotificationType;
  
  /** Priority level */
  priority: NotificationPriority;
  
  /** Additional data payload */
  data: Record<string, any>;
}

/**
 * Type definition for notification handler functions
 */
export type NotificationHandler = (notification: INotification) => Promise<void>;

/**
 * Type guard to check if notification is unread
 */
export const isUnreadNotification = (notification: INotification): boolean => {
  return notification.status === NotificationStatus.UNREAD;
};

/**
 * Type guard to check if notification is urgent
 */
export const isUrgentNotification = (notification: INotification): boolean => {
  return notification.priority === NotificationPriority.URGENT;
};

/**
 * Type for notification filter options
 */
export interface NotificationFilter {
  status?: NotificationStatus;
  type?: NotificationType;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Type for notification batch operations
 */
export interface NotificationBatchOperation {
  notificationIds: string[];
  operation: 'markAsRead' | 'archive' | 'delete';
}

/**
 * Type for notification statistics
 */
export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}