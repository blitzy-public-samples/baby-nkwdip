/**
 * @fileoverview Pattern Display component for visualizing cry analysis results
 * Implements Material Design 3.0 with WCAG 2.1 AA compliance
 * Version: 1.0.0
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, I18nManager } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';
import { useTranslation } from 'react-i18next';
import debounce from 'lodash/debounce';

import { AudioAnalysisResult, AudioFeatures } from '../../types/audio.types';
import Card from '../common/Card';
import Text from '../common/Text';
import { useTheme } from '../../hooks/useTheme';

interface PatternDisplayProps {
  analysisResult: AudioAnalysisResult | null;
  isAnalyzing: boolean;
  style?: ViewStyle;
  onError?: (error: Error) => void;
  testID?: string;
}

const formatConfidence = (confidence: number, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(confidence);
};

const getPatternColor = (confidence: number, theme: any): string => {
  if (confidence >= 0.8) return theme.colors.monitor.confidenceHigh;
  if (confidence >= 0.5) return theme.colors.monitor.confidenceMedium;
  return theme.colors.monitor.confidenceLow;
};

const PatternDisplay: React.FC<PatternDisplayProps> = memo(({
  analysisResult,
  isAnalyzing,
  style,
  onError,
  testID = 'pattern-display'
}) => {
  const { t } = useTranslation();
  const { theme, isDarkMode } = useTheme();

  const handleError = useCallback((error: Error) => {
    console.error('Pattern display error:', error);
    onError?.(error);
  }, [onError]);

  const debouncedUpdate = useMemo(
    () => debounce((result: AudioAnalysisResult) => {
      try {
        // Process result updates
      } catch (error) {
        handleError(error as Error);
      }
    }, 100),
    [handleError]
  );

  const renderFeatures = useCallback((features: AudioFeatures) => {
    const featureItems = [
      { label: t('monitor.spectralCentroid'), value: features.spectralCentroid.toFixed(2) },
      { label: t('monitor.zeroCrossingRate'), value: features.zeroCrossingRate.toFixed(2) },
      { label: t('monitor.noiseLevel'), value: `${(features.noiseLevel * 100).toFixed(0)}%` }
    ];

    return (
      <View style={styles.featureContainer}>
        {featureItems.map(({ label, value }) => (
          <View key={label} style={styles.featureItem}>
            <Text
              variant="caption"
              color={theme.colors.textSecondary}
              accessibilityLabel={`${label}: ${value}`}
            >
              {label}
            </Text>
            <Text variant="body" testID={`feature-${label}`}>
              {value}
            </Text>
          </View>
        ))}
      </View>
    );
  }, [t, theme]);

  const confidenceColor = useMemo(() => {
    if (!analysisResult) return theme.colors.monitor.confidenceLow;
    return getPatternColor(analysisResult.confidence, theme);
  }, [analysisResult, theme]);

  if (!analysisResult && !isAnalyzing) {
    return (
      <Card
        variant="outlined"
        style={[styles.container, style]}
        testID={testID}
        accessibilityLabel={t('monitor.noPattern')}
      >
        <Text variant="body" accessibilityRole="alert">
          {t('monitor.waiting')}
        </Text>
      </Card>
    );
  }

  return (
    <Card
      variant="elevated"
      style={[styles.container, style]}
      testID={testID}
      accessibilityLabel={t('monitor.patternDisplay')}
    >
      <View style={styles.progressContainer}>
        <AnimatedCircularProgress
          size={120}
          width={12}
          fill={analysisResult ? analysisResult.confidence * 100 : 0}
          tintColor={confidenceColor}
          backgroundColor={theme.colors.surfaceVariant}
          rotation={I18nManager.isRTL ? 180 : 0}
          duration={600}
          accessibilityLabel={t('monitor.confidenceLevel')}
        />
        <Text
          variant="h2"
          style={styles.confidenceText}
          accessibilityLabel={t('monitor.confidenceValue', {
            value: analysisResult ? formatConfidence(analysisResult.confidence, t('common.locale')) : '0%'
          })}
        >
          {analysisResult ? formatConfidence(analysisResult.confidence, t('common.locale')) : '0%'}
        </Text>
      </View>

      <View style={styles.resultContainer}>
        <View style={styles.needTypeContainer}>
          <Text
            variant="h4"
            color={theme.colors.primary}
            accessibilityRole="header"
          >
            {isAnalyzing ? t('monitor.analyzing') : analysisResult?.needType}
          </Text>
          <Text
            variant="caption"
            color={theme.colors.textSecondary}
            style={styles.timestamp}
          >
            {analysisResult && new Date(analysisResult.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      </View>

      {analysisResult && renderFeatures(analysisResult.features)}
    </Card>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginVertical: 8
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 16,
    accessibilityRole: 'progressbar'
  },
  confidenceText: {
    marginTop: 8,
    textAlign: 'center'
  },
  resultContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  needTypeContainer: {
    flex: 1
  },
  timestamp: {
    marginTop: 4
  },
  featureContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  },
  featureItem: {
    flex: 1,
    minWidth: '30%',
    marginVertical: 8,
    alignItems: 'center'
  }
});

PatternDisplay.displayName = 'PatternDisplay';

export default PatternDisplay;