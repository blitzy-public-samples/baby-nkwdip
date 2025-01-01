/**
 * @fileoverview Noise level indicator component for real-time audio monitoring
 * Library versions:
 * - react@18.0.0
 * - styled-components@5.3.0
 * - react-native@0.71.0
 */

import React from 'react';
import styled from 'styled-components';
import { View, Animated, StyleProp, ViewStyle } from 'react-native';
import { calculateNoiseLevel } from '../../utils/audio.util';
import { AudioFeatures } from '../../types/audio.types';
import Card from '../common/Card';

// Constants for noise thresholds and animation
const NOISE_THRESHOLD_HIGH = 0.7;
const NOISE_THRESHOLD_MEDIUM = 0.4;
const ANIMATION_DURATION = 300;
const DEBOUNCE_DELAY = 100;
const MIN_CONTRAST_RATIO = 4.5;

interface NoiseIndicatorProps {
  noiseLevel: number;
  isRecording: boolean;
  onHighNoise?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  reduceMotion?: boolean;
}

const StyledIndicatorContainer = styled(View)`
  width: 100%;
  height: ${props => props.theme.components.monitor.confidenceBarHeight};
  background-color: ${props => props.theme.colors.monitor.background};
  border-radius: ${props => props.theme.components.monitor.borderRadius}px;
  overflow: hidden;
`;

const StyledNoiseBar = styled(Animated.View)<{ color: string }>`
  height: 100%;
  background-color: ${props => props.color};
  border-radius: ${props => props.theme.components.monitor.borderRadius}px;
`;

const getNoiseLevelColor = (noiseLevel: number, theme: any, highContrast: boolean = false) => {
  if (highContrast) {
    if (noiseLevel >= NOISE_THRESHOLD_HIGH) return theme.colors.error;
    if (noiseLevel >= NOISE_THRESHOLD_MEDIUM) return theme.colors.warning;
    return theme.colors.success;
  }

  if (noiseLevel >= NOISE_THRESHOLD_HIGH) {
    return theme.colors.monitor.confidenceHigh;
  }
  if (noiseLevel >= NOISE_THRESHOLD_MEDIUM) {
    return theme.colors.monitor.confidenceMedium;
  }
  return theme.colors.monitor.confidenceLow;
};

export const NoiseIndicator = React.memo<NoiseIndicatorProps>(({
  noiseLevel,
  isRecording,
  onHighNoise,
  style,
  testID = 'noise-indicator',
  accessibilityLabel = 'Background noise level indicator',
  reduceMotion = false,
}) => {
  // Animation value for noise level bar
  const widthAnim = React.useRef(new Animated.Value(0)).current;
  const opacityAnim = React.useRef(new Animated.Value(1)).current;

  // Debounced high noise callback
  const debouncedHighNoise = React.useCallback(
    React.useMemo(
      () => {
        let timeoutId: NodeJS.Timeout;
        return () => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            onHighNoise?.();
          }, DEBOUNCE_DELAY);
        };
      },
      [onHighNoise]
    ),
    [onHighNoise]
  );

  // Update animation when noise level changes
  React.useEffect(() => {
    if (!reduceMotion) {
      Animated.timing(widthAnim, {
        toValue: noiseLevel,
        duration: ANIMATION_DURATION,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(noiseLevel);
    }

    if (noiseLevel >= NOISE_THRESHOLD_HIGH) {
      debouncedHighNoise();
    }
  }, [noiseLevel, widthAnim, reduceMotion, debouncedHighNoise]);

  // Blink animation for high noise levels
  React.useEffect(() => {
    if (noiseLevel >= NOISE_THRESHOLD_HIGH && !reduceMotion) {
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration: ANIMATION_DURATION / 2,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION / 2,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [noiseLevel, opacityAnim, reduceMotion]);

  // Get noise level description for accessibility
  const getNoiseLevelDescription = (level: number): string => {
    if (level >= NOISE_THRESHOLD_HIGH) return 'High background noise detected';
    if (level >= NOISE_THRESHOLD_MEDIUM) return 'Moderate background noise';
    return 'Low background noise';
  };

  return (
    <Card
      variant="flat"
      style={style}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 1,
        now: noiseLevel,
      }}
      accessibilityHint={getNoiseLevelDescription(noiseLevel)}
    >
      <StyledIndicatorContainer>
        <StyledNoiseBar
          color={getNoiseLevelColor(noiseLevel, theme)}
          style={{
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
            opacity: opacityAnim,
          }}
        />
      </StyledIndicatorContainer>
    </Card>
  );
});

NoiseIndicator.displayName = 'NoiseIndicator';

export default NoiseIndicator;