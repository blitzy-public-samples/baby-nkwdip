import { NavigatorScreenParams } from '@react-navigation/native'; // ^6.0.0
import { Baby } from '../types/baby.types';

/**
 * Type definition for monitoring mode options
 */
export type MonitoringMode = 'active' | 'background';

/**
 * Type definition for sensitivity level settings
 */
export type SensitivityLevel = 'low' | 'medium' | 'high';

/**
 * Type definition for time range options in history view
 */
export type TimeRange = 'day' | 'week' | 'month' | 'custom';

/**
 * Type definition for available navigation screens in main stack
 */
export type NavigationScreens = keyof MainStackParamList;

/**
 * Root navigation stack parameter list
 * Defines the top-level navigation structure of the application
 */
export interface RootStackParamList {
  Auth: undefined;
  Main: NavigatorScreenParams<MainStackParamList>;
  Onboarding: undefined;
}

/**
 * Authentication flow navigation parameter list
 * Handles user authentication related screens
 */
export interface AuthStackParamList {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
}

/**
 * Main application navigation parameter list
 * Contains type-safe route parameters for core application screens
 */
export interface MainStackParamList {
  Home: undefined;
  Monitor: {
    babyId: string;
    babyName: string;
    monitoringMode: MonitoringMode;
    sensitivity: SensitivityLevel;
  };
  History: {
    babyId: string;
    timeRange: TimeRange;
    startDate?: string;
    endDate?: string;
  };
  Profile: {
    section?: 'personal' | 'preferences' | 'notifications';
  };
  Settings: undefined;
}

/**
 * Onboarding flow navigation parameter list
 * Manages the new user setup process
 */
export interface OnboardingStackParamList {
  Welcome: undefined;
  AddBaby: {
    isFirstBaby: boolean;
  };
  Permissions: {
    requiredPermissions: string[];
  };
  Setup: {
    setupStep: number;
    totalSteps: number;
  };
}