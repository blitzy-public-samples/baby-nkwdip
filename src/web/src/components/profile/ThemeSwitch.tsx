/**
 * @fileoverview Material Design 3.0 compliant theme switch component with WCAG 2.1 AA support
 * Implements dynamic theming, animations, and enhanced accessibility
 * Version: 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { View, Switch, Animated, AccessibilityInfo } from 'react-native';
import styled from 'styled-components/native';
import { useTheme } from '../../hooks/useTheme';
import Button from '../common/Button';

/**
 * Props interface for ThemeSwitch component
 */
interface ThemeSwitchProps {
  label?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: any;
  onError?: (error: Error) => void;
  highContrast?: boolean;
  disableAnimation?: boolean;
}

/**
 * Styled container with proper touch target size
 */
const StyledContainer = styled(View)`
  flex-direction: row;
  align-items: center;
  min-height: 44px;
  min-width: 44px;
  padding: ${({ theme }) => theme.spacing.xs};
`;

/**
 * Styled label with theme-aware colors and animations
 */
const StyledLabel = styled(Button)`
  margin-left: ${({ theme }) => theme.spacing.xs};
  opacity: ${({ disabled }) => disabled ? 0.6 : 1};
  transition: opacity ${({ theme }) => theme.animation.duration.fast} ${({ theme }) => theme.animation.easing.standard};
`;

/**
 * Memoized theme switch component with accessibility support
 */
const ThemeSwitch: React.FC<ThemeSwitchProps> = React.memo(({
  label,
  accessibilityLabel,
  testID = 'theme-switch',
  style,
  onError,
  highContrast = false,
  disableAnimation = false
}) => {
  const { 
    theme,
    isDarkMode,
    toggleTheme,
    isSystemTheme,
    themeTransition
  } = useTheme();

  // Animation value for smooth transitions
  const animatedValue = React.useRef(new Animated.Value(isDarkMode ? 1 : 0)).current;

  /**
   * Handle theme toggle with error boundary
   */
  const handleToggle = useCallback(async () => {
    try {
      if (!disableAnimation) {
        Animated.timing(animatedValue, {
          toValue: isDarkMode ? 0 : 1,
          duration: theme.animation.duration.normal,
          useNativeDriver: true,
        }).start();
      }
      await toggleTheme();
    } catch (error) {
      onError?.(error as Error);
      console.error('Theme toggle failed:', error);
    }
  }, [isDarkMode, toggleTheme, animatedValue, theme, disableAnimation, onError]);

  /**
   * Announce theme changes to screen readers
   */
  useEffect(() => {
    const message = `Theme changed to ${isDarkMode ? 'dark' : 'light'} mode`;
    AccessibilityInfo.announceForAccessibility(message);
  }, [isDarkMode]);

  /**
   * Get theme-aware colors
   */
  const getThemeColors = useCallback(() => {
    if (highContrast) {
      return {
        trackColor: {
          false: '#000000',
          true: '#FFFFFF'
        },
        thumbColor: isDarkMode ? '#000000' : '#FFFFFF',
      };
    }

    return {
      trackColor: {
        false: theme.colors.surfaceVariant,
        true: theme.colors.primary
      },
      thumbColor: isDarkMode ? theme.colors.surface : theme.colors.background,
    };
  }, [theme, isDarkMode, highContrast]);

  const { trackColor, thumbColor } = getThemeColors();

  return (
    <StyledContainer
      style={style}
      accessibilityRole="switch"
      accessibilityState={{
        checked: isDarkMode,
        disabled: false
      }}
    >
      <Switch
        testID={testID}
        value={isDarkMode}
        onValueChange={handleToggle}
        trackColor={trackColor}
        thumbColor={thumbColor}
        ios_backgroundColor={theme.colors.surfaceVariant}
        accessibilityLabel={accessibilityLabel || `Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
      />
      {label && (
        <StyledLabel
          variant="text"
          onPress={handleToggle}
          accessibilityLabel={label}
          testID={`${testID}-label`}
        >
          {label}
        </StyledLabel>
      )}
    </StyledContainer>
  );
});

ThemeSwitch.displayName = 'ThemeSwitch';

export default ThemeSwitch;