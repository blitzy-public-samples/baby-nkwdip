/**
 * @fileoverview Utility functions for validating user inputs, form data, and data structures
 * @version 1.0.0
 * @license MIT
 */

import { isEmail, isDate, escape } from 'validator'; // ^13.7.0
import { User } from '../types/user.types';
import { Baby, BabyPreferences } from '../types/baby.types';

// Constants for validation rules
const PASSWORD_MIN_LENGTH = 8;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 255;
const RETENTION_PERIOD_MIN = 30; // days
const RETENTION_PERIOD_MAX = 730; // days (2 years)
const MAX_BIRTH_DATE_AGE_YEARS = 3;

// Allowed email domains for enhanced security
const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com'
];

/**
 * Validates email format and requirements with enhanced security checks
 * @param email - Email address to validate
 * @returns boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Sanitize email input
  const sanitizedEmail = escape(email.trim().toLowerCase());

  // Basic validation checks
  if (sanitizedEmail.length > EMAIL_MAX_LENGTH) {
    return false;
  }

  if (!isEmail(sanitizedEmail)) {
    return false;
  }

  // Domain validation
  const domain = sanitizedEmail.split('@')[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return false;
  }

  return true;
};

/**
 * Validates password strength and requirements with enhanced security measures
 * @param password - Password to validate
 * @returns boolean indicating if password meets requirements
 */
export const validatePassword = (password: string): boolean => {
  if (!password || typeof password !== 'string') {
    return false;
  }

  // Length check
  if (password.length < PASSWORD_MIN_LENGTH) {
    return false;
  }

  // Character type checks
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return false;
  }

  // Check for common patterns
  const hasCommonPatterns = /password|123456|qwerty|admin/i.test(password);
  if (hasCommonPatterns) {
    return false;
  }

  return true;
};

/**
 * Validates baby profile data with comprehensive preference validation
 * @param profile - Baby profile to validate
 * @returns Validation result with errors and warnings
 */
export const validateBabyProfile = (profile: Baby): { 
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!profile.name || typeof profile.name !== 'string') {
    errors.push('Name is required');
  } else {
    const sanitizedName = escape(profile.name.trim());
    if (sanitizedName.length < NAME_MIN_LENGTH || sanitizedName.length > NAME_MAX_LENGTH) {
      errors.push(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);
    }
  }

  // Validate birth date
  if (!profile.birthDate) {
    errors.push('Birth date is required');
  } else {
    const birthDate = new Date(profile.birthDate);
    const now = new Date();
    const maxAge = new Date(now.setFullYear(now.getFullYear() - MAX_BIRTH_DATE_AGE_YEARS));
    
    if (birthDate > now) {
      errors.push('Birth date cannot be in the future');
    }
    if (birthDate < maxAge) {
      errors.push(`Birth date cannot be more than ${MAX_BIRTH_DATE_AGE_YEARS} years ago`);
    }
  }

  // Validate preferences
  if (!profile.preferences) {
    errors.push('Preferences are required');
  } else {
    validateBabyPreferences(profile.preferences, errors, warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates user profile data with enhanced security checks
 * @param profile - User profile to validate
 * @returns Validation result with errors and warnings
 */
export const validateUserProfile = (profile: User): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate email
  if (!validateEmail(profile.email)) {
    errors.push('Invalid email address');
  }

  // Validate name
  if (!profile.name || typeof profile.name !== 'string') {
    errors.push('Name is required');
  } else {
    const sanitizedName = escape(profile.name.trim());
    if (sanitizedName.length < NAME_MIN_LENGTH || sanitizedName.length > NAME_MAX_LENGTH) {
      errors.push(`Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`);
    }
  }

  // Validate roles
  if (!profile.roles || !Array.isArray(profile.roles) || profile.roles.length === 0) {
    errors.push('At least one role is required');
  }

  // Validate preferences
  if (!profile.preferences) {
    errors.push('Preferences are required');
  } else {
    validateUserPreferences(profile.preferences, errors, warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Helper function to validate baby preferences
 * @param preferences - Baby preferences to validate
 * @param errors - Array to collect validation errors
 * @param warnings - Array to collect validation warnings
 */
const validateBabyPreferences = (
  preferences: BabyPreferences,
  errors: string[],
  warnings: string[]
): void => {
  // Validate monitoring settings
  if (typeof preferences.monitoringEnabled !== 'boolean') {
    errors.push('Monitoring enabled setting must be a boolean');
  }

  if (typeof preferences.notificationsEnabled !== 'boolean') {
    errors.push('Notifications enabled setting must be a boolean');
  }

  // Validate sensitivity settings
  if (!['low', 'medium', 'high'].includes(preferences.sensitivity)) {
    errors.push('Invalid sensitivity level');
  }

  // Validate noise threshold
  if (typeof preferences.noiseThreshold !== 'number' || 
      preferences.noiseThreshold < 0 || 
      preferences.noiseThreshold > 100) {
    errors.push('Noise threshold must be between 0 and 100');
  }

  // Validate recording duration
  if (typeof preferences.recordingDuration !== 'number' || 
      preferences.recordingDuration < 10 || 
      preferences.recordingDuration > 300) {
    errors.push('Recording duration must be between 10 and 300 seconds');
  }

  // Add warnings for potentially risky settings
  if (!preferences.backgroundMonitoring) {
    warnings.push('Background monitoring is disabled');
  }
  if (!preferences.autoAnalysis) {
    warnings.push('Automatic analysis is disabled');
  }
};

/**
 * Helper function to validate user preferences
 * @param preferences - User preferences to validate
 * @param errors - Array to collect validation errors
 * @param warnings - Array to collect validation warnings
 */
const validateUserPreferences = (
  preferences: User['preferences'],
  errors: string[],
  warnings: string[]
): void => {
  // Validate data retention period
  if (typeof preferences.dataRetention !== 'number' || 
      preferences.dataRetention < RETENTION_PERIOD_MIN || 
      preferences.dataRetention > RETENTION_PERIOD_MAX) {
    errors.push(`Data retention period must be between ${RETENTION_PERIOD_MIN} and ${RETENTION_PERIOD_MAX} days`);
  }

  // Validate notification settings
  if (!preferences.notifications) {
    errors.push('Notification settings are required');
  } else {
    if (typeof preferences.notifications.email !== 'boolean') {
      errors.push('Email notification setting must be a boolean');
    }
    if (typeof preferences.notifications.push !== 'boolean') {
      errors.push('Push notification setting must be a boolean');
    }
    if (!['immediate', 'hourly', 'daily'].includes(preferences.notifications.frequency)) {
      errors.push('Invalid notification frequency');
    }
  }

  // Validate timezone
  if (!preferences.timezone) {
    errors.push('Timezone is required');
  }

  // Add warnings for potentially risky settings
  if (!preferences.notifications.email && !preferences.notifications.push) {
    warnings.push('All notifications are disabled');
  }
};