/**
 * @fileoverview Redux saga module for handling notification-related side effects
 * @version 1.0.0
 * @license MIT
 */

import { takeLatest, put, call, all, fork, select, delay } from 'redux-saga/effects'; // ^1.2.0
import {
  sendNotification,
  sendNotificationSuccess,
  sendNotificationFailure,
  fetchNotifications,
  fetchNotificationsSuccess,
  fetchNotificationsFailure,
  markNotificationAsRead,
  SEND_NOTIFICATION,
  RECEIVE_NOTIFICATION,
  MARK_AS_READ,
  CONNECT_WEBSOCKET,
  websocketConnected,
  websocketDisconnected,
  websocketError
} from '../actions/notification.actions';
import { NotificationService } from '../../services/notification.service';
import {
  INotification,
  INotificationPayload,
  NotificationPriority,
  NotificationStatus
} from '../../types/notification.types';

// Constants for saga configuration
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const BATCH_SIZE = 10;
const WEBSOCKET_RECONNECT_DELAY = 5000;

/**
 * Handles sending notifications with retry logic and priority queue
 */
function* handleSendNotification(action: ReturnType<typeof sendNotification>) {
  let attempts = 0;
  const notificationService = NotificationService.getInstance();

  while (attempts < RETRY_ATTEMPTS) {
    try {
      const { payload } = action;
      
      // Validate notification payload
      if (!payload.title || !payload.message) {
        throw new Error('Invalid notification payload');
      }

      // Connect WebSocket if needed
      if (!notificationService.wsConnection) {
        yield call([notificationService, 'connectWebSocket']);
      }

      // Send notification with priority handling
      const notification: INotification = yield call(
        [notificationService, 'processNotification'],
        payload
      );

      // Update UI optimistically
      yield put(sendNotificationSuccess({
        ...notification,
        deliveredAt: new Date()
      }));

      return;
    } catch (error) {
      attempts++;
      if (attempts === RETRY_ATTEMPTS) {
        yield put(sendNotificationFailure({ error: error.message }));
        yield put(websocketError({ error: error.message }));
      } else {
        yield delay(RETRY_DELAY * attempts);
      }
    }
  }
}

/**
 * Handles fetching notifications with pagination and caching
 */
function* handleFetchNotifications(action: ReturnType<typeof fetchNotifications>) {
  try {
    const { page = 1, limit = BATCH_SIZE } = action.payload;
    const notificationService = NotificationService.getInstance();

    // Fetch notifications with pagination
    const notifications: INotification[] = yield call(
      [notificationService, 'getNotifications'],
      { page, limit }
    );

    yield put(fetchNotificationsSuccess({
      notifications,
      page,
      hasMore: notifications.length === limit
    }));
  } catch (error) {
    yield put(fetchNotificationsFailure({ error: error.message }));
  }
}

/**
 * Handles marking notifications as read with optimistic updates
 */
function* handleMarkAsRead(action: ReturnType<typeof markNotificationAsRead>) {
  try {
    const { notificationId } = action.payload;
    const notificationService = NotificationService.getInstance();

    // Update UI optimistically
    yield put({
      type: 'notification/updateStatus',
      payload: {
        notificationId,
        status: NotificationStatus.READ
      }
    });

    // Persist change
    yield call([notificationService, 'markAsRead'], notificationId);
  } catch (error) {
    // Revert optimistic update on failure
    yield put(fetchNotifications({ page: 1, limit: BATCH_SIZE }));
    console.error('Failed to mark notification as read:', error);
  }
}

/**
 * Handles WebSocket connection and reconnection
 */
function* handleWebSocketConnection() {
  while (true) {
    try {
      const notificationService = NotificationService.getInstance();
      yield call([notificationService, 'connectWebSocket']);
      yield put(websocketConnected());

      // Keep connection alive until error occurs
      yield new Promise((_, reject) => {
        notificationService.wsConnection?.onerror = (error) => reject(error);
        notificationService.wsConnection?.onclose = () => reject(new Error('WebSocket closed'));
      });
    } catch (error) {
      yield put(websocketDisconnected());
      yield put(websocketError({ error: error.message }));
      yield delay(WEBSOCKET_RECONNECT_DELAY);
    }
  }
}

/**
 * Watcher saga for notification-related actions
 */
function* watchNotifications() {
  yield all([
    takeLatest(SEND_NOTIFICATION, handleSendNotification),
    takeLatest('notification/fetch', handleFetchNotifications),
    takeLatest(MARK_AS_READ, handleMarkAsRead),
    takeLatest(CONNECT_WEBSOCKET, handleWebSocketConnection)
  ]);
}

/**
 * Root notification saga
 */
export default function* notificationSaga() {
  yield all([
    fork(watchNotifications)
  ]);
}