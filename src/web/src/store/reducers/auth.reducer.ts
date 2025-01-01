/**
 * @fileoverview Enhanced Redux reducer for authentication state management
 * with comprehensive security features and token handling
 * @version 1.0.0
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.0
import { AUTH_ACTION_TYPES } from '../actions/auth.actions';
import { User, SecuritySettings } from '../../types/user.types';

// Severity levels for errors and security events
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum SecurityEventType {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_EXPIRED = 'token_expired',
  MFA_REQUIRED = 'mfa_required',
  MFA_SUCCESS = 'mfa_success',
  MFA_FAILURE = 'mfa_failure',
  SECURITY_SETTING_CHANGE = 'security_setting_change'
}

export enum SecurityEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Enhanced authentication error interface
export interface AuthError {
  code: string;
  message: string;
  timestamp: number;
  severity: ErrorSeverity;
}

// Security event tracking interface
export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  details: Record<string, unknown>;
  severity: SecurityEventSeverity;
}

// Enhanced authentication state interface
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiration: number | null;
  refreshTokenExpiration: number | null;
  isLoading: boolean;
  error: AuthError | null;
  mfaRequired: boolean;
  mfaVerified: boolean;
  securityEvents: SecurityEvent[];
  lastActivity: number | null;
}

// Initial state with security considerations
export const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiration: null,
  refreshTokenExpiration: null,
  isLoading: false,
  error: null,
  mfaRequired: false,
  mfaVerified: false,
  securityEvents: [],
  lastActivity: null
};

// Enhanced authentication reducer with security features
export const authReducer = createReducer(initialState, (builder) => {
  builder
    // Login request handling
    .addCase(AUTH_ACTION_TYPES.LOGIN_REQUEST, (state) => {
      state.isLoading = true;
      state.error = null;
      state.securityEvents.push({
        type: SecurityEventType.LOGIN_ATTEMPT,
        timestamp: Date.now(),
        details: {},
        severity: SecurityEventSeverity.INFO
      });
    })

    // Successful login handling
    .addCase(AUTH_ACTION_TYPES.LOGIN_SUCCESS, (state, action: PayloadAction<any>) => {
      const { user, accessToken, refreshToken, expiresIn } = action.payload;
      const now = Date.now();

      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.accessTokenExpiration = now + (expiresIn * 1000);
      state.refreshTokenExpiration = now + (30 * 24 * 60 * 60 * 1000); // 30 days
      state.isLoading = false;
      state.error = null;
      state.lastActivity = now;
      
      state.securityEvents.push({
        type: SecurityEventType.LOGIN_SUCCESS,
        timestamp: now,
        details: { userId: user.id },
        severity: SecurityEventSeverity.INFO
      });
    })

    // Login failure handling
    .addCase(AUTH_ACTION_TYPES.LOGIN_FAILURE, (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = {
        code: 'AUTH_FAILED',
        message: action.payload,
        timestamp: Date.now(),
        severity: ErrorSeverity.MEDIUM
      };
      
      state.securityEvents.push({
        type: SecurityEventType.LOGIN_FAILURE,
        timestamp: Date.now(),
        details: { error: action.payload },
        severity: SecurityEventSeverity.WARNING
      });
    })

    // MFA requirement handling
    .addCase(AUTH_ACTION_TYPES.MFA_REQUIRED, (state) => {
      state.mfaRequired = true;
      state.mfaVerified = false;
      state.isLoading = false;
      
      state.securityEvents.push({
        type: SecurityEventType.MFA_REQUIRED,
        timestamp: Date.now(),
        details: {},
        severity: SecurityEventSeverity.INFO
      });
    })

    // MFA success handling
    .addCase(AUTH_ACTION_TYPES.MFA_SUCCESS, (state, action: PayloadAction<any>) => {
      const { user, accessToken, refreshToken, expiresIn } = action.payload;
      const now = Date.now();

      state.mfaRequired = false;
      state.mfaVerified = true;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.accessTokenExpiration = now + (expiresIn * 1000);
      state.lastActivity = now;

      state.securityEvents.push({
        type: SecurityEventType.MFA_SUCCESS,
        timestamp: now,
        details: { userId: user.id },
        severity: SecurityEventSeverity.INFO
      });
    })

    // MFA failure handling
    .addCase(AUTH_ACTION_TYPES.MFA_FAILURE, (state, action: PayloadAction<string>) => {
      state.error = {
        code: 'MFA_FAILED',
        message: action.payload,
        timestamp: Date.now(),
        severity: ErrorSeverity.HIGH
      };
      
      state.securityEvents.push({
        type: SecurityEventType.MFA_FAILURE,
        timestamp: Date.now(),
        details: { error: action.payload },
        severity: SecurityEventSeverity.ERROR
      });
    })

    // Token refresh handling
    .addCase(AUTH_ACTION_TYPES.REFRESH_TOKEN, (state, action: PayloadAction<any>) => {
      const { accessToken, expiresIn } = action.payload;
      const now = Date.now();

      state.accessToken = accessToken;
      state.accessTokenExpiration = now + (expiresIn * 1000);
      state.lastActivity = now;

      state.securityEvents.push({
        type: SecurityEventType.TOKEN_REFRESH,
        timestamp: now,
        details: {},
        severity: SecurityEventSeverity.INFO
      });
    })

    // Token expiration handling
    .addCase(AUTH_ACTION_TYPES.TOKEN_EXPIRED, (state) => {
      state.accessToken = null;
      state.accessTokenExpiration = null;
      
      state.securityEvents.push({
        type: SecurityEventType.TOKEN_EXPIRED,
        timestamp: Date.now(),
        details: {},
        severity: SecurityEventSeverity.WARNING
      });
    })

    // Logout handling
    .addCase(AUTH_ACTION_TYPES.LOGOUT, (state) => {
      const timestamp = Date.now();
      
      // Store logout event before clearing state
      const logoutEvent: SecurityEvent = {
        type: SecurityEventType.LOGOUT,
        timestamp,
        details: { userId: state.user?.id },
        severity: SecurityEventSeverity.INFO
      };

      // Reset state to initial values
      Object.assign(state, {
        ...initialState,
        securityEvents: [...state.securityEvents, logoutEvent]
      });
    })

    // Security event handling
    .addCase(AUTH_ACTION_TYPES.SECURITY_EVENT, (state, action: PayloadAction<SecurityEvent>) => {
      state.securityEvents.push({
        ...action.payload,
        timestamp: Date.now()
      });

      // Maintain last 100 security events
      if (state.securityEvents.length > 100) {
        state.securityEvents = state.securityEvents.slice(-100);
      }
    });
});

export default authReducer;