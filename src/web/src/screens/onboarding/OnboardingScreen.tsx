/**
 * @fileoverview Onboarding screen component for Baby Cry Analyzer application
 * Implements Material Design 3.0 principles with WCAG 2.1 AA accessibility
 * Supports RTL layouts and multiple languages
 * Version: 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Animated, PanResponder, Dimensions, ImageSourcePropType, Platform } from 'react-native';
import styled from 'styled-components/native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import Button from '../../components/common/Button';
import Text from '../../components/common/Text';
import { setSecureItem } from '../../utils/storage.util';

// Constants for animations and gestures
const SWIPE_THRESHOLD = 50;
const ANIMATION_DURATION = 300;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Interface definitions
interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  image: ImageSourcePropType;
  accessibilityLabel: string;
  testID: string;
}

interface OnboardingScreenProps {
  navigation: any;
  route: any;
}

// Onboarding steps configuration
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'onboarding.step1.title',
    description: 'onboarding.step1.description',
    image: require('../../assets/images/onboarding-1.png'),
    accessibilityLabel: 'onboarding.step1.accessibility',
    testID: 'onboarding-step-1'
  },
  {
    id: 2,
    title: 'onboarding.step2.title',
    description: 'onboarding.step2.description',
    image: require('../../assets/images/onboarding-2.png'),
    accessibilityLabel: 'onboarding.step2.accessibility',
    testID: 'onboarding-step-2'
  },
  {
    id: 3,
    title: 'onboarding.step3.title',
    description: 'onboarding.step3.description',
    image: require('../../assets/images/onboarding-3.png'),
    accessibilityLabel: 'onboarding.step3.accessibility',
    testID: 'onboarding-step-3'
  }
];

// Styled components
const Container = styled(Animated.View)<{ isRTL: boolean }>`
  flex: 1;
  background-color: ${props => props.theme.colors.background};
  direction: ${props => props.isRTL ? 'rtl' : 'ltr'};
`;

const ContentContainer = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.spacing.xl};
`;

const ImageContainer = styled.View`
  width: 100%;
  height: 250px;
  margin-bottom: ${props => props.theme.spacing.xl};
`;

const Image = styled.Image`
  width: 100%;
  height: 100%;
  resize-mode: contain;
`;

const ProgressContainer = styled.View`
  flex-direction: row;
  justify-content: center;
  margin-vertical: ${props => props.theme.spacing.md};
`;

const ProgressDot = styled.View<{ active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  margin-horizontal: ${props => props.theme.spacing.xs};
  background-color: ${props => 
    props.active ? props.theme.colors.primary : props.theme.colors.surfaceVariant};
`;

const ButtonContainer = styled.View`
  padding: ${props => props.theme.spacing.lg};
  flex-direction: row;
  justify-content: space-between;
`;

const OnboardingScreen: React.FC<OnboardingScreenProps> = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Handle RTL layout
  const isRTL = Platform.select({ ios: false, android: false }); // Replace with actual RTL detection

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        return Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderRelease: (_, { dx }) => {
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
          if (dx > 0 && currentStep > 0) {
            handlePrevStep();
          } else if (dx < 0 && currentStep < ONBOARDING_STEPS.length - 1) {
            handleNextStep();
          }
        }
      },
    })
  ).current;

  // Animation handlers
  const animateTransition = useCallback((toValue: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION / 2,
        useNativeDriver: true,
      }).start();
    });
  }, [fadeAnim, slideAnim]);

  // Navigation handlers
  const handleNextStep = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      animateTransition(-SCREEN_WIDTH);
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  }, [currentStep, animateTransition]);

  const handlePrevStep = useCallback(() => {
    if (currentStep > 0) {
      animateTransition(SCREEN_WIDTH);
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep, animateTransition]);

  const completeOnboarding = useCallback(async () => {
    try {
      await setSecureItem('onboarding_completed', true);
      navigation.replace('Home');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }, [navigation]);

  // Reset animation when step changes
  useEffect(() => {
    slideAnim.setValue(0);
  }, [currentStep, slideAnim]);

  const currentStepData = ONBOARDING_STEPS[currentStep];

  return (
    <Container
      isRTL={isRTL}
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX: slideAnim }],
        opacity: fadeAnim,
      }}
    >
      <ContentContainer>
        <ImageContainer>
          <Image
            source={currentStepData.image}
            accessibilityLabel={currentStepData.accessibilityLabel}
            testID={currentStepData.testID}
          />
        </ImageContainer>

        <Text
          variant="h1"
          weight="bold"
          accessibilityRole="header"
          testID={`${currentStepData.testID}-title`}
        >
          {currentStepData.title}
        </Text>

        <Text
          variant="body"
          style={{ textAlign: 'center', marginTop: theme.spacing.md }}
          accessibilityRole="text"
          testID={`${currentStepData.testID}-description`}
        >
          {currentStepData.description}
        </Text>

        <ProgressContainer>
          {ONBOARDING_STEPS.map((_, index) => (
            <ProgressDot
              key={index}
              active={index === currentStep}
              accessibilityLabel={`Step ${index + 1} of ${ONBOARDING_STEPS.length}`}
            />
          ))}
        </ProgressContainer>
      </ContentContainer>

      <ButtonContainer>
        {currentStep > 0 && (
          <Button
            variant="outline"
            onPress={handlePrevStep}
            accessibilityLabel="Previous step"
            testID="onboarding-prev-button"
          >
            Previous
          </Button>
        )}

        <Button
          variant="primary"
          onPress={handleNextStep}
          accessibilityLabel={
            currentStep === ONBOARDING_STEPS.length - 1
              ? "Get started"
              : "Next step"
          }
          testID="onboarding-next-button"
        >
          {currentStep === ONBOARDING_STEPS.length - 1 ? "Get Started" : "Next"}
        </Button>
      </ButtonContainer>
    </Container>
  );
};

export default OnboardingScreen;