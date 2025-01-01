/**
 * @fileoverview Material Design 3.0 compliant Card component
 * Implements dynamic theming, elevation, and accessibility features
 * Version: 1.0.0
 */

import React from 'react';
import styled from 'styled-components';
import { View, ViewStyle, Pressable, Animated } from 'react-native';
import { DEFAULT_THEME, DARK_THEME } from '../../constants/theme.constants';

// Animation configuration for elevation transitions
const ELEVATION_ANIMATION_CONFIG = {
  duration: DEFAULT_THEME.animation.duration.normal,
  easing: DEFAULT_THEME.animation.easing.standard,
};

interface CardProps {
  children: React.ReactNode;
  variant?: 'flat' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
  margin?: 'none' | 'small' | 'medium' | 'large';
  backgroundColor?: string;
  borderRadius?: number;
  elevation?: number;
  testID?: string;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityHint?: string;
  reduceMotion?: boolean;
}

// Mapping for padding values to theme spacing
const PADDING_MAP = {
  none: '0',
  small: DEFAULT_THEME.spacing.sm,
  medium: DEFAULT_THEME.spacing.md,
  large: DEFAULT_THEME.spacing.lg,
};

// Mapping for margin values to theme spacing
const MARGIN_MAP = {
  none: '0',
  small: DEFAULT_THEME.spacing.sm,
  medium: DEFAULT_THEME.spacing.md,
  large: DEFAULT_THEME.spacing.lg,
};

const StyledCard = styled(Animated.View)<{
  variant: string;
  padding: string;
  margin: string;
  backgroundColor?: string;
  borderRadius: number;
  elevation: number;
  isPressed: boolean;
  reduceMotion: boolean;
}>`
  background-color: ${props => 
    props.backgroundColor || 
    props.theme.colors.surface};
  border-radius: ${props => props.borderRadius}px;
  padding: ${props => PADDING_MAP[props.padding]};
  margin: ${props => MARGIN_MAP[props.margin]};
  border-width: ${props => props.variant === 'outlined' ? '1px' : '0'};
  border-color: ${props => props.theme.colors.border};
  overflow: hidden;
  
  ${props => getElevation(props.variant, props.isPressed, props.elevation)}
  ${props => getTransitionStyle(props.reduceMotion)}
`;

// Helper function to calculate elevation styles
const getElevation = (
  variant: string,
  isPressed: boolean,
  customElevation?: number
) => {
  if (variant === 'flat') return '';
  
  if (variant === 'elevated') {
    const elevation = customElevation || 2;
    const pressedElevation = Math.max(1, elevation - 1);
    
    return `
      box-shadow: ${isPressed ? 
        DEFAULT_THEME.elevation.low : 
        customElevation ? 
          `0px ${elevation}px ${elevation * 2}px rgba(0, 0, 0, 0.15)` : 
          DEFAULT_THEME.elevation.medium};
    `;
  }
  
  return '';
};

// Helper function for transition styles
const getTransitionStyle = (reduceMotion: boolean) => `
  transition: all ${
    reduceMotion ? 
    DEFAULT_THEME.animation.reducedMotion.duration : 
    DEFAULT_THEME.animation.duration.normal
  } ${
    reduceMotion ? 
    DEFAULT_THEME.animation.reducedMotion.easing : 
    DEFAULT_THEME.animation.easing.standard
  };
`;

export const Card = React.memo<CardProps>(({
  children,
  variant = 'flat',
  padding = 'medium',
  margin = 'none',
  backgroundColor,
  borderRadius = 8,
  elevation,
  testID,
  style,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'none',
  accessibilityHint,
  reduceMotion = false,
}) => {
  // Animation value for press state
  const pressAnimation = React.useRef(new Animated.Value(0)).current;
  
  // Press handler for animation
  const handlePressIn = React.useCallback(() => {
    if (!reduceMotion) {
      Animated.timing(pressAnimation, {
        toValue: 1,
        ...ELEVATION_ANIMATION_CONFIG,
        useNativeDriver: true,
      }).start();
    }
  }, [pressAnimation, reduceMotion]);

  const handlePressOut = React.useCallback(() => {
    if (!reduceMotion) {
      Animated.timing(pressAnimation, {
        toValue: 0,
        ...ELEVATION_ANIMATION_CONFIG,
        useNativeDriver: true,
      }).start();
    }
  }, [pressAnimation, reduceMotion]);

  // Memoized card content
  const cardContent = React.useMemo(() => (
    <StyledCard
      variant={variant}
      padding={padding}
      margin={margin}
      backgroundColor={backgroundColor}
      borderRadius={borderRadius}
      elevation={elevation || 0}
      isPressed={pressAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [false, true],
      })}
      reduceMotion={reduceMotion}
      style={[
        style,
        {
          transform: [
            {
              scale: pressAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.98],
              }),
            },
          ],
        },
      ]}
      testID={testID}
    >
      {children}
    </StyledCard>
  ), [
    variant,
    padding,
    margin,
    backgroundColor,
    borderRadius,
    elevation,
    pressAnimation,
    reduceMotion,
    style,
    testID,
    children,
  ]);

  // If card is interactive, wrap in Pressable
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole || 'button'}
        accessibilityHint={accessibilityHint}
      >
        {cardContent}
      </Pressable>
    );
  }

  // Non-interactive card
  return React.cloneElement(cardContent, {
    accessibilityLabel,
    accessibilityRole,
    accessibilityHint,
  });
});

Card.displayName = 'Card';

export default Card;