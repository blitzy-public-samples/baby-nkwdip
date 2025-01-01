import { createAction } from '@reduxjs/toolkit'; // ^1.9.0
import { ThunkAction } from 'redux-thunk'; // ^2.4.0
import { trace, SpanStatusCode } from '@opentelemetry/api'; // ^1.0.0

import { HistoryService } from '../../services/history.service';
import {
  PatternHistory,
  BabyAnalytics,
  CryPattern,
  TimelineEntry,
  DateRange,
  HistoryError
} from '../../types/baby.types';

// Action Types
const FETCH_HISTORY_REQUEST = 'history/fetchRequest';
const FETCH_HISTORY_SUCCESS = 'history/fetchSuccess';
const FETCH_HISTORY_FAILURE = 'history/fetchFailure';
const UPDATE_PATTERN_DISTRIBUTION = 'history/updatePatternDistribution';
const UPDATE_TIMELINE_DATA = 'history/updateTimelineData';
const CLEAR_HISTORY = 'history/clear';

// Action Creators
export const fetchHistoryRequest = createAction<{
  babyId: string;
  dateRange: DateRange;
}>(FETCH_HISTORY_REQUEST);

export const fetchHistorySuccess = createAction<{
  history: PatternHistory;
  analytics: BabyAnalytics;
}>(FETCH_HISTORY_SUCCESS);

export const fetchHistoryFailure = createAction<{
  error: HistoryError;
}>(FETCH_HISTORY_FAILURE);

export const updatePatternDistribution = createAction<{
  distribution: Record<string, number>;
}>(UPDATE_PATTERN_DISTRIBUTION);

export const updateTimelineData = createAction<{
  timelineData: TimelineEntry[];
}>(UPDATE_TIMELINE_DATA);

export const clearHistory = createAction(CLEAR_HISTORY);

// Thunk Actions
export const fetchHistory = (
  babyId: string,
  dateRange: DateRange
): ThunkAction<Promise<void>, any, any, any> => {
  return async (dispatch, getState) => {
    const tracer = trace.getTracer('history-actions');
    
    return tracer.startActiveSpan('fetchHistory', async (span) => {
      try {
        // Dispatch request action
        dispatch(fetchHistoryRequest({ babyId, dateRange }));

        // Create history service instance
        const historyService = new HistoryService();

        // Validate date range against 90-day retention policy
        historyService.validateDateRange(dateRange);

        // Fetch history data with retry mechanism
        const history = await historyService.getHistory(babyId, dateRange);

        // Get analytics data for enhanced insights
        const analytics = await historyService.getAnalytics(babyId, {
          timeframe: dateRange,
          includeEnvironmentalFactors: true,
          confidenceThreshold: 0.7
        });

        // Dispatch success action with processed data
        dispatch(fetchHistorySuccess({ history, analytics }));

        // Update pattern distribution
        dispatch(updatePatternDistribution({
          distribution: analytics.patternDistribution
        }));

        // Update timeline data
        dispatch(updateTimelineData({
          timelineData: history.patterns.map(pattern => ({
            id: pattern.id,
            timestamp: pattern.timestamp,
            type: pattern.type,
            confidence: pattern.confidence
          }))
        }));

        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        // Handle specific error types
        const historyError: HistoryError = {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'An unknown error occurred',
          timestamp: new Date().toISOString()
        };

        // Dispatch failure action
        dispatch(fetchHistoryFailure({ error: historyError }));

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: historyError.message
        });

        throw error;
      } finally {
        span.end();
      }
    });
  };
};

// Export all actions
export const historyActions = {
  fetchHistory,
  updatePatternDistribution,
  updateTimelineData,
  clearHistory
};