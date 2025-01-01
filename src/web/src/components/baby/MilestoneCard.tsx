/**
 * @fileoverview Material Design 3.0 compliant Milestone Card component
 * Implements dynamic theming, high contrast support, and WCAG 2.1 AA accessibility
 * Version: 1.0.0
 */

import React from 'react'; // ^18.0.0
import styled from 'styled-components'; // ^5.3.0
import { View, Text, StyleSheet, Animated } from 'react-native'; // ^0.71.0
import { useReducedMotion } from 'react-native-reanimated'; // ^2.14.0

import Card from '../common/Card';
import { Baby } from '../../types/baby.types';
import { DEFAULT_THEME, DARK_THEME, HIGH_CONTRAST_THEME } from '../../constants/theme.constants';

// Milestone data structure
interface Milestone {
  id: string;
  title: string;
  description: string;
  achievedDate?: Date;
  category: 'physical' | 'cognitive' | 'social' | 'language';
  ageRange: {
    min: number; // months
    max: number; // months
  };
}

interface MilestoneCardProps {
  milestone: Milestone;
  baby: Baby;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  highContrast?: boolean;
}

// Styled components with theme support
const StyledTitle = styled(Text)<{ highContrast: boolean }>`
  font-family: ${props => props.theme.typography.fontFamily.primary};
  font-size: ${props => props.theme.typography.fontSize.h4};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.highContrast ? HIGH_CONTRAST_THEME.colors.text : props.theme.colors.text};
  margin-bottom: ${props => props.theme.spacing.xs};
`;

const StyledDescription = styled(Text)<{ highContrast: boolean }>`
  font-family: ${props => props.theme.typography.fontFamily.primary};
  font-size: ${props => props.theme.typography.fontSize.body1};
  color: ${props => props.highContrast ? HIGH_CONTRAST_THEME.colors.text : props.theme.colors.textSecondary};
  line-height: ${props => props.theme.typography.lineHeight.body1};
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const CategoryBadge = styled(View)<{ category: string; highContrast: boolean }>`
  background-color: ${props => props.highContrast ? 
    HIGH_CONTRAST_THEME.colors.surface :
    getCategoryColor(props.category)};
  padding: ${props => props.theme.spacing.xxs} ${props => props.theme.spacing.xs};
  border-radius: 16px;
  align-self: flex-start;
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const BadgeText = styled(Text)<{ highContrast: boolean }>`
  font-family: ${props => props.theme.typography.fontFamily.primary};
  font-size: ${props => props.theme.typography.fontSize.caption};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.highContrast ? HIGH_CONTRAST_THEME.colors.text : props.theme.colors.surface};
`;

const AgeRangeText = styled(Text)<{ highContrast: boolean }>`
  font-family: ${props => props.theme.typography.fontFamily.primary};
  font-size: ${props => props.theme.typography.fontSize.body2};
  color: ${props => props.highContrast ? HIGH_CONTRAST_THEME.colors.text : props.theme.colors.textSecondary};
`;

// Helper function to get category color
const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'physical':
      return DEFAULT_THEME.colors.primary;
    case 'cognitive':
      return DEFAULT_THEME.colors.secondary;
    case 'social':
      return DEFAULT_THEME.colors.monitor.confidenceHigh;
    case 'language':
      return DEFAULT_THEME.colors.accent;
    default:
      return DEFAULT_THEME.colors.primary;
  }
};

// Helper function to format age range
const formatAgeRange = (min: number, max: number): string => {
  return `${min}-${max} months`;
};

export const MilestoneCard = React.memo<MilestoneCardProps>(({
  milestone,
  baby,
  onPress,
  style,
  highContrast = false
}) => {
  // Check for reduced motion preference
  const shouldReduceMotion = useReducedMotion();

  // Animation value for achievement celebration
  const celebrationAnimation = React.useRef(new Animated.Value(0)).current;

  // Calculate if milestone is achieved
  const isAchieved = milestone.achievedDate !== undefined;

  // Calculate if milestone is in current age range
  const babyAgeMonths = React.useMemo(() => {
    const today = new Date();
    const birthDate = new Date(baby.birthDate);
    const diffTime = Math.abs(today.getTime() - birthDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
  }, [baby.birthDate]);

  const isCurrentRange = babyAgeMonths >= milestone.ageRange.min && 
                        babyAgeMonths <= milestone.ageRange.max;

  // Celebration animation effect
  React.useEffect(() => {
    if (isAchieved && !shouldReduceMotion) {
      Animated.sequence([
        Animated.spring(celebrationAnimation, {
          toValue: 1,
          useNativeDriver: true,
          damping: 8,
          stiffness: 100,
        }),
        Animated.timing(celebrationAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAchieved, celebrationAnimation, shouldReduceMotion]);

  return (
    <Card
      variant="elevated"
      elevation={2}
      style={[
        style,
        {
          transform: [{
            scale: celebrationAnimation.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1.05, 1],
            }),
          }],
        },
      ]}
      onPress={onPress}
      accessibilityLabel={`Milestone: ${milestone.title}${isAchieved ? ', Achieved' : ''}`}
      accessibilityRole="button"
      accessibilityHint={onPress ? "Double tap to view milestone details" : undefined}
      accessibilityState={{
        selected: isAchieved,
        disabled: !onPress,
      }}
      reduceMotion={shouldReduceMotion}
    >
      <CategoryBadge 
        category={milestone.category}
        highContrast={highContrast}
        accessibilityRole="text"
      >
        <BadgeText highContrast={highContrast}>
          {milestone.category.toUpperCase()}
        </BadgeText>
      </CategoryBadge>

      <StyledTitle 
        highContrast={highContrast}
        accessibilityRole="header"
      >
        {milestone.title}
      </StyledTitle>

      <StyledDescription 
        highContrast={highContrast}
        accessibilityRole="text"
      >
        {milestone.description}
      </StyledDescription>

      <AgeRangeText 
        highContrast={highContrast}
        accessibilityRole="text"
      >
        {`Expected: ${formatAgeRange(milestone.ageRange.min, milestone.ageRange.max)}`}
        {isAchieved && ` • Achieved: ${new Date(milestone.achievedDate).toLocaleDateString()}`}
      </AgeRangeText>
    </Card>
  );
});

MilestoneCard.displayName = 'MilestoneCard';

export default MilestoneCard;