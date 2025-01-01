/**
 * @fileoverview Redux action creators and types for authentication operations
 * with enhanced security features in the Baby Cry Analyzer web application
 * @version 1.0.0
 */

import { createAction } from '@reduxjs/toolkit'; // ^1.9.0
import { 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse, 
  SecuritySettings,
  MFACredentials,
  TokenPayload 
} from '../../types/user.types';
import { AuthService } from '../../services/auth.service';

// Action type constants with enhanced security events
export const AUTH_ACTION_TYPES = {
  LOGIN_REQUEST: 'auth/loginRequest',
  LOGIN_SUCCESS: 'auth/loginSuccess',
  LOGIN_FAILURE: 'auth/loginFailure',
  REGISTER_REQUEST: 'auth/registerRequest',
  REGISTER_SUCCESS: 'auth/registerSuccess',
  REGISTER_FAILURE: 'auth/registerFailure',
  LOGOUT: 'auth/logout',
  REFRESH_TOKEN_REQUEST: 'auth/refreshTokenRequest',
  REFRESH_TOKEN_SUCCESS: 'auth/refreshTokenSuccess',
  REFRESH_TOKEN_FAILURE: 'auth/refreshTokenFailure',
  MFA_REQUIRED: 'auth/mfaRequired',
  MFA_SUCCESS: 'auth/mfaSuccess',
  MFA_FAILURE: 'auth/mfaFailure',
  SECURITY_EVENT: 'auth/securityEvent',
  TOKEN_EXPIRED: 'auth/tokenExpired',
  SET_AUTH_ERROR: 'auth/setError'
} as const;

// Interface for security events
interface SecurityEvent {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  details: Record<string, unknown>;
}

// Action creators with enhanced security features
export const loginRequest = createAction<LoginCredentials>(
  AUTH_ACTION_TYPES.LOGIN_REQUEST
);

export const loginSuccess = createAction<AuthResponse>(
  AUTH_ACTION_TYPES.LOGIN_SUCCESS
);

export const loginFailure = createAction<string>(
  AUTH_ACTION_TYPES.LOGIN_FAILURE
);

export const registerRequest = createAction<RegisterData>(
  AUTH_ACTION_TYPES.REGISTER_REQUEST
);

export const registerSuccess = createAction<AuthResponse>(
  AUTH_ACTION_TYPES.REGISTER_SUCCESS
);

export const registerFailure = createAction<string>(
  AUTH_ACTION_TYPES.REGISTER_FAILURE
);

export const logout = createAction(AUTH_ACTION_TYPES.LOGOUT);

export const refreshTokenRequest = createAction<string>(
  AUTH_ACTION_TYPES.REFRESH_TOKEN_REQUEST
);

export const refreshTokenSuccess = createAction<string>(
  AUTH_ACTION_TYPES.REFRESH_TOKEN_SUCCESS
);

export const refreshTokenFailure = createAction<string>(
  AUTH_ACTION_TYPES.REFRESH_TOKEN_FAILURE
);

export const mfaRequired = createAction<MFACredentials>(
  AUTH_ACTION_TYPES.MFA_REQUIRED
);

export const mfaSuccess = createAction<AuthResponse>(
  AUTH_ACTION_TYPES.MFA_SUCCESS
);

export const mfaFailure = createAction<string>(
  AUTH_ACTION_TYPES.MFA_FAILURE
);

export const securityEvent = createAction<SecurityEvent>(
  AUTH_ACTION_TYPES.SECURITY_EVENT
);

export const tokenExpired = createAction(
  AUTH_ACTION_TYPES.TOKEN_EXPIRED
);

export const setAuthError = createAction<string>(
  AUTH_ACTION_TYPES.SET_AUTH_ERROR
);

// Thunk action creators with security enhancements
export const initiateLogin = (credentials: LoginCredentials) => async (dispatch: any) => {
  try {
    dispatch(loginRequest(credentials));
    const authService = AuthService.getInstance();
    const response = await authService.login(credentials);

    if (response.user.securitySettings.mfaEnabled) {
      dispatch(mfaRequired({
        email: credentials.email,
        sessionToken: response.accessToken
      }));
      return;
    }

    dispatch(loginSuccess(response));
    dispatch(securityEvent({
      type: 'login_success',
      severity: 'low',
      timestamp: Date.now(),
      details: { email: credentials.email }
    }));
  } catch (error) {
    dispatch(loginFailure(error.message));
    dispatch(securityEvent({
      type: 'login_failure',
      severity: 'medium',
      timestamp: Date.now(),
      details: { 
        email: credentials.email,
        error: error.message 
      }
    }));
  }
};

export const handleMFAChallenge = (mfaData: MFACredentials) => async (dispatch: any) => {
  try {
    dispatch(mfaRequired(mfaData));
    const authService = AuthService.getInstance();
    const response = await authService.handleMFA(mfaData);
    
    dispatch(mfaSuccess(response));
    dispatch(securityEvent({
      type: 'mfa_success',
      severity: 'low',
      timestamp: Date.now(),
      details: { email: mfaData.email }
    }));
  } catch (error) {
    dispatch(mfaFailure(error.message));
    dispatch(securityEvent({
      type: 'mfa_failure',
      severity: 'high',
      timestamp: Date.now(),
      details: { 
        email: mfaData.email,
        error: error.message 
      }
    }));
  }
};

export const initiateTokenRefresh = (refreshToken: string) => async (dispatch: any) => {
  try {
    dispatch(refreshTokenRequest(refreshToken));
    const authService = AuthService.getInstance();
    const newToken = await authService.refreshToken(refreshToken);
    
    if (await authService.validateToken(newToken)) {
      dispatch(refreshTokenSuccess(newToken));
    } else {
      throw new Error('Invalid token received');
    }
  } catch (error) {
    dispatch(refreshTokenFailure(error.message));
    dispatch(tokenExpired());
    dispatch(securityEvent({
      type: 'token_refresh_failure',
      severity: 'high',
      timestamp: Date.now(),
      details: { error: error.message }
    }));
  }
};

export const initiateLogout = () => async (dispatch: any) => {
  try {
    const authService = AuthService.getInstance();
    await authService.logout();
    dispatch(logout());
    dispatch(securityEvent({
      type: 'logout_success',
      severity: 'low',
      timestamp: Date.now(),
      details: {}
    }));
  } catch (error) {
    dispatch(setAuthError(error.message));
    dispatch(securityEvent({
      type: 'logout_failure',
      severity: 'medium',
      timestamp: Date.now(),
      details: { error: error.message }
    }));
  }
};