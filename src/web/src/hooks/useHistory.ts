/**
 * @fileoverview Custom React hook for managing cry analysis history with enhanced visualization
 * @version 1.0.0
 */

import { useSelector, useDispatch } from 'react-redux'; // ^8.0.0
import { useCallback, useEffect, useMemo } from 'react'; // ^18.0.0
import { HistoryService } from '../services/history.service';
import { AnalysisResult } from '../types/audio.types';

/**
 * Parameters for the useHistory hook
 */
interface UseHistoryParams {
  babyId: string;
  startDate: Date;
  endDate: Date;
  pageSize: number;
  pageNumber: number;
  filterCriteria: Record<string, any>;
}

/**
 * Timeline entry for visualization
 */
interface TimelineEntry {
  date: Date;
  needType: string;
  confidence: number;
  duration: number;
  responseTime: number | null;
}

/**
 * Return type for the useHistory hook
 */
interface UseHistoryReturn {
  loading: boolean;
  error: string | null;
  records: AnalysisResult[];
  distribution: Record<string, number>;
  timelineData: TimelineEntry[];
  totalRecords: number;
  currentPage: number;
  refreshHistory: () => Promise<void>;
  exportReport: () => Promise<Blob>;
  setPage: (page: number) => void;
  setFilter: (criteria: Record<string, any>) => void;
}

/**
 * Custom hook for managing cry analysis history with enhanced visualization
 */
export const useHistory = ({
  babyId,
  startDate,
  endDate,
  pageSize = 50,
  pageNumber = 1,
  filterCriteria = {}
}: UseHistoryParams): UseHistoryReturn => {
  const dispatch = useDispatch();
  const historyService = new HistoryService();

  // Redux state selectors with memoization
  const historyState = useSelector((state: any) => state.history);
  const loading = useSelector((state: any) => state.history.loading);
  const error = useSelector((state: any) => state.history.error);

  // Memoized refresh function with error handling
  const refreshHistory = useCallback(async () => {
    try {
      const history = await historyService.getAnalysisHistory({
        babyId,
        startDate,
        endDate,
        pageSize,
        pageNumber,
        filterCriteria
      });
      dispatch({ type: 'HISTORY_LOADED', payload: history });
    } catch (err) {
      dispatch({ 
        type: 'HISTORY_ERROR', 
        payload: err instanceof Error ? err.message : 'Failed to load history'
      });
    }
  }, [babyId, startDate, endDate, pageSize, pageNumber, filterCriteria]);

  // Memoized export function with progress tracking
  const exportReport = useCallback(async () => {
    try {
      dispatch({ type: 'EXPORT_STARTED' });
      const report = await historyService.exportHistoryReport({
        babyId,
        startDate,
        endDate,
        filterCriteria
      });
      dispatch({ type: 'EXPORT_COMPLETED' });
      return report;
    } catch (err) {
      dispatch({ 
        type: 'EXPORT_ERROR', 
        payload: err instanceof Error ? err.message : 'Export failed'
      });
      throw err;
    }
  }, [babyId, startDate, endDate, filterCriteria]);

  // Pagination state handlers
  const setPage = useCallback((page: number) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  // Filter state handlers
  const setFilter = useCallback((criteria: Record<string, any>) => {
    dispatch({ type: 'SET_FILTER', payload: criteria });
  }, []);

  // Calculate pattern distribution with memoization
  const distribution = useMemo(() => {
    if (!historyState.records) return {};
    return historyState.records.reduce((acc: Record<string, number>, record: AnalysisResult) => {
      acc[record.needType] = (acc[record.needType] || 0) + 1;
      return acc;
    }, {});
  }, [historyState.records]);

  // Generate timeline visualization data
  const timelineData = useMemo(() => {
    if (!historyState.records) return [];
    return historyState.records.map((record: AnalysisResult) => ({
      date: new Date(record.timestamp),
      needType: record.needType,
      confidence: record.confidence,
      duration: record.features?.duration || 0,
      responseTime: record.analysisMetadata?.responseTime || null
    }));
  }, [historyState.records]);

  // Initial data fetch and cleanup
  useEffect(() => {
    refreshHistory();
    return () => {
      dispatch({ type: 'CLEAR_HISTORY' });
    };
  }, [babyId, startDate, endDate, pageSize, pageNumber, filterCriteria]);

  return {
    loading,
    error,
    records: historyState.records || [],
    distribution,
    timelineData,
    totalRecords: historyState.totalRecords || 0,
    currentPage: historyState.currentPage || 1,
    refreshHistory,
    exportReport,
    setPage,
    setFilter
  };
};