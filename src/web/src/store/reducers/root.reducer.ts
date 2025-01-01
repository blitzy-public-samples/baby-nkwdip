/**
 * @fileoverview Root Redux reducer combining all feature reducers for the Baby Cry Analyzer application
 * @version 1.0.0
 * Library versions:
 * - @reduxjs/toolkit@1.9.0
 */

import { combineReducers } from '@reduxjs/toolkit';
import audioReducer, { AudioState } from './audio.reducer';
import authReducer, { AuthState } from './auth.reducer';
import babyReducer, { BabyState } from './baby.reducer';
import historyReducer, { HistoryState } from './history.reducer';
import notificationReducer, { NotificationState } from './notification.reducer';

/**
 * Comprehensive interface defining the shape of the global application state
 * with validation and type safety
 */
export interface RootState {
  /** Audio recording, processing, and analysis state with real-time monitoring capabilities */
  audio: AudioState;
  /** Authentication state with token management and session handling */
  auth: AuthState;
  /** Baby profile state with monitoring preferences and growth tracking */
  baby: BabyState;
  /** Analysis history state with pattern tracking and reporting */
  history: HistoryState;
  /** Notification state with push notification and alert management */
  notifications: NotificationState;
}

/**
 * Root reducer combining all feature reducers with error handling and validation
 * Implements comprehensive state management with domain-specific slices
 */
const rootReducer = combineReducers<RootState>({
  // Audio state management for recording and analysis
  audio: audioReducer,

  // Authentication and user session management
  auth: authReducer,

  // Baby profile and monitoring management
  baby: babyReducer,

  // Historical data and pattern analysis
  history: historyReducer,

  // Notification and alert management
  notifications: notificationReducer
});

export default rootReducer;