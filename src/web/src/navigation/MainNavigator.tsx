/**
 * @fileoverview Main navigation component implementing Material Design 3.0 bottom tab navigation
 * with WCAG 2.1 AA compliance and analytics integration
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { useTheme } from 'styled-components';
import analytics from '@react-native-firebase/analytics';

import HomeScreen from '../screens/home/HomeScreen';
import MonitorScreen from '../screens/monitor/MonitorScreen';
import HistoryScreen from '../screens/history/HistoryScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import TabBar from '../components/common/TabBar';
import { MainStackParamList } from '../types/navigation.types';

// Create typed bottom tab navigator
const Tab = createBottomTabNavigator<MainStackParamList>();

// Screen configuration with accessibility and analytics
const SCREEN_OPTIONS = {
  headerShown: false,
  tabBarHideOnKeyboard: true,
  tabBarActiveTintColor: 'theme.colors.primary',
  tabBarInactiveTintColor: 'theme.colors.text',
  tabBarStyle: {
    height: 60,
    paddingBottom: 8,
    backgroundColor: 'theme.colors.surface',
    borderTopColor: 'theme.colors.border',
    minHeight: 44, // WCAG minimum touch target size
    accessibilityRole: 'tablist',
    accessibilityLabel: 'Main navigation'
  },
  lazy: true,
  freezeOnBlur: true
};

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  minimumTouchSize: 44,
  delayPressIn: 0,
  screenReaderEnabled: true,
  accessibilityRole: 'tab',
  accessibilityState: { selected: 'boolean' }
};

/**
 * Main navigation component implementing bottom tab navigation
 * with accessibility and analytics integration
 */
const MainNavigator: React.FC = () => {
  const theme = useTheme();

  // Track screen views for analytics
  const handleNavigationStateChange = useCallback(async () => {
    const currentRoute = Tab.getCurrentRoute();
    if (currentRoute) {
      await analytics().logScreenView({
        screen_name: currentRoute.name,
        screen_class: currentRoute.name
      });
    }
  }, []);

  // Initialize navigation container
  useEffect(() => {
    const unsubscribe = Tab.addListener('state', handleNavigationStateChange);
    return () => unsubscribe();
  }, [handleNavigationStateChange]);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={SCREEN_OPTIONS}
        tabBar={props => <TabBar {...props} />}
        initialRouteName="Home"
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarAccessibilityLabel: 'Home screen',
            unmountOnBlur: false
          }}
        />
        <Tab.Screen
          name="Monitor"
          component={MonitorScreen}
          options={{
            tabBarLabel: 'Monitor',
            tabBarAccessibilityLabel: 'Baby monitoring screen',
            unmountOnBlur: true // Clean up monitoring resources when leaving
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarLabel: 'History',
            tabBarAccessibilityLabel: 'Cry history screen',
            unmountOnBlur: false
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarAccessibilityLabel: 'User profile screen',
            unmountOnBlur: false
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

MainNavigator.displayName = 'MainNavigator';

export default React.memo(MainNavigator);