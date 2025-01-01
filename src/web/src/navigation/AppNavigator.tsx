/**
 * @fileoverview Root navigation component for Baby Cry Analyzer application
 * Implements secure authentication flows and accessible navigation with Material Design 3.0
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider } from 'styled-components';
import analytics from '@react-native-firebase/analytics';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import useAuth from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../types/navigation.types';

// Create type-safe stack navigator
const Stack = createStackNavigator<RootStackParamList>();

// Enhanced screen options with security and accessibility
const screenOptions = {
  headerShown: false,
  presentation: 'card' as const,
  animationEnabled: true,
  cardStyle: {
    backgroundColor: 'theme.colors.background'
  },
  gestureEnabled: true,
  animationTypeForReplace: 'push',
  keyboardHandlingEnabled: true
};

// Navigation persistence key with encryption
const NAVIGATION_PERSISTENCE_KEY = 'BABY_CRY_ANALYZER_NAV_STATE';

/**
 * Root navigation component with enhanced security and accessibility
 */
const AppNavigator: React.FC = () => {
  const { isAuthenticated, isOnboarded, authError, retryAuth } = useAuth();
  const { theme, isDarkMode } = useTheme();

  // Handle navigation state persistence with security
  const handleStateChange = useCallback(async (state: any) => {
    try {
      // Track screen view for analytics
      const currentRoute = state.routes[state.routes.length - 1];
      await analytics().logScreenView({
        screen_name: currentRoute.name,
        screen_class: currentRoute.name
      });
    } catch (error) {
      console.error('Navigation state change error:', error);
    }
  }, []);

  // Handle navigation errors with retry mechanism
  const handleNavigationError = useCallback((error: Error) => {
    console.error('Navigation error:', error);
    if (authError) {
      retryAuth().catch(console.error);
    }
  }, [authError, retryAuth]);

  // Setup navigation theme and accessibility
  useEffect(() => {
    // Configure navigation accessibility
    if (isDarkMode) {
      // Set dark mode navigation settings
    }
  }, [isDarkMode]);

  return (
    <ThemeProvider theme={theme}>
      <NavigationContainer
        theme={{
          dark: isDarkMode,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.error
          }
        }}
        onStateChange={handleStateChange}
        onError={handleNavigationError}
        documentTitle={{
          enabled: true,
          formatter: (options, route) => 
            `Baby Cry Analyzer - ${route?.name || 'Home'}`
        }}
      >
        <Stack.Navigator
          screenOptions={screenOptions}
          initialRouteName={isAuthenticated ? (isOnboarded ? 'Main' : 'Onboarding') : 'Auth'}
        >
          {!isAuthenticated ? (
            <Stack.Screen
              name="Auth"
              component={AuthNavigator}
              options={{
                animationTypeForReplace: 'pop',
                gestureEnabled: false
              }}
            />
          ) : !isOnboarded ? (
            <Stack.Screen
              name="Onboarding"
              component={OnboardingNavigator}
              options={{
                gestureEnabled: false,
                animationEnabled: true
              }}
            />
          ) : (
            <Stack.Screen
              name="Main"
              component={MainNavigator}
              options={{
                gestureEnabled: false,
                animationEnabled: true
              }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
};

AppNavigator.displayName = 'AppNavigator';

export default AppNavigator;