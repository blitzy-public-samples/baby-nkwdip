/**
 * @fileoverview Redux reducer for managing notification state in the Baby Cry Analyzer application
 * @version 1.0.0
 * @license MIT
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import {
  INotification,
  NotificationType,
  NotificationPriority,
  NotificationStatus
} from '../../types/notification.types';

/**
 * Interface defining the notification state shape with enhanced tracking capabilities
 */
export interface NotificationState {
  notifications: INotification[];
  loading: { [key: string]: boolean };
  error: { message: string; code: string } | null;
  unreadCount: number;
  wsConnected: boolean;
  offlineQueue: INotification[];
}

/**
 * Initial state for the notification reducer
 */
const initialState: NotificationState = {
  notifications: [],
  loading: {},
  error: null,
  unreadCount: 0,
  wsConnected: false,
  offlineQueue: []
};

/**
 * Helper function to sort notifications by priority and date
 */
const sortNotifications = (notifications: INotification[]): INotification[] => {
  return [...notifications].sort((a, b) => {
    // Sort by priority first
    const priorityOrder = {
      [NotificationPriority.URGENT]: 0,
      [NotificationPriority.HIGH]: 1,
      [NotificationPriority.MEDIUM]: 2,
      [NotificationPriority.LOW]: 3
    };
    
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

/**
 * Helper function to calculate unread count
 */
const calculateUnreadCount = (notifications: INotification[]): number => {
  return notifications.filter(n => n.status === NotificationStatus.UNREAD).length;
};

/**
 * Notification reducer with comprehensive state management
 */
export const notificationReducer = createReducer(initialState, (builder) => {
  builder
    // Handle WebSocket connection status
    .addCase('notification/websocketConnected', (state) => {
      state.wsConnected = true;
      // Process offline queue if any
      if (state.offlineQueue.length > 0) {
        state.notifications = sortNotifications([...state.notifications, ...state.offlineQueue]);
        state.offlineQueue = [];
        state.unreadCount = calculateUnreadCount(state.notifications);
      }
    })
    .addCase('notification/websocketDisconnected', (state) => {
      state.wsConnected = false;
    })
    .addCase('notification/websocketError', (state, action: PayloadAction<{ error: string }>) => {
      state.error = { message: action.payload.error, code: 'WS_ERROR' };
    })

    // Handle sending notifications
    .addCase('notification/send', (state, action: PayloadAction<INotification>) => {
      state.loading['send'] = true;
      state.error = null;
      
      // Queue notification if offline
      if (!state.wsConnected) {
        state.offlineQueue.push(action.payload);
      }
    })
    .addCase('notification/sendSuccess', (state, action: PayloadAction<INotification>) => {
      state.loading['send'] = false;
      state.notifications = sortNotifications([...state.notifications, action.payload]);
      state.unreadCount = calculateUnreadCount(state.notifications);
    })
    .addCase('notification/sendFailure', (state, action: PayloadAction<{ error: string }>) => {
      state.loading['send'] = false;
      state.error = { message: action.payload.error, code: 'SEND_ERROR' };
    })

    // Handle receiving notifications
    .addCase('notification/receive', (state, action: PayloadAction<INotification>) => {
      const notification = action.payload;
      
      // Handle cry detection notifications with high priority
      if (notification.type === NotificationType.CRY_DETECTED) {
        notification.priority = NotificationPriority.HIGH;
      }
      
      state.notifications = sortNotifications([...state.notifications, notification]);
      state.unreadCount = calculateUnreadCount(state.notifications);
    })

    // Handle marking notifications as read
    .addCase('notification/markAsRead', (state, action: PayloadAction<{ notificationId: string }>) => {
      state.notifications = state.notifications.map(notification => 
        notification.id === action.payload.notificationId
          ? { ...notification, status: NotificationStatus.READ, readAt: new Date() }
          : notification
      );
      state.unreadCount = calculateUnreadCount(state.notifications);
    })

    // Handle batch operations
    .addCase('notification/markAllAsRead', (state) => {
      const now = new Date();
      state.notifications = state.notifications.map(notification => 
        notification.status === NotificationStatus.UNREAD
          ? { ...notification, status: NotificationStatus.READ, readAt: now }
          : notification
      );
      state.unreadCount = 0;
    })

    // Handle clearing notifications
    .addCase('notification/clear', (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.error = null;
      state.offlineQueue = [];
    })

    // Handle updating notification status
    .addCase('notification/updateStatus', (state, action: PayloadAction<{ 
      notificationId: string;
      status: NotificationStatus;
    }>) => {
      state.notifications = state.notifications.map(notification =>
        notification.id === action.payload.notificationId
          ? { ...notification, status: action.payload.status }
          : notification
      );
      state.unreadCount = calculateUnreadCount(state.notifications);
    });
});

export default notificationReducer;