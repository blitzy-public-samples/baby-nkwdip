/**
 * @fileoverview Material Design 3.0 compliant BabyCard component
 * Implements WCAG 2.1 AA accessibility standards with proper contrast and touch targets
 * Version: 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { format } from 'date-fns'; // v2.30.0
import Card from '../common/Card';
import Text from '../common/Text';
import { useTheme } from '../../hooks/useTheme';
import { Baby, BabyPreferences } from '../../types/baby.types';

interface BabyCardProps {
  baby: Baby;
  onPress?: () => void;
  onMonitorPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * Formats baby's age in months or years with localization support
 */
const formatAge = (birthDate: Date): string => {
  const now = new Date();
  const months = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                (now.getMonth() - birthDate.getMonth());
  
  if (months < 24) {
    return `${months} ${months === 1 ? 'month' : 'months'} old`;
  }
  
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} old`;
};

/**
 * A Material Design 3.0 card component for displaying baby profile information
 * with comprehensive accessibility support and monitoring controls
 */
const BabyCard: React.FC<BabyCardProps> = ({
  baby,
  onPress,
  onMonitorPress,
  style,
  testID = 'baby-card',
  accessibilityLabel,
}) => {
  const { theme } = useTheme();

  /**
   * Memoized card press handler with accessibility feedback
   */
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    }
  }, [onPress]);

  /**
   * Memoized monitor button press handler with accessibility feedback
   */
  const handleMonitorPress = useCallback((event: any) => {
    event.stopPropagation();
    onMonitorPress();
  }, [onMonitorPress]);

  /**
   * Memoized monitoring status text with proper accessibility description
   */
  const monitoringStatus = useMemo(() => {
    return baby.preferences.monitoringEnabled ? 'Monitoring Active' : 'Monitoring Inactive';
  }, [baby.preferences.monitoringEnabled]);

  /**
   * Memoized last analysis text with proper date formatting
   */
  const lastAnalysisText = useMemo(() => {
    if (!baby.lastAnalysis) return 'No recent analysis';
    return `Last analysis: ${format(baby.lastAnalysis, 'PPp')}`;
  }, [baby.lastAnalysis]);

  return (
    <Card
      variant="elevated"
      elevation={2}
      style={[styles.container, style]}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel || `${baby.name}'s profile card`}
      accessibilityRole="button"
      accessibilityHint="Double tap to view detailed profile"
    >
      <View style={styles.header}>
        <Text
          variant="h2"
          weight="bold"
          testID={`${testID}-name`}
          accessibilityRole="header"
        >
          {baby.name}
        </Text>
        <Text
          variant="body"
          color={theme.colors.textSecondary}
          testID={`${testID}-age`}
        >
          {formatAge(baby.birthDate)}
        </Text>
      </View>

      <View style={styles.content}>
        <Text
          variant="body"
          color={baby.preferences.monitoringEnabled ? 
            theme.colors.primary : 
            theme.colors.textSecondary}
          testID={`${testID}-status`}
        >
          {monitoringStatus}
        </Text>
        
        <Text
          variant="caption"
          color={theme.colors.textSecondary}
          testID={`${testID}-analysis`}
        >
          {lastAnalysisText}
        </Text>
      </View>

      <Pressable
        onPress={handleMonitorPress}
        style={({ pressed }) => [
          styles.monitorButton,
          {
            backgroundColor: baby.preferences.monitoringEnabled ?
              theme.colors.primary :
              theme.colors.surface,
            borderColor: theme.colors.primary,
            borderWidth: baby.preferences.monitoringEnabled ? 0 : 1,
            opacity: pressed ? 0.8 : 1,
          }
        ]}
        testID={`${testID}-monitor-button`}
        accessibilityRole="switch"
        accessibilityState={{ checked: baby.preferences.monitoringEnabled }}
        accessibilityLabel={`Toggle monitoring for ${baby.name}`}
        accessibilityHint={baby.preferences.monitoringEnabled ?
          'Double tap to stop monitoring' :
          'Double tap to start monitoring'}
      >
        <Text
          variant="body"
          weight="medium"
          color={baby.preferences.monitoringEnabled ?
            theme.colors.surface :
            theme.colors.primary}
        >
          {baby.preferences.monitoringEnabled ? 'Stop Monitoring' : 'Start Monitoring'}
        </Text>
      </Pressable>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  content: {
    marginTop: 8,
    gap: 4,
  },
  monitorButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default BabyCard;