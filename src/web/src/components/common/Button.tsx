/**
 * @fileoverview Material Design 3.0 compliant Button component with WCAG 2.1 AA support
 * Implements dynamic theming, loading states, and enhanced accessibility
 * Version: 1.0.0
 */

import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import styled from 'styled-components/native';
import Text from './Text';
import { useTheme } from '../../hooks/useTheme';
import { DEFAULT_THEME } from '../../constants/theme.constants';

/**
 * Button component props interface
 */
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: object;
  testID?: string;
  style?: any;
  loadingColor?: string;
}

/**
 * Styled button container with dynamic props and theme integration
 */
const StyledButton = styled(TouchableOpacity)<{
  variant: string;
  size: string;
  disabled: boolean;
  fullWidth: boolean;
  loading: boolean;
}>`
  ${({ theme, variant, disabled, loading, size, fullWidth }) => {
    const buttonStyles = getButtonStyles(variant, theme, disabled, loading);
    const sizeStyles = getButtonSize(size, theme);
    
    return `
      flex-direction: row;
      justify-content: center;
      align-items: center;
      border-radius: ${theme.components.button.borderRadius};
      opacity: ${disabled || loading ? 0.6 : 1};
      width: ${fullWidth ? '100%' : 'auto'};
      min-height: 44px;
      ${buttonStyles}
      ${sizeStyles}
    `;
  }}
`;

/**
 * Get button styles based on variant and state
 */
const getButtonStyles = (
  variant: string,
  theme: typeof DEFAULT_THEME,
  disabled: boolean,
  loading: boolean
) => {
  const baseStyles = `
    transition: all ${theme.animation.duration.fast} ${theme.animation.easing.standard};
  `;

  const variants = {
    primary: `
      background-color: ${theme.colors.primary};
      border: none;
    `,
    secondary: `
      background-color: ${theme.colors.secondary};
      border: none;
    `,
    outline: `
      background-color: transparent;
      border: 2px solid ${theme.colors.primary};
    `,
    text: `
      background-color: transparent;
      border: none;
      padding-horizontal: ${theme.spacing.xs};
    `
  };

  return `
    ${baseStyles}
    ${variants[variant]}
    ${disabled || loading ? 'cursor: not-allowed;' : ''}
  `;
};

/**
 * Get button size styles
 */
const getButtonSize = (size: string, theme: typeof DEFAULT_THEME) => {
  const sizes = {
    small: `
      padding: ${theme.spacing.xxs} ${theme.spacing.xs};
    `,
    medium: `
      padding: ${theme.spacing.xs} ${theme.spacing.md};
    `,
    large: `
      padding: ${theme.spacing.sm} ${theme.spacing.lg};
    `
  };

  return sizes[size];
};

/**
 * Get text variant based on button variant
 */
const getTextVariant = (variant: string): 'body' | 'caption' => {
  return variant === 'text' ? 'caption' : 'body';
};

/**
 * Get text color based on button variant and theme
 */
const getTextColor = (variant: string, theme: typeof DEFAULT_THEME): string => {
  switch (variant) {
    case 'primary':
    case 'secondary':
      return theme.colors.background;
    case 'outline':
    case 'text':
      return theme.colors.primary;
    default:
      return theme.colors.text;
  }
};

/**
 * Memoized button component with enhanced accessibility and loading state support
 */
const Button: React.FC<ButtonProps> = React.memo(({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
  style,
  loadingColor
}) => {
  const { theme } = useTheme();

  const textColor = getTextColor(variant, theme);
  const spinnerColor = loadingColor || textColor;

  return (
    <StyledButton
      variant={variant}
      size={size}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      loading={loading}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
        ...accessibilityState
      }}
      testID={testID}
      style={style}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={spinnerColor}
          accessibilityLabel="Loading"
        />
      ) : (
        <Text
          variant={getTextVariant(variant)}
          color={textColor}
          weight="medium"
          accessibilityLabel={typeof children === 'string' ? children : undefined}
        >
          {children}
        </Text>
      )}
    </StyledButton>
  );
});

Button.displayName = 'Button';

export default Button;