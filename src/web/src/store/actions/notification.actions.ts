/**
 * @fileoverview Redux action creators for notification management
 * @version 1.0.0
 * @license MIT
 */

import { createAction } from '@reduxjs/toolkit'; // ^1.9.0
import { validatePayload } from 'class-validator'; // ^0.14.0
import {
  INotification,
  INotificationPayload,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  IWebSocketPayload
} from '../../types/notification.types';
import { NotificationService } from '../../services/notification.service';

// Action Types
export const SEND_NOTIFICATION = 'notification/send';
export const SEND_NOTIFICATION_SUCCESS = 'notification/sendSuccess';
export const SEND_NOTIFICATION_FAILURE = 'notification/sendFailure';
export const RECEIVE_NOTIFICATION = 'notification/receive';
export const MARK_AS_READ = 'notification/markAsRead';
export const UPDATE_NOTIFICATION_STATUS = 'notification/updateStatus';
export const CLEAR_NOTIFICATIONS = 'notification/clear';
export const CONNECT_WEBSOCKET = 'notification/connectWebSocket';
export const WEBSOCKET_CONNECTED = 'notification/websocketConnected';
export const WEBSOCKET_DISCONNECTED = 'notification/websocketDisconnected';
export const WEBSOCKET_ERROR = 'notification/websocketError';

// Action Creators
export const sendNotification = createAction<INotificationPayload & { priority: NotificationPriority }>(
  SEND_NOTIFICATION,
  (payload: INotificationPayload, priority: NotificationPriority = NotificationPriority.MEDIUM) => {
    // Validate notification payload
    const validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid notification payload: ${validationErrors.join(', ')}`);
    }

    return {
      payload: {
        ...payload,
        priority,
        timestamp: Date.now()
      }
    };
  }
);

export const sendNotificationSuccess = createAction<INotification & { deliveredAt: Date }>(
  SEND_NOTIFICATION_SUCCESS,
  (notification: INotification) => ({
    payload: {
      ...notification,
      deliveredAt: new Date(),
      status: NotificationStatus.UNREAD
    }
  })
);

export const sendNotificationFailure = createAction<{ error: string }>(
  SEND_NOTIFICATION_FAILURE
);

export const receiveNotification = createAction<INotification>(
  RECEIVE_NOTIFICATION,
  (notification: INotification) => ({
    payload: {
      ...notification,
      receivedAt: Date.now()
    }
  })
);

export const markAsRead = createAction<{ notificationId: string }>(
  MARK_AS_READ,
  (notificationId: string) => ({
    payload: {
      notificationId,
      readAt: Date.now()
    }
  })
);

export const updateNotificationStatus = createAction<{
  notificationId: string;
  status: NotificationStatus;
}>(UPDATE_NOTIFICATION_STATUS);

export const clearNotifications = createAction(CLEAR_NOTIFICATIONS);

export const connectWebSocket = createAction(
  CONNECT_WEBSOCKET,
  async () => {
    try {
      await NotificationService.getInstance().connectWebSocket();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

export const websocketConnected = createAction(
  WEBSOCKET_CONNECTED,
  () => ({
    payload: {
      connectedAt: Date.now()
    }
  })
);

export const websocketDisconnected = createAction(
  WEBSOCKET_DISCONNECTED,
  () => ({
    payload: {
      disconnectedAt: Date.now()
    }
  })
);

export const websocketError = createAction<{ error: string }>(
  WEBSOCKET_ERROR
);

// Thunk Actions
export const sendCryDetectionNotification = (
  babyId: string,
  analysisResult: any,
  priority: NotificationPriority = NotificationPriority.HIGH
) => async (dispatch: any) => {
  try {
    const notificationPayload: INotificationPayload = {
      title: 'Cry Detected',
      message: `Baby cry detected with ${analysisResult.confidence}% confidence`,
      type: NotificationType.CRY_DETECTED,
      priority,
      data: {
        babyId,
        analysisResult,
        timestamp: Date.now()
      }
    };

    dispatch(sendNotification(notificationPayload, priority));

    const notificationService = NotificationService.getInstance();
    const notification = await notificationService.sendNotification(notificationPayload);

    dispatch(sendNotificationSuccess(notification));
  } catch (error) {
    dispatch(sendNotificationFailure({ error: error.message }));
  }
};

export const markNotificationAsRead = (notificationId: string) => async (dispatch: any) => {
  try {
    await NotificationService.getInstance().markAsRead(notificationId);
    dispatch(markAsRead({ notificationId }));
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
  }
};

export const handleWebSocketMessage = (message: IWebSocketPayload) => async (dispatch: any) => {
  try {
    const notification: INotification = {
      ...message,
      status: NotificationStatus.UNREAD,
      createdAt: new Date(),
      readAt: null
    };
    dispatch(receiveNotification(notification));
  } catch (error) {
    console.error('Failed to handle WebSocket message:', error);
    dispatch(websocketError({ error: error.message }));
  }
};

// Type definitions for action payloads
export type NotificationActionPayload =
  | ReturnType<typeof sendNotification>
  | ReturnType<typeof sendNotificationSuccess>
  | ReturnType<typeof sendNotificationFailure>
  | ReturnType<typeof receiveNotification>
  | ReturnType<typeof markAsRead>
  | ReturnType<typeof updateNotificationStatus>
  | ReturnType<typeof clearNotifications>
  | ReturnType<typeof websocketConnected>
  | ReturnType<typeof websocketDisconnected>
  | ReturnType<typeof websocketError>;