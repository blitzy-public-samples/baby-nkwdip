/**
 * @fileoverview Redux saga module for managing cry analysis history operations
 * @version 1.0.0
 */

import { takeLatest, put, call, select, delay, retry } from 'redux-saga/effects'; // ^1.2.0
import { PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { HistoryService } from '../../services/history.service';
import { 
  Baby, 
  PatternHistory, 
  CryPattern, 
  BabyAnalytics,
  TimeDistribution,
  PatternProgression,
  UserResponseStats 
} from '../../types/baby.types';
import { AudioAnalysisResult } from '../../types/audio.types';

// Constants for history management
const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 50;

// Action types
const FETCH_HISTORY = 'history/fetchHistory';
const UPDATE_PATTERN_DISTRIBUTION = 'history/updatePatternDistribution';
const ENFORCE_RETENTION = 'history/enforceRetention';
const ANALYZE_TRENDS = 'history/analyzeTrends';

// Types
interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface FetchOptions {
  includeAnalytics?: boolean;
  forceFetch?: boolean;
  batchSize?: number;
}

interface AnalyticsMetadata {
  confidenceThreshold?: number;
  includeEnvironmentalFactors?: boolean;
}

/**
 * Saga for fetching cry analysis history with enhanced error handling and caching
 */
function* fetchHistorySaga(
  action: PayloadAction<{
    babyId: string;
    dateRange: DateRange;
    options?: FetchOptions;
  }>
) {
  const { babyId, dateRange, options = {} } = action.payload;
  const historyService = new HistoryService();

  try {
    // Validate date range and enforce retention policy
    yield call([historyService, historyService.validateDateRange], dateRange);

    // Fetch history with retry mechanism
    const history: PatternHistory = yield retry(
      RETRY_COUNT,
      RETRY_DELAY,
      function* () {
        return yield call(
          [historyService, historyService.getHistory],
          babyId,
          dateRange,
          { page: 1, limit: options.batchSize || BATCH_SIZE }
        );
      }
    );

    // Fetch analytics if requested
    let analytics: BabyAnalytics | null = null;
    if (options.includeAnalytics) {
      analytics = yield call(
        [historyService, historyService.getAnalytics],
        babyId,
        { timeframe: dateRange }
      );
    }

    // Update pattern distribution
    yield put({
      type: UPDATE_PATTERN_DISTRIBUTION,
      payload: {
        patterns: history.patterns,
        analytics,
        timeDistribution: history.timeDistribution,
        confidenceAverage: history.confidenceAverage
      }
    });

    // Enforce retention policy
    yield put({
      type: ENFORCE_RETENTION,
      payload: { babyId }
    });

  } catch (error) {
    console.error('Error fetching history:', error);
    yield put({
      type: 'history/fetchHistoryError',
      payload: error instanceof Error ? error.message : 'Failed to fetch history'
    });
  }
}

/**
 * Saga for updating pattern distribution with trend analysis
 */
function* updatePatternDistributionSaga(
  action: PayloadAction<PatternHistory & AnalyticsMetadata>
) {
  const { patterns, confidenceThreshold = 0.7 } = action.payload;
  const historyService = new HistoryService();

  try {
    // Calculate pattern distribution
    const distribution = yield call(
      [historyService, historyService.getAnalytics],
      patterns,
      { confidenceThreshold }
    );

    // Analyze trends
    yield put({
      type: ANALYZE_TRENDS,
      payload: {
        distribution,
        patterns,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Error updating pattern distribution:', error);
    yield put({
      type: 'history/updatePatternDistributionError',
      payload: error instanceof Error ? error.message : 'Failed to update pattern distribution'
    });
  }
}

/**
 * Saga for enforcing data retention policy
 */
function* enforceRetentionPolicySaga(
  action: PayloadAction<{ babyId: string }>
) {
  const { babyId } = action.payload;
  const historyService = new HistoryService();

  try {
    yield call([historyService, historyService.enforceRetentionPolicy], babyId);
  } catch (error) {
    console.error('Error enforcing retention policy:', error);
    yield put({
      type: 'history/enforceRetentionError',
      payload: error instanceof Error ? error.message : 'Failed to enforce retention policy'
    });
  }
}

/**
 * Root saga that combines all history-related sagas
 */
export default function* watchHistorySagas() {
  yield takeLatest(FETCH_HISTORY, fetchHistorySaga);
  yield takeLatest(UPDATE_PATTERN_DISTRIBUTION, updatePatternDistributionSaga);
  yield takeLatest(ENFORCE_RETENTION, enforceRetentionPolicySaga);
}