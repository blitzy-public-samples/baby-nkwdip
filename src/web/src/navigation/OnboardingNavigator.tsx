/**
 * @fileoverview Onboarding navigation stack component for Baby Cry Analyzer application
 * Implements Material Design 3.0 navigation patterns with WCAG 2.1 AA compliance
 * Version: 1.0.0
 */

import React, { memo, useCallback, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack'; // ^6.0.0
import { useTheme } from '@react-navigation/native'; // ^6.0.0
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import { OnboardingStackParamList } from '../types/navigation.types';

// Create typed stack navigator
const Stack = createStackNavigator<OnboardingStackParamList>();

/**
 * Screen transition configuration for optimal accessibility and UX
 */
const screenOptions = {
  headerShown: false,
  presentation: 'card' as const,
  animationEnabled: true,
  gestureEnabled: false,
  animationDuration: 300,
  keyboardHandlingEnabled: true,
  cardStyle: {
    backgroundColor: 'transparent',
  },
  screenReaderAnnouncement: {
    welcome: 'Welcome to Baby Cry Analyzer setup',
    addBaby: 'Add your baby\'s information',
    permissions: 'Required permissions setup',
  },
};

/**
 * Custom hook for handling navigation errors with fallback options
 */
const useNavigationErrorHandler = () => {
  return useCallback((error: Error) => {
    console.error('Navigation error:', error);
    // Implement error tracking
    return () => {
      // Reset to initial route on critical error
      return { index: 0, routes: [{ name: 'Welcome' }] };
    };
  }, []);
};

/**
 * Onboarding navigation stack component
 * Manages the user onboarding flow with enhanced accessibility and analytics
 */
const OnboardingNavigator = memo(() => {
  const { colors } = useTheme();
  const handleNavigationError = useNavigationErrorHandler();

  // Screen transition announcement for accessibility
  const announceScreenTransition = useCallback((routeName: string) => {
    const announcement = screenOptions.screenReaderAnnouncement[routeName as keyof typeof screenOptions.screenReaderAnnouncement];
    if (announcement) {
      // Use platform-specific accessibility announcement
      if (typeof global.announceForAccessibility === 'function') {
        global.announceForAccessibility(announcement);
      }
    }
  }, []);

  // Cleanup effect for navigation state
  useEffect(() => {
    return () => {
      // Clear any navigation-related resources
    };
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        ...screenOptions,
        cardStyle: {
          ...screenOptions.cardStyle,
          backgroundColor: colors.background,
        },
      }}
      screenListeners={{
        focus: (e) => {
          announceScreenTransition(e.target?.split('-')[0] || '');
        },
      }}
      onError={handleNavigationError}
    >
      <Stack.Screen
        name="Welcome"
        component={OnboardingScreen}
        options={{
          animationTypeForReplace: 'push',
        }}
      />

      <Stack.Screen
        name="AddBaby"
        component={OnboardingScreen}
        options={{
          gestureEnabled: false,
          animationTypeForReplace: 'push',
        }}
      />

      <Stack.Screen
        name="Permissions"
        component={OnboardingScreen}
        options={{
          gestureEnabled: false,
          animationTypeForReplace: 'push',
        }}
      />
    </Stack.Navigator>
  );
});

OnboardingNavigator.displayName = 'OnboardingNavigator';

export default OnboardingNavigator;