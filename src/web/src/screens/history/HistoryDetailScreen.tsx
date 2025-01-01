/**
 * @fileoverview Enhanced history detail screen component with Material Design 3.0
 * Implements comprehensive cry analysis visualization with accessibility
 * Version: 1.0.0
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { View, ScrollView, SafeAreaView, VirtualizedList } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '@react-navigation/native';
import AnalysisCard from '../../components/history/AnalysisCard';
import TimelineView from '../../components/history/TimelineView';
import { useHistory } from '../../hooks/useHistory';
import { AudioAnalysisResult } from '../../types/audio.types';

// Styled components with enhanced Material Design and accessibility
const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${props => props.theme.colors.background};
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Content = styled(VirtualizedList)`
  flex: 1;
  padding: ${props => props.theme.spacing.medium};
  
  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const Section = styled(View)`
  margin-vertical: ${props => props.theme.spacing.medium};
  border-radius: ${props => props.theme.borderRadius.medium};
  background-color: ${props => props.theme.colors.surface};
  padding: ${props => props.theme.spacing.medium};
  elevation: ${props => props.theme.elevation.small};
  
  @media (prefers-color-scheme: dark) {
    background-color: ${props => props.theme.colors.surfaceDark};
  }
`;

interface HistoryDetailScreenProps {
  route: {
    params: {
      analysisId: string;
      babyId: string;
      date: string;
    };
  };
}

const HistoryDetailScreen: React.FC<HistoryDetailScreenProps> = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { theme, isDarkMode } = useTheme();
  
  // Extract route parameters with validation
  const { analysisId, babyId, date } = useMemo(() => {
    const params = route.params as { analysisId: string; babyId: string; date: string };
    if (!params?.analysisId || !params?.babyId || !params?.date) {
      throw new Error('Invalid route parameters');
    }
    return params;
  }, [route.params]);

  // Initialize history hook with date range
  const {
    records,
    loading,
    error,
    distribution,
    timelineData,
    refreshHistory,
    exportReport
  } = useHistory({
    babyId,
    startDate: new Date(date),
    endDate: new Date(date),
    pageSize: 50,
    pageNumber: 1,
    filterCriteria: {}
  });

  // Find current analysis record
  const currentAnalysis = useMemo(() => {
    return records.find(record => record.timestamp.toString() === analysisId);
  }, [records, analysisId]);

  // Handle record selection
  const handleRecordPress = useCallback((record: AudioAnalysisResult) => {
    navigation.setParams({ analysisId: record.timestamp.toString() });
  }, [navigation]);

  // Setup screen focus behavior
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshHistory();
    });
    return unsubscribe;
  }, [navigation, refreshHistory]);

  // Handle export functionality
  const handleExport = useCallback(async () => {
    try {
      const report = await exportReport();
      // Implement export handling
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [exportReport]);

  if (error) {
    return (
      <Container>
        <Section
          accessibilityRole="alert"
          accessibilityLabel="Error loading analysis details"
        >
          <Text>Error: {error}</Text>
        </Section>
      </Container>
    );
  }

  return (
    <Container>
      <Content
        data={records}
        keyExtractor={(item: AudioAnalysisResult) => item.timestamp.toString()}
        renderItem={({ item }: { item: AudioAnalysisResult }) => (
          <AnalysisCard
            analysis={item}
            onPress={() => handleRecordPress(item)}
            isHighlighted={item.timestamp.toString() === analysisId}
            testID={`analysis-card-${item.timestamp}`}
            accessibilityLabel={`Cry analysis from ${new Date(item.timestamp).toLocaleString()}`}
          />
        )}
        ListHeaderComponent={
          <Section>
            {currentAnalysis && (
              <AnalysisCard
                analysis={currentAnalysis}
                testID="current-analysis"
                accessibilityLabel="Current analysis details"
                isHighlighted
              />
            )}
          </Section>
        }
        ListFooterComponent={
          <TimelineView
            babyId={babyId}
            startDate={new Date(date)}
            endDate={new Date(date)}
            onRecordPress={handleRecordPress}
            filterCriteria={{}}
            groupBy="day"
            locale="en-US"
          />
        }
        onRefresh={refreshHistory}
        refreshing={loading}
        getItemCount={data => data.length}
        getItem={(data, index) => data[index]}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews={true}
        accessibilityRole="list"
        accessibilityLabel="Cry analysis history"
      />
    </Container>
  );
};

export default HistoryDetailScreen;