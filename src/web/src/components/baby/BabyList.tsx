/**
 * @fileoverview Material Design 3.0 compliant BabyList component with WCAG 2.1 AA support
 * Implements dynamic theming, accessibility, and enhanced list management
 * Version: 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, GestureResponderEvent } from 'react-native';
import BabyCard from './BabyCard';
import Loading from '../common/Loading';
import { useBaby } from '../../hooks/useBaby';
import { useTheme } from '../../hooks/useTheme';
import { Baby } from '../../types/baby.types';

interface BabyListProps {
  onBabyPress: (baby: Baby, event: GestureResponderEvent) => void;
  onMonitorPress: (baby: Baby, event: GestureResponderEvent) => void;
  style?: StyleSheet.Styles;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * A Material Design 3.0 compliant list component for displaying baby profiles
 * with comprehensive accessibility support and monitoring capabilities
 */
const BabyList: React.FC<BabyListProps> = ({
  onBabyPress,
  onMonitorPress,
  style,
  testID = 'baby-list',
  accessibilityLabel = 'List of baby profiles',
}) => {
  const { theme } = useTheme();
  const { babies, loading, error, fetchBabies } = useBaby();
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    fetchBabies();
  }, [fetchBabies]);

  /**
   * Handle refresh action with loading state
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBabies();
    setRefreshing(false);
  }, [fetchBabies]);

  /**
   * Handle baby card press with accessibility feedback
   */
  const handleBabyPress = useCallback((baby: Baby, event: GestureResponderEvent) => {
    onBabyPress(baby, event);
  }, [onBabyPress]);

  /**
   * Handle monitor button press with accessibility feedback
   */
  const handleMonitorPress = useCallback((baby: Baby, event: GestureResponderEvent) => {
    event.stopPropagation();
    onMonitorPress(baby, event);
  }, [onMonitorPress]);

  /**
   * Render individual baby card with accessibility props
   */
  const renderItem = useCallback(({ item: baby, index }: { item: Baby; index: number }) => (
    <BabyCard
      baby={baby}
      onPress={(event) => handleBabyPress(baby, event)}
      onMonitorPress={(event) => handleMonitorPress(baby, event)}
      style={styles.card}
      testID={`${testID}-card-${index}`}
      accessibilityLabel={`${baby.name}'s profile card. ${
        baby.preferences.monitoringEnabled ? 'Monitoring active' : 'Monitoring inactive'
      }`}
    />
  ), [handleBabyPress, handleMonitorPress, testID]);

  /**
   * Extract unique key for list items
   */
  const keyExtractor = useCallback((item: Baby) => item.id, []);

  /**
   * Render separator between items
   */
  const ItemSeparator = useCallback(() => (
    <View 
      style={styles.separator}
      accessibilityRole="none"
    />
  ), []);

  /**
   * Render empty state with accessibility
   */
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text
        variant="body"
        style={styles.emptyText}
        accessibilityRole="text"
        accessibilityLabel="No baby profiles found"
      >
        No baby profiles found
      </Text>
    </View>
  ), []);

  if (loading && !refreshing) {
    return (
      <Loading
        text="Loading baby profiles..."
        testID={`${testID}-loading`}
        accessibilityLabel="Loading baby profiles"
      />
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text
          variant="body"
          style={styles.errorText}
          accessibilityRole="alert"
          testID={`${testID}-error`}
        >
          {error.message || 'Failed to load baby profiles'}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, style]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="list"
    >
      <FlatList
        data={babies}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={ItemSeparator}
        ListEmptyComponent={ListEmptyComponent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={true}
        accessibilityRole="list"
        accessibilityHint="Pull down to refresh baby profiles"
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44, // Minimum touch target size
  },
  card: {
    marginVertical: 4,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    color: 'error',
    textAlign: 'center',
  },
});

export default BabyList;