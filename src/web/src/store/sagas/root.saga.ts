/**
 * @fileoverview Root saga module that combines and orchestrates all Redux sagas
 * with enhanced error boundaries, monitoring, and security validations
 * @version 1.0.0
 * Library versions:
 * - redux-saga: ^1.2.0
 * - winston: ^3.8.0
 */

import { all, fork, call, spawn } from 'redux-saga/effects';
import { logger } from 'winston';

// Import feature-specific sagas
import { audioSaga } from './audio.saga';
import { watchAuth } from './auth.saga';
import { watchBabySagas } from './baby.saga';

// Saga monitoring configuration
const SAGA_MONITOR_CONFIG = {
  enableLogging: true,
  performanceThreshold: 1000 // milliseconds
};

/**
 * Creates an error boundary for saga error handling
 * @param saga Saga generator to wrap with error handling
 */
function* createErrorBoundary(saga: () => Generator): Generator {
  while (true) {
    try {
      yield call(saga);
      break;
    } catch (error) {
      logger.error('Saga error caught in boundary:', {
        saga: saga.name,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // Allow saga to restart after error
      yield call(delay, 1000);
    }
  }
}

/**
 * Utility function to handle proper cleanup of running sagas
 * @param sagaTasks Array of saga tasks to cleanup
 */
async function cleanupSagas(sagaTasks: Task[]): Promise<void> {
  try {
    // Cancel all running saga tasks
    for (const task of sagaTasks) {
      if (task.isRunning()) {
        task.cancel();
        await task.toPromise();
      }
    }

    logger.info('Saga cleanup completed successfully');
  } catch (error) {
    logger.error('Error during saga cleanup:', error);
  }
}

/**
 * Monitors saga performance and logs slow operations
 * @param saga Saga generator to monitor
 */
function* monitorSagaPerformance(saga: () => Generator): Generator {
  const startTime = Date.now();
  
  try {
    yield call(saga);
  } finally {
    const duration = Date.now() - startTime;
    
    if (duration > SAGA_MONITOR_CONFIG.performanceThreshold) {
      logger.warn('Slow saga operation detected:', {
        saga: saga.name,
        duration,
        threshold: SAGA_MONITOR_CONFIG.performanceThreshold
      });
    }
  }
}

/**
 * Root saga that combines all feature-specific sagas with error handling,
 * monitoring, and cleanup capabilities
 */
export function* rootSaga(): Generator {
  try {
    // Initialize saga monitoring
    if (SAGA_MONITOR_CONFIG.enableLogging) {
      logger.info('Initializing saga monitoring');
    }

    // Create monitored and error-bounded sagas
    const sagas = [
      // Authentication saga with error boundary
      spawn(function* authSaga() {
        yield call(createErrorBoundary, watchAuth);
      }),

      // Audio processing saga with performance monitoring
      spawn(function* monitoredAudioSaga() {
        yield call(monitorSagaPerformance, audioSaga);
      }),

      // Baby profile management sagas with error boundary
      spawn(function* babySaga() {
        yield call(createErrorBoundary, watchBabySagas);
      })
    ];

    // Combine all sagas with monitoring
    yield all(sagas);

    logger.info('Root saga initialized successfully');
  } catch (error) {
    logger.error('Critical error in root saga:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Attempt cleanup on critical error
    yield call(cleanupSagas, sagas);
    throw error;
  }
}

/**
 * Utility function for saga timing
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export root saga for Redux middleware configuration
export default rootSaga;