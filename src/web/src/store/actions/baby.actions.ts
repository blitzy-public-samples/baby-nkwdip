/**
 * @fileoverview Redux action creators for baby profile and monitoring management
 * @version 1.0.0
 */

import { createAction, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import { Baby, BabyPreferences, BabyAnalytics } from '../../types/baby.types';
import BabyService from '../../services/baby.service';

/**
 * Action types for baby-related operations
 */
export enum BABY_ACTION_TYPES {
  // Fetch babies
  FETCH_BABIES_REQUEST = 'baby/fetchBabiesRequest',
  FETCH_BABIES_SUCCESS = 'baby/fetchBabiesSuccess',
  FETCH_BABIES_FAILURE = 'baby/fetchBabiesFailure',

  // Create baby
  CREATE_BABY_REQUEST = 'baby/createBabyRequest',
  CREATE_BABY_SUCCESS = 'baby/createBabySuccess',
  CREATE_BABY_FAILURE = 'baby/createBabyFailure',

  // Update baby
  UPDATE_BABY_REQUEST = 'baby/updateBabyRequest',
  UPDATE_BABY_SUCCESS = 'baby/updateBabySuccess',
  UPDATE_BABY_FAILURE = 'baby/updateBabyFailure',

  // Delete baby
  DELETE_BABY_REQUEST = 'baby/deleteBabyRequest',
  DELETE_BABY_SUCCESS = 'baby/deleteBabySuccess',
  DELETE_BABY_FAILURE = 'baby/deleteBabyFailure',

  // Update preferences
  UPDATE_PREFERENCES_REQUEST = 'baby/updatePreferencesRequest',
  UPDATE_PREFERENCES_SUCCESS = 'baby/updatePreferencesSuccess',
  UPDATE_PREFERENCES_FAILURE = 'baby/updatePreferencesFailure',

  // Analytics
  FETCH_ANALYTICS_REQUEST = 'baby/fetchAnalyticsRequest',
  FETCH_ANALYTICS_SUCCESS = 'baby/fetchAnalyticsSuccess',
  FETCH_ANALYTICS_FAILURE = 'baby/fetchAnalyticsFailure',

  // Monitoring
  START_MONITORING = 'baby/startMonitoring',
  STOP_MONITORING = 'baby/stopMonitoring',
  MONITORING_ERROR = 'baby/monitoringError'
}

/**
 * Fetches all babies for the current user
 */
export const fetchBabies = createAsyncThunk<Baby[], void>(
  BABY_ACTION_TYPES.FETCH_BABIES_REQUEST,
  async (_, { rejectWithValue }) => {
    try {
      const service = BabyService.getInstance();
      const babies = await service.fetchBabies();
      return babies;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Creates a new baby profile
 */
export const createBaby = createAsyncThunk<Baby, Omit<Baby, 'id'>>(
  BABY_ACTION_TYPES.CREATE_BABY_REQUEST,
  async (babyData, { rejectWithValue }) => {
    try {
      const service = BabyService.getInstance();
      const newBaby = await service.createBaby(babyData);
      return newBaby;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Updates an existing baby profile
 */
export const updateBaby = createAsyncThunk<Baby, { id: string; updates: Partial<Baby> }>(
  BABY_ACTION_TYPES.UPDATE_BABY_REQUEST,
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const service = BabyService.getInstance();
      const updatedBaby = await service.updateBaby(id, updates);
      return updatedBaby;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Deletes a baby profile
 */
export const deleteBaby = createAsyncThunk<string, string>(
  BABY_ACTION_TYPES.DELETE_BABY_REQUEST,
  async (babyId, { rejectWithValue }) => {
    try {
      const service = BabyService.getInstance();
      await service.deleteBaby(babyId);
      return babyId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Updates baby monitoring preferences
 */
export const updatePreferences = createAsyncThunk<
  { id: string; preferences: BabyPreferences },
  { id: string; preferences: BabyPreferences }
>(
  BABY_ACTION_TYPES.UPDATE_PREFERENCES_REQUEST,
  async ({ id, preferences }, { rejectWithValue }) => {
    try {
      const service = BabyService.getInstance();
      await service.updatePreferences(id, preferences);
      return { id, preferences };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetches analytics data for a baby
 */
export const fetchAnalytics = createAsyncThunk<
  { id: string; analytics: BabyAnalytics },
  { id: string; startDate?: Date; endDate?: Date }
>(
  BABY_ACTION_TYPES.FETCH_ANALYTICS_REQUEST,
  async ({ id, startDate, endDate }, { rejectWithValue }) => {
    try {
      const service = BabyService.getInstance();
      const analytics = await service.fetchAnalytics(id, { startDate, endDate });
      return { id, analytics };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Starts real-time cry monitoring for a baby
 */
export const startMonitoring = createAction<{
  id: string;
  options: {
    sensitivity: 'low' | 'medium' | 'high';
    noiseThreshold: number;
    backgroundMonitoring: boolean;
  };
}>(BABY_ACTION_TYPES.START_MONITORING);

/**
 * Stops cry monitoring for a baby
 */
export const stopMonitoring = createAction<string>(BABY_ACTION_TYPES.STOP_MONITORING);

/**
 * Action creator for monitoring errors
 */
export const monitoringError = createAction<{
  id: string;
  error: string;
}>(BABY_ACTION_TYPES.MONITORING_ERROR);