/**
 * @fileoverview Redux reducer for baby profile and monitoring state management
 * @version 1.0.0
 */

import { createReducer } from '@reduxjs/toolkit'; // ^1.9.5
import { Baby, BabyPreferences, BabyAnalytics, PatternData, MonitoringSession } from '../../types/baby.types';
import { BABY_ACTION_TYPES } from '../actions/baby.actions';

/**
 * Interface defining the shape of the baby reducer state
 */
export interface BabyState {
  babies: Baby[];
  selectedBaby: Baby | null;
  analytics: Record<string, BabyAnalytics>;
  patternLearning: Record<string, PatternData>;
  monitoringSessions: Record<string, MonitoringSession>;
  loading: boolean;
  error: string | null;
  isMonitoring: boolean;
}

/**
 * Initial state with type safety
 */
const initialState: BabyState = {
  babies: [],
  selectedBaby: null,
  analytics: {},
  patternLearning: {},
  monitoringSessions: {},
  loading: false,
  error: null,
  isMonitoring: false
};

/**
 * Baby reducer with comprehensive state management
 */
export const babyReducer = createReducer(initialState, (builder) => {
  builder
    // Fetch babies
    .addCase(BABY_ACTION_TYPES.FETCH_BABIES_REQUEST, (state) => {
      state.loading = true;
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.FETCH_BABIES_SUCCESS, (state, action) => {
      state.loading = false;
      state.babies = action.payload.map(baby => ({
        ...baby,
        preferences: {
          ...baby.preferences,
          monitoringEnabled: baby.preferences.monitoringEnabled ?? false,
          notificationsEnabled: baby.preferences.notificationsEnabled ?? true
        }
      }));
    })
    .addCase(BABY_ACTION_TYPES.FETCH_BABIES_FAILURE, (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.babies = [];
    })

    // Create baby
    .addCase(BABY_ACTION_TYPES.CREATE_BABY_SUCCESS, (state, action) => {
      state.babies.push(action.payload);
      state.selectedBaby = action.payload;
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.CREATE_BABY_FAILURE, (state, action) => {
      state.error = action.payload;
    })

    // Update baby
    .addCase(BABY_ACTION_TYPES.UPDATE_BABY_SUCCESS, (state, action) => {
      const index = state.babies.findIndex(baby => baby.id === action.payload.id);
      if (index !== -1) {
        state.babies[index] = action.payload;
        if (state.selectedBaby?.id === action.payload.id) {
          state.selectedBaby = action.payload;
        }
      }
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.UPDATE_BABY_FAILURE, (state, action) => {
      state.error = action.payload;
    })

    // Delete baby
    .addCase(BABY_ACTION_TYPES.DELETE_BABY_SUCCESS, (state, action) => {
      state.babies = state.babies.filter(baby => baby.id !== action.payload);
      if (state.selectedBaby?.id === action.payload) {
        state.selectedBaby = null;
      }
      delete state.analytics[action.payload];
      delete state.patternLearning[action.payload];
      delete state.monitoringSessions[action.payload];
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.DELETE_BABY_FAILURE, (state, action) => {
      state.error = action.payload;
    })

    // Update preferences
    .addCase(BABY_ACTION_TYPES.UPDATE_PREFERENCES_SUCCESS, (state, action) => {
      const { id, preferences } = action.payload;
      const baby = state.babies.find(b => b.id === id);
      if (baby) {
        baby.preferences = {
          ...baby.preferences,
          ...preferences
        };
        if (state.selectedBaby?.id === id) {
          state.selectedBaby = { ...baby };
        }
      }
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.UPDATE_PREFERENCES_FAILURE, (state, action) => {
      state.error = action.payload;
    })

    // Analytics management
    .addCase(BABY_ACTION_TYPES.FETCH_ANALYTICS_SUCCESS, (state, action) => {
      const { id, analytics } = action.payload;
      state.analytics[id] = {
        ...analytics,
        patternProgression: analytics.patternProgression.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.FETCH_ANALYTICS_FAILURE, (state, action) => {
      state.error = action.payload;
    })

    // Monitoring session management
    .addCase(BABY_ACTION_TYPES.START_MONITORING, (state, action) => {
      const { id, options } = action.payload;
      state.isMonitoring = true;
      state.monitoringSessions[id] = {
        startTime: Date.now(),
        options,
        patterns: [],
        noiseLevel: 0
      };
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.STOP_MONITORING, (state, action) => {
      const babyId = action.payload;
      state.isMonitoring = false;
      delete state.monitoringSessions[babyId];
      state.error = null;
    })
    .addCase(BABY_ACTION_TYPES.MONITORING_ERROR, (state, action) => {
      const { id, error } = action.payload;
      state.error = error;
      state.isMonitoring = false;
      delete state.monitoringSessions[id];
    });
});

export default babyReducer;