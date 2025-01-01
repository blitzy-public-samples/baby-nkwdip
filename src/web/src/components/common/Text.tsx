/**
 * @fileoverview Material Design 3.0 compliant Text component with WCAG 2.1 AA support
 * Implements dynamic theming, RTL support, and robust error handling
 * Version: 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { Text as RNText, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

/**
 * Props interface for the Text component
 */
interface TextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'body' | 'caption';
  weight?: 'regular' | 'medium' | 'bold';
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
  testID?: string;
  accessibilityLabel?: string;
  maxFontSizeMultiplier?: number;
  allowFontScaling?: boolean;
}

/**
 * Material Design 3.0 typography variants
 */
const TYPOGRAPHY_VARIANTS = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    fontWeight: '400' as const,
  },
};

/**
 * Font weight mapping
 */
const FONT_WEIGHTS = {
  regular: '400' as const,
  medium: '500' as const,
  bold: '700' as const,
};

/**
 * A themed text component that implements Material Design 3.0 typography system
 * with comprehensive accessibility support
 */
const Text: React.FC<TextProps> = ({
  children,
  variant = 'body',
  weight = 'regular',
  color,
  style,
  numberOfLines = 0,
  testID,
  accessibilityLabel,
  maxFontSizeMultiplier = 2,
  allowFontScaling = true,
}) => {
  const { theme } = useTheme();

  /**
   * Compute base styles based on variant and weight
   */
  const baseStyles = useMemo(() => {
    const variantStyle = TYPOGRAPHY_VARIANTS[variant];
    return {
      ...styles.container,
      ...variantStyle,
      fontWeight: weight ? FONT_WEIGHTS[weight] : variantStyle.fontWeight,
      color: color || theme.colors.text,
      fontFamily: theme.typography.fontFamily.primary,
    };
  }, [variant, weight, color, theme]);

  /**
   * Validate color contrast with background
   */
  const validateColorContrast = useCallback((textColor: string) => {
    // Simplified contrast check - production would use a full WCAG contrast calculator
    if (textColor === theme.colors.background) {
      console.warn('Text color matches background color, may not meet WCAG contrast requirements');
      return theme.colors.text;
    }
    return textColor;
  }, [theme]);

  /**
   * Handle text style error recovery
   */
  const getFallbackStyles = useCallback((error: any): TextStyle => {
    console.error('Text style error:', error);
    return {
      ...styles.container,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: TYPOGRAPHY_VARIANTS[variant].fontSize,
      color: theme.colors.text,
    };
  }, [variant, theme]);

  /**
   * Merge computed styles with custom styles
   */
  const finalStyles = useMemo(() => {
    try {
      const computedColor = color ? validateColorContrast(color) : theme.colors.text;
      return StyleSheet.compose(
        baseStyles,
        {
          ...style,
          color: computedColor,
          writingDirection: theme.isRTL ? 'rtl' : 'ltr',
        }
      );
    } catch (error) {
      return getFallbackStyles(error);
    }
  }, [baseStyles, style, color, theme, validateColorContrast, getFallbackStyles]);

  return (
    <RNText
      style={finalStyles}
      numberOfLines={numberOfLines}
      testID={testID}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityRole={variant === 'h1' || variant === 'h2' ? 'header' : 'text'}
      accessible={true}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      allowFontScaling={allowFontScaling}
    >
      {children}
    </RNText>
  );
};

/**
 * Base styles for text component
 */
const styles = StyleSheet.create({
  container: {
    margin: 0,
    padding: 0,
  },
});

export default Text;