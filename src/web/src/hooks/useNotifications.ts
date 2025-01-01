/**
 * @fileoverview Advanced React hook for managing real-time notifications
 * @version 1.0.0
 * @license MIT
 */

import { useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0
import {
  INotification,
  NotificationType,
  NotificationPriority,
  NotificationStatus
} from '../types/notification.types';
import notificationService from '../services/notification.service';
import {
  receiveNotification,
  markAsRead,
  clearNotification,
  connectWebSocket,
  websocketConnected,
  websocketDisconnected,
  websocketError
} from '../store/actions/notification.actions';

// Constants for notification configuration
const NOTIFICATION_SOUND_URL = '/assets/sounds/notification.mp3';
const WEBSOCKET_RETRY_DELAY = 5000;
const MAX_RETRY_ATTEMPTS = 3;
const PRIORITY_QUEUE_SIZE = 100;

// Interface for notification queue item
interface QueueItem {
  notification: INotification;
  priority: NotificationPriority;
  timestamp: number;
}

/**
 * Enhanced custom hook for secure real-time notification management
 */
export function useNotifications() {
  const dispatch = useDispatch();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retryAttemptsRef = useRef<number>(0);
  const notificationQueueRef = useRef<QueueItem[]>([]);

  // Select notifications from Redux store
  const notifications = useSelector((state: any) => state.notifications.items);
  const unreadCount = useSelector((state: any) => state.notifications.unreadCount);
  const connectionStatus = useSelector((state: any) => state.notifications.websocketStatus);
  const deliveryStatus = useSelector((state: any) => state.notifications.deliveryStatus);

  /**
   * Initialize notification sound
   */
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.preload = 'auto';
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  /**
   * Initialize WebSocket connection with secure token
   */
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await notificationService.initialize();
        dispatch(connectWebSocket());
        dispatch(websocketConnected());
        retryAttemptsRef.current = 0;
      } catch (error) {
        handleWebSocketError(error);
      }
    };

    initializeWebSocket();

    return () => {
      notificationService.disconnectWebSocket();
    };
  }, [dispatch]);

  /**
   * Handle WebSocket errors and implement retry mechanism
   */
  const handleWebSocketError = useCallback((error: Error) => {
    dispatch(websocketError({ error: error.message }));
    dispatch(websocketDisconnected());

    if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
      setTimeout(async () => {
        retryAttemptsRef.current++;
        try {
          await notificationService.connectWebSocket();
          dispatch(websocketConnected());
        } catch (error) {
          handleWebSocketError(error);
        }
      }, WEBSOCKET_RETRY_DELAY);
    }
  }, [dispatch]);

  /**
   * Process notification through priority queue
   */
  const processNotificationQueue = useCallback(async () => {
    while (notificationQueueRef.current.length > 0) {
      const { notification } = notificationQueueRef.current.shift()!;
      try {
        await handleNotification(notification);
      } catch (error) {
        console.error('Failed to process notification:', error);
      }
    }
  }, []);

  /**
   * Handle incoming notification with security validation
   */
  const handleNotification = useCallback(async (notification: INotification) => {
    try {
      // Validate notification structure
      if (!notification.id || !notification.type || !notification.priority) {
        throw new Error('Invalid notification format');
      }

      // Add to priority queue if needed
      if (notificationQueueRef.current.length >= PRIORITY_QUEUE_SIZE) {
        notificationQueueRef.current = notificationQueueRef.current
          .sort((a, b) => b.priority - a.priority)
          .slice(0, PRIORITY_QUEUE_SIZE - 1);
      }

      // Dispatch to Redux store
      dispatch(receiveNotification(notification));

      // Play sound based on priority
      if (notification.priority === NotificationPriority.HIGH || 
          notification.priority === NotificationPriority.URGENT) {
        audioRef.current?.play();
      }

      // Show system notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/assets/icons/notification-icon.png'
        });
      }
    } catch (error) {
      console.error('Notification handling failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Register notification handler with service
   */
  useEffect(() => {
    const handler = async (notification: INotification) => {
      notificationQueueRef.current.push({
        notification,
        priority: notification.priority,
        timestamp: Date.now()
      });
      await processNotificationQueue();
    };

    notificationService.registerHandler(NotificationType.CRY_DETECTED, handler);
    return () => {
      notificationService.unregisterHandler(NotificationType.CRY_DETECTED, handler);
    };
  }, [processNotificationQueue]);

  /**
   * Mark notification as read with delivery tracking
   */
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      dispatch(markAsRead({ notificationId }));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, [dispatch]);

  /**
   * Clear notification with validation
   */
  const handleClearNotification = useCallback(async (notificationId: string) => {
    try {
      if (!notifications[notificationId]) {
        throw new Error('Notification not found');
      }
      dispatch(clearNotification({ notificationId }));
    } catch (error) {
      console.error('Failed to clear notification:', error);
    }
  }, [dispatch, notifications]);

  return {
    notifications,
    unreadCount,
    connectionStatus,
    deliveryStatus,
    markAsRead: handleMarkAsRead,
    clearNotification: handleClearNotification
  };
}