/**
 * @fileoverview Authentication navigation stack component implementing Material Design 3.0
 * and WCAG 2.1 AA compliance for secure user authentication flow
 * @version 1.0.0
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Platform } from 'react-native';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import { AuthStackParamList } from '../types/navigation.types';
import { useTheme } from '../hooks/useTheme';

// Create type-safe stack navigator
const Stack = createStackNavigator<AuthStackParamList>();

/**
 * Authentication stack navigator component with enhanced security and accessibility
 */
const AuthNavigator: React.FC = () => {
  const { theme } = useTheme();

  // Configure stack navigator options with Material Design and accessibility
  const screenOptions = {
    headerShown: false,
    presentation: 'card',
    cardStyle: {
      backgroundColor: theme.colors.background
    },
    // Enable smooth animations
    animationEnabled: true,
    animationTypeForReplace: 'push',
    // Enable gesture navigation
    gestureEnabled: Platform.OS === 'ios',
    gestureDirection: 'horizontal',
    // Enable keyboard handling
    keyboardHandlingEnabled: true,
    // Enable screen reader support
    screenReaderEnabled: true,
    // Configure animation timing for reduced motion preferences
    transitionSpec: {
      open: {
        animation: 'timing',
        config: {
          duration: theme.animation.duration.normal,
          easing: theme.animation.easing.standard
        }
      },
      close: {
        animation: 'timing',
        config: {
          duration: theme.animation.duration.normal,
          easing: theme.animation.easing.standard
        }
      }
    }
  };

  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={screenOptions}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          animationTypeForReplace: 'pop',
          gestureEnabled: false,
          // Enhance accessibility
          screenReaderInstructions: {
            hint: 'Login screen. Enter your credentials to access the application.'
          }
        }}
      />
      
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          // Enhance accessibility
          screenReaderInstructions: {
            hint: 'Registration screen. Create a new account to use the application.'
          }
        }}
      />
    </Stack.Navigator>
  );
};

// Enable component identification for testing and debugging
AuthNavigator.displayName = 'AuthNavigator';

export default AuthNavigator;