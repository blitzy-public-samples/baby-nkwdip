/**
 * @fileoverview TypeScript type definitions for user-related data structures
 * @version 1.0.0
 * @license MIT
 */

/**
 * Enumeration of available user roles with granular access control
 */
export enum UserRole {
  PARENT = 'PARENT',
  CAREGIVER = 'CAREGIVER',
  EXPERT = 'EXPERT',
  ADMIN = 'ADMIN'
}

/**
 * Interface for notification preferences
 */
export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  frequency: 'immediate' | 'hourly' | 'daily';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

/**
 * Interface for security questions and answers
 */
export interface SecurityQuestion {
  questionId: string;
  question: string;
  hashedAnswer: string;
  lastUpdated: Date;
}

/**
 * Interface for user security settings with enhanced protection
 */
export interface SecuritySettings {
  mfaEnabled: boolean;
  lastPasswordChange: Date;
  securityQuestions: SecurityQuestion[];
  loginAttempts: number;
  lastFailedLogin?: Date;
  passwordResetRequired: boolean;
}

/**
 * Interface for user preferences and customization
 */
export interface UserPreferences {
  language: string;
  notifications: NotificationSettings;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  dataRetention: number; // in days
  audioQuality: 'low' | 'medium' | 'high';
}

/**
 * Comprehensive user data structure with security considerations
 */
export interface User {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  lastLogin: Date;
  isActive: boolean;
  preferences: UserPreferences;
  securitySettings: SecuritySettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Login credentials with MFA support
 */
export interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
  deviceId?: string;
  rememberDevice?: boolean;
}

/**
 * Registration data with required fields and preferences
 */
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  preferences: UserPreferences;
  securityQuestions: Array<{
    questionId: string;
    answer: string;
  }>;
}

/**
 * Authentication response with token management
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Token validation response
 */
export interface TokenValidation {
  valid: boolean;
  expired: boolean;
  payload?: {
    userId: string;
    roles: UserRole[];
    exp: number;
  };
}

/**
 * Password reset request payload
 */
export interface PasswordResetRequest {
  email: string;
  securityQuestionId: string;
  securityAnswer: string;
  newPassword: string;
}

// Constants for token management
export const TOKEN_EXPIRY = 3600; // 1 hour in seconds
export const REFRESH_TOKEN_EXPIRY = 2592000; // 30 days in seconds
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Type guard to check if a role has admin privileges
 */
export const isAdminRole = (role: UserRole): boolean => {
  return role === UserRole.ADMIN;
};

/**
 * Type guard to check if a user has specific role
 */
export const hasRole = (user: User, role: UserRole): boolean => {
  return user.roles.includes(role);
};

/**
 * Type for role-based access control permissions
 */
export type RolePermissions = {
  [key in UserRole]: {
    monitor: boolean;
    history: boolean;
    profile: boolean;
    settings: boolean;
    admin: boolean;
    expertAccess: boolean;
  };
};

/**
 * Default role permissions configuration
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.PARENT]: {
    monitor: true,
    history: true,
    profile: true,
    settings: true,
    admin: false,
    expertAccess: false
  },
  [UserRole.CAREGIVER]: {
    monitor: true,
    history: true,
    profile: false,
    settings: false,
    admin: false,
    expertAccess: false
  },
  [UserRole.EXPERT]: {
    monitor: false,
    history: true,
    profile: false,
    settings: false,
    admin: false,
    expertAccess: true
  },
  [UserRole.ADMIN]: {
    monitor: true,
    history: true,
    profile: true,
    settings: true,
    admin: true,
    expertAccess: true
  }
};