/**
 * @fileoverview Main home screen component for Baby Cry Analyzer application
 * Implements Material Design 3.0 with WCAG 2.1 AA accessibility compliance
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/common/Button';
import MonitorControls from '../../components/monitor/MonitorControls';
import BabyCard from '../../components/baby/BabyCard';
import { useBaby } from '../../hooks/useBaby';
import Text from '../../components/common/Text';

// Analytics decorator
const withAnalytics = (WrappedComponent: React.FC<any>) => {
  return (props: any) => {
    useEffect(() => {
      // Track screen view
      analytics.logScreenView('HomeScreen');
    }, []);
    return <WrappedComponent {...props} />;
  };
};

interface HomeScreenProps {
  navigation: any;
  route: any;
}

interface HomeScreenState {
  refreshing: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Main home screen component with baby profiles and monitoring controls
 */
const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { babies, loading, error: babyError, fetchBabies } = useBaby();
  
  // Local state management
  const [state, setState] = useState<HomeScreenState>({
    refreshing: false,
    error: null,
    retryCount: 0,
  });

  /**
   * Handle pull-to-refresh functionality
   */
  const handleRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, refreshing: true }));
    try {
      await fetchBabies();
      analytics.logEvent('home_screen_refresh', { success: true });
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error as Error,
        retryCount: prev.retryCount + 1,
      }));
      analytics.logEvent('home_screen_refresh_error', { error: error.message });
    } finally {
      setState(prev => ({ ...prev, refreshing: false }));
    }
  }, [fetchBabies]);

  /**
   * Handle navigation to monitor screen
   */
  const handleMonitorPress = useCallback((babyId: string) => {
    analytics.logEvent('monitor_button_press', { babyId });
    navigation.navigate('Monitor', { babyId });
  }, [navigation]);

  /**
   * Handle navigation to baby profile
   */
  const handleBabyPress = useCallback((babyId: string) => {
    analytics.logEvent('baby_profile_press', { babyId });
    navigation.navigate('BabyProfile', { babyId });
  }, [navigation]);

  /**
   * Handle add new baby navigation
   */
  const handleAddBaby = useCallback(() => {
    analytics.logEvent('add_baby_press');
    navigation.navigate('AddBaby');
  }, [navigation]);

  /**
   * Fetch babies on mount and handle errors
   */
  useEffect(() => {
    fetchBabies().catch(error => {
      setState(prev => ({ ...prev, error }));
      analytics.logEvent('home_screen_load_error', { error: error.message });
    });
  }, [fetchBabies]);

  /**
   * Memoized error message component
   */
  const ErrorMessage = useMemo(() => {
    if (!state.error && !babyError) return null;
    const error = state.error || babyError;
    
    return (
      <View style={styles.errorContainer}>
        <Text
          variant="body"
          color={theme.colors.error}
          accessibilityRole="alert"
        >
          {error?.message || 'An error occurred'}
        </Text>
        <Button
          variant="primary"
          onPress={handleRefresh}
          accessibilityLabel="Retry loading babies"
        >
          Retry
        </Button>
      </View>
    );
  }, [state.error, babyError, theme, handleRefresh]);

  /**
   * Memoized baby list component
   */
  const BabyList = useMemo(() => {
    if (!babies?.length) {
      return (
        <View style={styles.emptyContainer}>
          <Text
            variant="body"
            color={theme.colors.textSecondary}
            accessibilityRole="text"
          >
            No babies added yet
          </Text>
          <Button
            variant="primary"
            onPress={handleAddBaby}
            accessibilityLabel="Add your first baby"
          >
            Add Baby
          </Button>
        </View>
      );
    }

    return babies.map(baby => (
      <BabyCard
        key={baby.id}
        baby={baby}
        onPress={() => handleBabyPress(baby.id)}
        onMonitorPress={() => handleMonitorPress(baby.id)}
        testID={`baby-card-${baby.id}`}
      />
    ));
  }, [babies, theme, handleAddBaby, handleBabyPress, handleMonitorPress]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
        accessibilityRole="scrollable"
        accessibilityLabel="Home screen content"
      >
        <View style={styles.header}>
          <Text
            variant="h1"
            weight="bold"
            accessibilityRole="header"
          >
            Baby Monitor
          </Text>
          <Button
            variant="primary"
            onPress={handleAddBaby}
            accessibilityLabel="Add new baby"
            testID="add-baby-button"
          >
            Add Baby
          </Button>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text
              variant="body"
              color={theme.colors.textSecondary}
              accessibilityRole="text"
            >
              Loading babies...
            </Text>
          </View>
        ) : ErrorMessage || BabyList}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    accessibilityRole: 'main',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    minHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    accessibilityRole: 'header',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
});

export default withAnalytics(HomeScreen);