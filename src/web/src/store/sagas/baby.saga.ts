/**
 * @fileoverview Redux saga module for managing baby profile operations with enhanced security
 * @version 1.0.0
 */

import { takeLatest, put, call, all, fork, retry } from 'redux-saga/effects'; // ^1.2.0
import { BABY_ACTION_TYPES } from '../actions/baby.actions';
import BabyService from '../../services/baby.service';
import { Baby, BabyPreferences } from '../../types/baby.types';
import { AudioAnalysisResult } from '../../types/audio.types';
import { StorageService } from '../../services/storage.service';

// Constants for retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffRate: 1.5
};

// Constants for monitoring configuration
const MONITORING_CONFIG = {
  bufferSize: 4096,
  noiseThreshold: 0.1,
  minConfidence: 0.7,
  sessionTimeout: 300000 // 5 minutes
};

/**
 * Handles fetching all babies with secure data handling
 */
function* handleFetchBabies() {
  try {
    const babyService = BabyService.getInstance();
    const babies: Baby[] = yield retry(
      RETRY_CONFIG.maxAttempts,
      RETRY_CONFIG.delayMs,
      babyService.fetchBabies
    );

    yield put({ type: BABY_ACTION_TYPES.FETCH_BABIES_SUCCESS, payload: babies });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.FETCH_BABIES_FAILURE,
      payload: error.message
    });
  }
}

/**
 * Handles creating a new baby profile with encryption
 */
function* handleCreateBaby(action: { type: string; payload: Omit<Baby, 'id'> }) {
  try {
    const babyService = BabyService.getInstance();
    const newBaby: Baby = yield call(babyService.createBaby, action.payload);

    // Store encrypted baby data
    yield call(StorageService.getInstance().saveEncryptedData, 'baby_data', newBaby);

    yield put({
      type: BABY_ACTION_TYPES.CREATE_BABY_SUCCESS,
      payload: newBaby
    });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.CREATE_BABY_FAILURE,
      payload: error.message
    });
  }
}

/**
 * Handles updating baby profile with validation
 */
function* handleUpdateBaby(action: {
  type: string;
  payload: { id: string; updates: Partial<Baby> };
}) {
  try {
    const babyService = BabyService.getInstance();
    const updatedBaby: Baby = yield call(
      babyService.updateBaby,
      action.payload.id,
      action.payload.updates
    );

    // Update encrypted storage
    yield call(
      StorageService.getInstance().saveEncryptedData,
      `baby_data_${action.payload.id}`,
      updatedBaby
    );

    yield put({
      type: BABY_ACTION_TYPES.UPDATE_BABY_SUCCESS,
      payload: updatedBaby
    });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.UPDATE_BABY_FAILURE,
      payload: error.message
    });
  }
}

/**
 * Handles deleting baby profile with secure cleanup
 */
function* handleDeleteBaby(action: { type: string; payload: string }) {
  try {
    const babyService = BabyService.getInstance();
    yield call(babyService.deleteBaby, action.payload);

    // Clean up encrypted storage
    yield call(
      StorageService.getInstance().removeEncryptedData,
      `baby_data_${action.payload}`
    );

    yield put({
      type: BABY_ACTION_TYPES.DELETE_BABY_SUCCESS,
      payload: action.payload
    });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.DELETE_BABY_FAILURE,
      payload: error.message
    });
  }
}

/**
 * Handles starting real-time monitoring with noise filtering
 */
function* handleStartMonitoring(action: {
  type: string;
  payload: { id: string; options: { sensitivity: string; noiseThreshold: number } };
}) {
  try {
    const babyService = BabyService.getInstance();
    yield call(babyService.startMonitoring, action.payload.id);

    // Initialize monitoring session
    const monitoringSession = {
      babyId: action.payload.id,
      startTime: Date.now(),
      options: {
        ...action.payload.options,
        bufferSize: MONITORING_CONFIG.bufferSize,
        minConfidence: MONITORING_CONFIG.minConfidence
      }
    };

    yield call(
      StorageService.getInstance().saveEncryptedData,
      `monitoring_session_${action.payload.id}`,
      monitoringSession
    );

    yield put({
      type: BABY_ACTION_TYPES.START_MONITORING,
      payload: monitoringSession
    });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.MONITORING_ERROR,
      payload: { id: action.payload.id, error: error.message }
    });
  }
}

/**
 * Handles stopping monitoring with session cleanup
 */
function* handleStopMonitoring(action: { type: string; payload: string }) {
  try {
    const babyService = BabyService.getInstance();
    yield call(babyService.stopMonitoring, action.payload);

    // Clean up monitoring session
    yield call(
      StorageService.getInstance().removeEncryptedData,
      `monitoring_session_${action.payload}`
    );

    yield put({
      type: BABY_ACTION_TYPES.STOP_MONITORING,
      payload: action.payload
    });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.MONITORING_ERROR,
      payload: { id: action.payload, error: error.message }
    });
  }
}

/**
 * Handles updating baby preferences with validation
 */
function* handleUpdatePreferences(action: {
  type: string;
  payload: { id: string; preferences: BabyPreferences };
}) {
  try {
    const babyService = BabyService.getInstance();
    yield call(
      babyService.updatePreferences,
      action.payload.id,
      action.payload.preferences
    );

    yield put({
      type: BABY_ACTION_TYPES.UPDATE_PREFERENCES_SUCCESS,
      payload: action.payload
    });
  } catch (error) {
    yield put({
      type: BABY_ACTION_TYPES.UPDATE_PREFERENCES_FAILURE,
      payload: error.message
    });
  }
}

/**
 * Watches for baby-related actions
 */
function* watchBabySagas() {
  yield all([
    takeLatest(BABY_ACTION_TYPES.FETCH_BABIES_REQUEST, handleFetchBabies),
    takeLatest(BABY_ACTION_TYPES.CREATE_BABY_REQUEST, handleCreateBaby),
    takeLatest(BABY_ACTION_TYPES.UPDATE_BABY_REQUEST, handleUpdateBaby),
    takeLatest(BABY_ACTION_TYPES.DELETE_BABY_REQUEST, handleDeleteBaby),
    takeLatest(BABY_ACTION_TYPES.START_MONITORING, handleStartMonitoring),
    takeLatest(BABY_ACTION_TYPES.STOP_MONITORING, handleStopMonitoring),
    takeLatest(BABY_ACTION_TYPES.UPDATE_PREFERENCES_REQUEST, handleUpdatePreferences)
  ]);
}

export default watchBabySagas;