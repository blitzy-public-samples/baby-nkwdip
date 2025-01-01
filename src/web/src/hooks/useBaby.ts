/**
 * @fileoverview Enhanced custom hook for managing baby profile operations with security and analytics
 * @version 1.0.0
 */

import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { useCallback, useEffect, useRef } from 'react'; // ^18.2.0
import { debounce } from 'lodash'; // ^4.17.21

import {
  Baby,
  CreateBabyPayload,
  UpdateBabyPayload,
  BabyPreferences,
  BabyAnalytics,
  BabyError
} from '../types/baby.types';

import {
  fetchBabiesRequest,
  createBabyRequest,
  updateBabyRequest,
  deleteBabyRequest,
  updatePreferencesRequest,
  fetchAnalyticsRequest,
  retryRequest
} from '../store/actions/baby.actions';

// Cache duration for analytics data (15 minutes)
const ANALYTICS_CACHE_DURATION = 15 * 60 * 1000;

// Debounce delay for preference updates (500ms)
const PREFERENCE_UPDATE_DELAY = 500;

/**
 * Result type for async operations
 */
type Result<T> = {
  data?: T;
  error?: BabyError;
};

/**
 * Enhanced custom hook for managing baby profiles with security and analytics
 */
export function useBaby() {
  const dispatch = useDispatch();
  
  // Refs for cleanup and memory management
  const analyticsCache = useRef<Map<string, { data: BabyAnalytics; timestamp: number }>>(
    new Map()
  );
  const cleanupRef = useRef<boolean>(false);

  // Select baby profiles and loading state from Redux store
  const babies = useSelector((state: any) => state.baby.babies);
  const loading = useSelector((state: any) => state.baby.loading);
  const error = useSelector((state: any) => state.baby.error);

  /**
   * Validates analytics cache freshness
   */
  const isAnalyticsCacheValid = useCallback((babyId: string): boolean => {
    const cached = analyticsCache.current.get(babyId);
    if (!cached) return false;
    return Date.now() - cached.timestamp < ANALYTICS_CACHE_DURATION;
  }, []);

  /**
   * Fetches all baby profiles with error handling
   */
  const fetchBabies = useCallback(async (): Promise<Result<Baby[]>> => {
    try {
      const result = await dispatch(fetchBabiesRequest());
      return { data: result.payload };
    } catch (error) {
      return { error: error as BabyError };
    }
  }, [dispatch]);

  /**
   * Creates a new baby profile with validation
   */
  const createBaby = useCallback(async (data: CreateBabyPayload): Promise<Result<Baby>> => {
    try {
      if (!data.name || !data.birthDate) {
        throw new Error('Invalid baby data');
      }
      const result = await dispatch(createBabyRequest(data));
      return { data: result.payload };
    } catch (error) {
      return { error: error as BabyError };
    }
  }, [dispatch]);

  /**
   * Updates baby profile with optimistic updates
   */
  const updateBaby = useCallback(async (
    id: string,
    data: UpdateBabyPayload
  ): Promise<Result<Baby>> => {
    try {
      const result = await dispatch(updateBabyRequest({ id, updates: data }));
      return { data: result.payload };
    } catch (error) {
      return { error: error as BabyError };
    }
  }, [dispatch]);

  /**
   * Deletes baby profile with confirmation
   */
  const deleteBaby = useCallback(async (id: string): Promise<Result<void>> => {
    try {
      await dispatch(deleteBabyRequest(id));
      return {};
    } catch (error) {
      return { error: error as BabyError };
    }
  }, [dispatch]);

  /**
   * Updates baby preferences with debouncing
   */
  const updatePreferences = useCallback(
    debounce(async (
      id: string,
      preferences: Partial<BabyPreferences>
    ): Promise<Result<Baby>> => {
      try {
        const result = await dispatch(
          updatePreferencesRequest({ id, preferences: preferences as BabyPreferences })
        );
        return { data: result.payload };
      } catch (error) {
        return { error: error as BabyError };
      }
    }, PREFERENCE_UPDATE_DELAY),
    [dispatch]
  );

  /**
   * Fetches baby analytics with caching
   */
  const fetchAnalytics = useCallback(async (id: string): Promise<Result<BabyAnalytics>> => {
    try {
      // Check cache first
      if (isAnalyticsCacheValid(id)) {
        const cached = analyticsCache.current.get(id);
        if (cached) {
          return { data: cached.data };
        }
      }

      const result = await dispatch(fetchAnalyticsRequest({ id }));
      
      // Update cache
      analyticsCache.current.set(id, {
        data: result.payload.analytics,
        timestamp: Date.now()
      });

      return { data: result.payload.analytics };
    } catch (error) {
      return { error: error as BabyError };
    }
  }, [dispatch, isAnalyticsCacheValid]);

  /**
   * Retries failed operations
   */
  const retryOperation = useCallback(async (operationId: string): Promise<Result<unknown>> => {
    try {
      const result = await dispatch(retryRequest(operationId));
      return { data: result.payload };
    } catch (error) {
      return { error: error as BabyError };
    }
  }, [dispatch]);

  /**
   * Clears analytics cache
   */
  const clearCache = useCallback((): void => {
    analyticsCache.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current = true;
      clearCache();
    };
  }, [clearCache]);

  return {
    babies,
    loading,
    error,
    fetchBabies,
    createBaby,
    updateBaby,
    deleteBaby,
    updatePreferences,
    fetchAnalytics,
    retryOperation,
    clearCache
  };
}