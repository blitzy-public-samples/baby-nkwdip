/**
 * @fileoverview Comprehensive test suite for authentication reducer
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import { authReducer, AuthState, ErrorSeverity, SecurityEventType, SecurityEventSeverity } from '../../store/reducers/auth.reducer';
import {
  loginRequest,
  loginSuccess,
  loginFailure,
  registerRequest,
  registerSuccess,
  registerFailure,
  logout,
  refreshToken,
  setAuthError,
  mfaRequired,
  mfaSuccess,
  mfaFailure,
  securityEvent,
  tokenExpired
} from '../../store/actions/auth.actions';
import { User, UserRole } from '../../types/user.types';

describe('authReducer', () => {
  let initialState: AuthState;
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    roles: [UserRole.PARENT],
    lastLogin: new Date(),
    isActive: true,
    preferences: {
      language: 'en',
      notifications: {
        email: true,
        push: true,
        sms: false,
        frequency: 'immediate',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '07:00'
        }
      },
      timezone: 'UTC',
      theme: 'light',
      dataRetention: 90,
      audioQuality: 'high'
    },
    securitySettings: {
      mfaEnabled: true,
      lastPasswordChange: new Date('2023-01-01'),
      securityQuestions: [],
      loginAttempts: 0,
      passwordResetRequired: false
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    initialState = {
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
  });

  describe('Login Flow', () => {
    it('should handle login request', () => {
      const nextState = authReducer(initialState, loginRequest({ email: 'test@example.com', password: 'password' }));
      expect(nextState.isLoading).toBe(true);
      expect(nextState.error).toBeNull();
      expect(nextState.securityEvents[0]).toEqual({
        type: SecurityEventType.LOGIN_ATTEMPT,
        timestamp: expect.any(Number),
        details: {},
        severity: SecurityEventSeverity.INFO
      });
    });

    it('should handle successful login', () => {
      const mockResponse = {
        user: mockUser,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600
      };

      const nextState = authReducer(initialState, loginSuccess(mockResponse));
      expect(nextState.user).toEqual(mockUser);
      expect(nextState.accessToken).toBe(mockResponse.accessToken);
      expect(nextState.refreshToken).toBe(mockResponse.refreshToken);
      expect(nextState.accessTokenExpiration).toBeDefined();
      expect(nextState.refreshTokenExpiration).toBeDefined();
      expect(nextState.isLoading).toBe(false);
      expect(nextState.error).toBeNull();
      expect(nextState.lastActivity).toBeDefined();
    });

    it('should handle login failure', () => {
      const errorMessage = 'Invalid credentials';
      const nextState = authReducer(initialState, loginFailure(errorMessage));
      expect(nextState.isLoading).toBe(false);
      expect(nextState.error).toEqual({
        code: 'AUTH_FAILED',
        message: errorMessage,
        timestamp: expect.any(Number),
        severity: ErrorSeverity.MEDIUM
      });
      expect(nextState.securityEvents[0].type).toBe(SecurityEventType.LOGIN_FAILURE);
    });
  });

  describe('MFA Flow', () => {
    it('should handle MFA requirement', () => {
      const nextState = authReducer(initialState, mfaRequired());
      expect(nextState.mfaRequired).toBe(true);
      expect(nextState.mfaVerified).toBe(false);
      expect(nextState.isLoading).toBe(false);
      expect(nextState.securityEvents[0].type).toBe(SecurityEventType.MFA_REQUIRED);
    });

    it('should handle MFA success', () => {
      const mockResponse = {
        user: mockUser,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600
      };

      const nextState = authReducer(initialState, mfaSuccess(mockResponse));
      expect(nextState.mfaRequired).toBe(false);
      expect(nextState.mfaVerified).toBe(true);
      expect(nextState.user).toEqual(mockUser);
      expect(nextState.accessToken).toBe(mockResponse.accessToken);
      expect(nextState.securityEvents[0].type).toBe(SecurityEventType.MFA_SUCCESS);
    });

    it('should handle MFA failure', () => {
      const errorMessage = 'Invalid MFA code';
      const nextState = authReducer(initialState, mfaFailure(errorMessage));
      expect(nextState.error).toEqual({
        code: 'MFA_FAILED',
        message: errorMessage,
        timestamp: expect.any(Number),
        severity: ErrorSeverity.HIGH
      });
      expect(nextState.securityEvents[0].type).toBe(SecurityEventType.MFA_FAILURE);
    });
  });

  describe('Token Management', () => {
    it('should handle token refresh', () => {
      const mockTokenResponse = {
        accessToken: 'new-access-token',
        expiresIn: 3600
      };

      const nextState = authReducer(initialState, refreshToken(mockTokenResponse));
      expect(nextState.accessToken).toBe(mockTokenResponse.accessToken);
      expect(nextState.accessTokenExpiration).toBeDefined();
      expect(nextState.lastActivity).toBeDefined();
      expect(nextState.securityEvents[0].type).toBe(SecurityEventType.TOKEN_REFRESH);
    });

    it('should handle token expiration', () => {
      const stateWithToken = {
        ...initialState,
        accessToken: 'expired-token',
        accessTokenExpiration: Date.now() - 1000
      };

      const nextState = authReducer(stateWithToken, tokenExpired());
      expect(nextState.accessToken).toBeNull();
      expect(nextState.accessTokenExpiration).toBeNull();
      expect(nextState.securityEvents[0].type).toBe(SecurityEventType.TOKEN_EXPIRED);
    });
  });

  describe('Security Events', () => {
    it('should maintain security event history', () => {
      let state = initialState;
      const events = Array(105).fill(null).map((_, index) => ({
        type: SecurityEventType.LOGIN_ATTEMPT,
        timestamp: Date.now() + index,
        details: { attemptId: index },
        severity: SecurityEventSeverity.INFO
      }));

      events.forEach(event => {
        state = authReducer(state, securityEvent(event));
      });

      expect(state.securityEvents.length).toBe(100);
      expect(state.securityEvents[99].details.attemptId).toBe(104);
    });

    it('should track security events during logout', () => {
      const stateWithUser = {
        ...initialState,
        user: mockUser,
        accessToken: 'test-token'
      };

      const nextState = authReducer(stateWithUser, logout());
      expect(nextState.user).toBeNull();
      expect(nextState.accessToken).toBeNull();
      expect(nextState.securityEvents[0]).toEqual({
        type: SecurityEventType.LOGOUT,
        timestamp: expect.any(Number),
        details: { userId: mockUser.id },
        severity: SecurityEventSeverity.INFO
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle auth errors with severity levels', () => {
      const criticalError = 'Security breach detected';
      const state = authReducer(initialState, setAuthError(criticalError));
      expect(state.error).toEqual({
        code: 'AUTH_FAILED',
        message: criticalError,
        timestamp: expect.any(Number),
        severity: ErrorSeverity.HIGH
      });
    });
  });
});