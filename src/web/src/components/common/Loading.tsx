/**
 * @fileoverview Material Design 3.0 compliant Loading component with WCAG 2.1 AA support
 * Implements dynamic theming, accessibility, and enhanced loading states
 * Version: 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import styled from 'styled-components';
import Text from './Text';
import { DEFAULT_THEME, DARK_THEME } from '../../constants/theme.constants';

/**
 * Props interface for the Loading component
 */
interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullscreen?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  timeout?: number;
  onTimeout?: () => void;
  retryable?: boolean;
  onRetry?: () => void;
}

/**
 * Styled container component with theme integration
 */
const LoadingContainer = styled.View<{ fullscreen?: boolean }>`
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.md};
  ${({ fullscreen, theme }) =>
    fullscreen &&
    `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${theme.colors.overlay};
    z-index: 999;
  `}
`;

/**
 * Styled retry button with theme integration
 */
const RetryButton = styled.TouchableOpacity`
  margin-top: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.components.button.borderRadius};
  background-color: ${({ theme }) => theme.colors.primary};
`;

/**
 * Loading component that provides visual feedback during async operations
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  color,
  text,
  fullscreen = false,
  testID = 'loading-indicator',
  accessibilityLabel = 'Loading content',
  timeout,
  onTimeout,
  retryable = false,
  onRetry,
}) => {
  const theme = DEFAULT_THEME; // In production, use useTheme() hook

  /**
   * Handle timeout if specified
   */
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (timeout && onTimeout) {
      timeoutId = setTimeout(() => {
        onTimeout();
      }, timeout);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeout, onTimeout]);

  /**
   * Handle retry action
   */
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  /**
   * Get theme-aware color for the loading indicator
   */
  const getIndicatorColor = useCallback(() => {
    if (color) return color;
    return theme.colors.primary;
  }, [color, theme]);

  return (
    <LoadingContainer
      fullscreen={fullscreen}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator
        size={size}
        color={getIndicatorColor()}
        accessibilityElementsHidden={false}
        importantForAccessibility="yes"
      />
      
      {text && (
        <Text
          variant="body"
          style={styles.loadingText}
          accessibilityLabel={text}
          testID={`${testID}-text`}
        >
          {text}
        </Text>
      )}

      {retryable && onRetry && (
        <RetryButton
          onPress={handleRetry}
          accessibilityLabel="Retry loading"
          accessibilityRole="button"
          testID={`${testID}-retry`}
        >
          <Text
            variant="body"
            color={theme.colors.surface}
            style={styles.retryText}
          >
            Retry
          </Text>
        </RetryButton>
      )}
    </LoadingContainer>
  );
};

/**
 * Styles for the Loading component
 */
const styles = StyleSheet.create({
  loadingText: {
    marginTop: DEFAULT_THEME.spacing.sm,
    textAlign: 'center',
  },
  retryText: {
    textAlign: 'center',
  },
});

export default Loading;