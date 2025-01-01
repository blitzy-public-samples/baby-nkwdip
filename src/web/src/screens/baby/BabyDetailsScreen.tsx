/**
 * @fileoverview Material Design 3.0 compliant Baby Details Screen component
 * Implements WCAG 2.1 AA accessibility standards and real-time monitoring
 * Version: 1.0.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  AccessibilityInfo
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import BabyCard from '../../components/baby/BabyCard';
import MilestoneCard from '../../components/baby/MilestoneCard';
import HistoryChart from '../../components/history/HistoryChart';
import { useBaby } from '../../hooks/useBaby';
import { useTheme } from '../../hooks/useTheme';
import Loading from '../../components/common/Loading';
import Text from '../../components/common/Text';
import { Baby, CryPattern } from '../../types/baby.types';

interface BabyDetailsScreenProps {
  route: {
    params: {
      babyId: string;
    };
  };
}

const BabyDetailsScreen: React.FC<BabyDetailsScreenProps> = ({ route }) => {
  // State and refs
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baby, setBaby] = useState<Baby | null>(null);
  const monitoringRef = useRef<boolean>(false);
  
  // Hooks
  const { theme } = useTheme();
  const navigation = useNavigation();
  const {
    updateBaby,
    fetchAnalytics,
    subscribeToUpdates
  } = useBaby();

  // Extract babyId from route params
  const { babyId } = route.params;

  /**
   * Handles pull-to-refresh with optimistic updates
   */
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const [babyData, analyticsData] = await Promise.all([
        updateBaby(babyId, {}),
        fetchAnalytics(babyId)
      ]);

      if (babyData.data) {
        setBaby(babyData.data);
      }
    } catch (err) {
      setError('Failed to refresh data');
      AccessibilityInfo.announceForAccessibility('Error refreshing data');
    } finally {
      setRefreshing(false);
    }
  }, [babyId, updateBaby, fetchAnalytics]);

  /**
   * Handles monitoring toggle with real-time updates
   */
  const handleMonitoringToggle = useCallback(async () => {
    if (!baby) return;

    try {
      const updatedPreferences = {
        ...baby.preferences,
        monitoringEnabled: !baby.preferences.monitoringEnabled
      };

      const result = await updateBaby(babyId, {
        preferences: updatedPreferences
      });

      if (result.data) {
        setBaby(result.data);
        AccessibilityInfo.announceForAccessibility(
          `Monitoring ${result.data.preferences.monitoringEnabled ? 'started' : 'stopped'}`
        );
      }
    } catch (err) {
      setError('Failed to toggle monitoring');
      AccessibilityInfo.announceForAccessibility('Error toggling monitoring');
    }
  }, [baby, babyId, updateBaby]);

  /**
   * Handles real-time pattern updates
   */
  const handlePatternUpdate = useCallback((pattern: CryPattern) => {
    if (!baby) return;

    setBaby(prevBaby => {
      if (!prevBaby) return null;
      return {
        ...prevBaby,
        lastAnalysis: new Date(),
        patternHistory: prevBaby.patternHistory ? {
          ...prevBaby.patternHistory,
          patterns: [pattern, ...prevBaby.patternHistory.patterns]
        } : null
      };
    });
  }, [baby]);

  /**
   * Initialize data and subscriptions on mount
   */
  useEffect(() => {
    const initializeScreen = async () => {
      try {
        setLoading(true);
        const result = await updateBaby(babyId, {});
        if (result.data) {
          setBaby(result.data);
        }
      } catch (err) {
        setError('Failed to load baby details');
        AccessibilityInfo.announceForAccessibility('Error loading baby details');
      } finally {
        setLoading(false);
      }
    };

    initializeScreen();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUpdates(babyId, handlePatternUpdate);

    return () => {
      unsubscribe();
    };
  }, [babyId, updateBaby, subscribeToUpdates, handlePatternUpdate]);

  /**
   * Handle screen focus/blur for monitoring state
   */
  useFocusEffect(
    useCallback(() => {
      monitoringRef.current = true;

      return () => {
        monitoringRef.current = false;
      };
    }, [])
  );

  if (loading) {
    return (
      <Loading
        size="large"
        text="Loading baby details..."
        testID="baby-details-loading"
      />
    );
  }

  if (error || !baby) {
    return (
      <View style={styles.errorContainer}>
        <Text
          variant="h2"
          color={theme.colors.error}
          testID="baby-details-error"
        >
          {error || 'Baby not found'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.surface}
          accessibilityLabel="Pull to refresh baby details"
        />
      }
      testID="baby-details-screen"
    >
      <BabyCard
        baby={baby}
        onMonitorPress={handleMonitoringToggle}
        style={styles.card}
        testID="baby-details-card"
      />

      {baby.patternHistory && (
        <View style={styles.section}>
          <Text
            variant="h2"
            style={styles.sectionTitle}
            testID="history-section-title"
          >
            Cry Pattern History
          </Text>
          <HistoryChart
            babyId={babyId}
            startDate={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
            endDate={new Date()}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text
          variant="h2"
          style={styles.sectionTitle}
          testID="milestones-section-title"
        >
          Growth Milestones
        </Text>
        {baby.milestones?.map(milestone => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            baby={baby}
            style={styles.card}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
});

export default BabyDetailsScreen;