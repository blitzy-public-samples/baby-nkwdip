/**
 * @fileoverview Enhanced timeline visualization component for cry analysis history
 * Implements Material Design 3.0 with advanced filtering and virtualization
 * Version: 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { VirtualList } from 'react-virtualized';
import AnalysisCard from './AnalysisCard';
import { useHistory } from '../../hooks/useHistory';
import { AudioAnalysisResult } from '../../types/audio.types';

interface TimelineViewProps {
  babyId: string;
  startDate: Date;
  endDate: Date;
  onRecordPress: (record: AudioAnalysisResult) => void;
  filterCriteria: Record<string, any>;
  groupBy: 'day' | 'week' | 'month';
  locale: string;
}

interface GroupedRecords {
  date: Date;
  label: string;
  records: AudioAnalysisResult[];
}

const TimelineContainer = styled(motion.div)`
  flex: 1;
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.background};
  overflow: hidden;
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const DateHeader = styled(motion.div)`
  padding: ${props => props.theme.spacing.sm} 0;
  margin-bottom: ${props => props.theme.spacing.xs};
  border-bottom: 1px solid ${props => props.theme.colors.divider};
`;

const VirtualizedContainer = styled.div`
  height: 100%;
  width: 100%;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xl};
`;

const TimelineView: React.FC<TimelineViewProps> = ({
  babyId,
  startDate,
  endDate,
  onRecordPress,
  filterCriteria,
  groupBy = 'day',
  locale = 'en-US'
}) => {
  const {
    records,
    loading,
    error,
    loadMore,
    hasMore
  } = useHistory({
    babyId,
    startDate,
    endDate,
    pageSize: 50,
    pageNumber: 1,
    filterCriteria
  });

  const formatDate = useCallback((date: Date): string => {
    if (isToday(date)) {
      return 'Today';
    }
    if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'MMMM d, yyyy', { locale });
  }, [locale]);

  const groupedRecords = useMemo(() => {
    if (!records.length) return [];

    const groups: GroupedRecords[] = [];
    let currentGroup: GroupedRecords | null = null;

    records.sort((a, b) => b.timestamp - a.timestamp).forEach(record => {
      const recordDate = new Date(record.timestamp);
      const dateKey = format(recordDate, 
        groupBy === 'week' ? 'w-yyyy' : 
        groupBy === 'month' ? 'MM-yyyy' : 
        'dd-MM-yyyy'
      );

      if (!currentGroup || currentGroup.date.getTime() !== recordDate.getTime()) {
        currentGroup = {
          date: recordDate,
          label: formatDate(recordDate),
          records: []
        };
        groups.push(currentGroup);
      }

      currentGroup.records.push(record);
    });

    return groups;
  }, [records, groupBy, formatDate]);

  const renderRow = useCallback(({ index, style }) => {
    const group = groupedRecords[index];
    if (!group) return null;

    return (
      <div style={style}>
        <DateHeader
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {group.label}
        </DateHeader>
        <AnimatePresence>
          {group.records.map((record, recordIndex) => (
            <motion.div
              key={record.timestamp}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, delay: recordIndex * 0.05 }}
            >
              <AnalysisCard
                analysis={record}
                onPress={() => onRecordPress(record)}
                testID={`timeline-record-${record.timestamp}`}
                accessibilityLabel={`Cry analysis from ${formatDistanceToNow(record.timestamp)} ago`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }, [groupedRecords, onRecordPress]);

  const handleScroll = useCallback(({ scrollTop, scrollHeight, clientHeight }) => {
    if (!loading && hasMore && scrollHeight - scrollTop <= clientHeight * 1.5) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  if (error) {
    return (
      <EmptyState>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          Error loading timeline: {error}
        </motion.p>
      </EmptyState>
    );
  }

  return (
    <TimelineContainer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      role="region"
      aria-label="Cry analysis timeline"
    >
      {records.length > 0 ? (
        <VirtualizedContainer>
          <VirtualList
            width="100%"
            height={window.innerHeight - 200}
            rowCount={groupedRecords.length}
            rowHeight={150}
            rowRenderer={renderRow}
            onScroll={handleScroll}
            overscanRowCount={3}
          />
        </VirtualizedContainer>
      ) : (
        <EmptyState>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {loading ? 'Loading timeline...' : 'No analysis records found'}
          </motion.p>
        </EmptyState>
      )}
    </TimelineContainer>
  );
};

export default TimelineView;