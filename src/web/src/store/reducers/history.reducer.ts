import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import {
  fetchHistoryRequest,
  fetchHistorySuccess,
  fetchHistoryFailure,
  updatePatternDistribution,
  updateTimelineData,
  clearHistory
} from '../actions/history.actions';
import {
  PatternHistory,
  BabyAnalytics,
  CryPattern,
  TimeDistribution,
  PatternTrends,
  CryType
} from '../../types/baby.types';

// Constants for retention and validation
const RETENTION_PERIOD_DAYS = 90;
const CLEANUP_INTERVAL_HOURS = 24;
const VALIDATION_THRESHOLD = 0.7;

// Types for history state management
interface HistoryError {
  code: string;
  message: string;
  timestamp: string;
}

interface TimelineEntry {
  id: string;
  timestamp: Date;
  type: CryType;
  confidence: number;
}

interface RetentionConfig {
  periodDays: number;
  lastCleanup: Date;
  retentionEndDate: Date;
}

interface ValidationStatus {
  isValid: boolean;
  lastValidated: Date;
  errorCount: number;
  validationMessage?: string;
}

interface CacheStatus {
  lastUpdated: Date;
  isStale: boolean;
  pendingUpdates: number;
}

// Define the history state interface
export interface HistoryState {
  history: PatternHistory | null;
  loading: boolean;
  error: HistoryError | null;
  patternDistribution: Record<string, number>;
  timelineData: TimelineEntry[];
  retentionConfig: RetentionConfig;
  validationStatus: ValidationStatus;
  lastCleanup: Date;
  cacheStatus: CacheStatus;
}

// Initial state with retention and validation configuration
const initialState: HistoryState = {
  history: null,
  loading: false,
  error: null,
  patternDistribution: {},
  timelineData: [],
  retentionConfig: {
    periodDays: RETENTION_PERIOD_DAYS,
    lastCleanup: new Date(),
    retentionEndDate: new Date(Date.now() + RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  },
  validationStatus: {
    isValid: true,
    lastValidated: new Date(),
    errorCount: 0
  },
  lastCleanup: new Date(),
  cacheStatus: {
    lastUpdated: new Date(),
    isStale: false,
    pendingUpdates: 0
  }
};

// Create the history reducer with enhanced retention and validation
export const historyReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(fetchHistoryRequest, (state, action) => {
      state.loading = true;
      state.error = null;
      state.cacheStatus.pendingUpdates++;
    })
    .addCase(fetchHistorySuccess, (state, action: PayloadAction<{
      history: PatternHistory;
      analytics: BabyAnalytics;
    }>) => {
      const { history, analytics } = action.payload;
      
      // Validate data against retention policy
      const retentionEndDate = new Date(Date.now() - RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      const validPatterns = history.patterns.filter(pattern => 
        new Date(pattern.timestamp) > retentionEndDate &&
        pattern.confidence >= VALIDATION_THRESHOLD
      );

      state.history = {
        ...history,
        patterns: validPatterns,
        lastUpdated: new Date(),
        confidenceAverage: validPatterns.reduce((sum, p) => sum + p.confidence, 0) / validPatterns.length
      };

      state.loading = false;
      state.cacheStatus = {
        lastUpdated: new Date(),
        isStale: false,
        pendingUpdates: Math.max(0, state.cacheStatus.pendingUpdates - 1)
      };

      // Update validation status
      state.validationStatus = {
        isValid: true,
        lastValidated: new Date(),
        errorCount: 0
      };
    })
    .addCase(fetchHistoryFailure, (state, action: PayloadAction<{ error: HistoryError }>) => {
      state.loading = false;
      state.error = action.payload.error;
      state.validationStatus = {
        ...state.validationStatus,
        isValid: false,
        errorCount: state.validationStatus.errorCount + 1,
        validationMessage: action.payload.error.message
      };
      state.cacheStatus.pendingUpdates = Math.max(0, state.cacheStatus.pendingUpdates - 1);
    })
    .addCase(updatePatternDistribution, (state, action: PayloadAction<{
      distribution: Record<string, number>;
    }>) => {
      state.patternDistribution = action.payload.distribution;
    })
    .addCase(updateTimelineData, (state, action: PayloadAction<{
      timelineData: TimelineEntry[];
    }>) => {
      // Filter timeline data within retention period
      const retentionEndDate = new Date(Date.now() - RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      state.timelineData = action.payload.timelineData.filter(entry => 
        new Date(entry.timestamp) > retentionEndDate
      );
    })
    .addCase(clearHistory, (state) => {
      state.history = null;
      state.patternDistribution = {};
      state.timelineData = [];
      state.lastCleanup = new Date();
      state.cacheStatus = {
        lastUpdated: new Date(),
        isStale: false,
        pendingUpdates: 0
      };
      state.validationStatus = {
        isValid: true,
        lastValidated: new Date(),
        errorCount: 0
      };
    });
});

export default historyReducer;