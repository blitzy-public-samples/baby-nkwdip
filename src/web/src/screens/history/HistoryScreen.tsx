/**
 * @fileoverview History analysis screen component with interactive visualizations
 * Implements Material Design 3.0 principles and WCAG 2.1 AA accessibility
 * Version: 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import styled from 'styled-components'; // ^5.3.0
import { useRoute } from '@react-navigation/native'; // ^6.0.0
import { useIntersectionObserver } from '@react-aria/interactions'; // ^3.0.0

import HistoryChart from '../../components/history/HistoryChart';
import HistoryFilter from '../../components/history/HistoryFilter';
import { useHistory } from '../../hooks/useHistory';
import Loading from '../../components/common/Loading';
import Text from '../../components/common/Text';
import { CryType } from '../../types/baby.types';

// Styled components for layout and responsiveness
const ResponsiveContainer = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.md};
  max-width: 1200px;
  margin: 0 auto;
  background-color: ${({ theme }) => theme.colors.background};

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const ChartSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  background-color: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.components.card.borderRadius};
  padding: ${({ theme }) => theme.spacing.md};
  box-shadow: ${({ theme }) => theme.elevation.low};
`;

const FilterSection = styled.section`
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const TimelineSection = styled.section`
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const ErrorMessage = styled(Text)`
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  padding: ${({ theme }) => theme.spacing.md};
`;

const LoadMoreButton = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
  background-color: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.surface};
  border: none;
  border-radius: ${({ theme }) => theme.components.button.borderRadius};
  cursor: pointer;
  transition: opacity ${({ theme }) => theme.animation.duration.fast} ${({ theme }) => theme.animation.easing.standard};

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// Default filter values
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_CONFIDENCE_THRESHOLD = 70;

interface FilterState {
  startDate: Date;
  endDate: Date;
  patterns: CryType[];
  confidenceThreshold: number;
  page: number;
  pageSize: number;
}

const HistoryScreen: React.FC = () => {
  const route = useRoute();
  const babyId = route.params?.babyId as string;

  // State management
  const [filters, setFilters] = useState<FilterState>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: new Date(),
    patterns: Object.values(CryType),
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // Custom hooks for data management
  const {
    loading,
    error,
    records,
    distribution,
    timelineData,
    totalRecords,
    refreshHistory,
    exportReport,
  } = useHistory({
    babyId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    pageSize: filters.pageSize,
    pageNumber: filters.page,
    filterCriteria: {
      patterns: filters.patterns,
      confidenceThreshold: filters.confidenceThreshold,
    },
  });

  // Infinite scroll implementation
  const { ref: loadMoreRef } = useIntersectionObserver({
    onIntersect: async (entries) => {
      const target = entries[0];
      if (target.isIntersecting && !loading && records.length < totalRecords) {
        setFilters(prev => ({ ...prev, page: prev.page + 1 }));
      }
    },
    threshold: 0.5,
  });

  // Filter change handler with debouncing
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset pagination on filter change
    }));
  }, []);

  // Pattern selection handler
  const handlePatternSelect = useCallback((pattern: CryType) => {
    setFilters(prev => ({
      ...prev,
      patterns: prev.patterns.includes(pattern)
        ? prev.patterns.filter(p => p !== pattern)
        : [...prev.patterns, pattern],
    }));
  }, []);

  // Export handler
  const handleExport = useCallback(async () => {
    try {
      const report = await exportReport();
      const url = window.URL.createObjectURL(report);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cry-analysis-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportReport]);

  // Memoized chart data
  const chartData = useMemo(() => ({
    labels: Object.keys(distribution),
    datasets: [{
      data: Object.values(distribution),
      backgroundColor: Object.keys(distribution).map(
        key => theme.colors.monitor[`confidence${key}`]
      ),
    }],
  }), [distribution]);

  if (error) {
    return (
      <ResponsiveContainer>
        <ErrorMessage variant="body">
          Error loading history: {error.message}
        </ErrorMessage>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <Text variant="h1" accessibilityRole="heading" level={1}>
        Cry Pattern History
      </Text>

      <FilterSection>
        <HistoryFilter
          babyId={babyId}
          onFilterChange={handleFilterChange}
          initialStartDate={filters.startDate}
          initialEndDate={filters.endDate}
          defaultConfidence={filters.confidenceThreshold}
        />
      </FilterSection>

      <ChartSection>
        <Text variant="h2" accessibilityRole="heading" level={2}>
          Pattern Distribution
        </Text>
        <HistoryChart
          babyId={babyId}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onPatternSelect={handlePatternSelect}
        />
      </ChartSection>

      <TimelineSection>
        <Text variant="h2" accessibilityRole="heading" level={2}>
          Analysis Timeline
        </Text>
        {loading && <Loading size="large" text="Loading history..." />}
        
        {timelineData.map((record, index) => (
          <div
            key={record.id}
            ref={index === timelineData.length - 1 ? loadMoreRef : undefined}
            role="article"
          >
            {/* Timeline entry content */}
            <Text variant="body">
              {format(record.date, 'PPpp')} - {record.needType}
              ({Math.round(record.confidence * 100)}% confidence)
            </Text>
          </div>
        ))}

        {!loading && records.length < totalRecords && (
          <LoadMoreButton
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={loading}
          >
            Load More
          </LoadMoreButton>
        )}
      </TimelineSection>
    </ResponsiveContainer>
  );
};

export default HistoryScreen;