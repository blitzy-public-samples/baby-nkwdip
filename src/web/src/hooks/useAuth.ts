/**
 * @fileoverview Enhanced authentication hook with secure token management and MFA support
 * @version 1.0.0
 * @license MIT
 */

import { useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  loginRequest,
  loginSuccess,
  loginFailure,
  logout,
  refreshToken,
  setAuthError,
  clearAuthError
} from '../store/actions/auth.actions';
import { User, AuthResponse } from '../types/user.types';
import { AuthState } from '../store/reducers/auth.reducer';

// Constants for token management
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes
const MAX_RETRY_ATTEMPTS = 3;
const ERROR_RETRY_DELAY = 1000; // 1 second
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes

/**
 * Interface defining the return type of useAuth hook
 */
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

/**
 * Enhanced authentication hook with security features
 * @returns {UseAuthReturn} Authentication state and operations
 */
export const useAuth = (): UseAuthReturn => {
  const dispatch = useDispatch();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryAttemptsRef = useRef<number>(0);

  // Select auth state from Redux store
  const {
    user,
    isLoading,
    error,
    accessToken,
    refreshToken: refreshTokenValue,
    accessTokenExpiration,
    mfaRequired,
    lastActivity
  } = useSelector((state: { auth: AuthState }) => state.auth);

  /**
   * Validates token expiration with buffer time
   */
  const isTokenExpiring = useCallback((): boolean => {
    if (!accessTokenExpiration) return true;
    return Date.now() + TOKEN_EXPIRY_BUFFER >= accessTokenExpiration;
  }, [accessTokenExpiration]);

  /**
   * Handles automatic token refresh
   */
  const handleTokenRefresh = useCallback(async (): Promise<void> => {
    try {
      if (!refreshTokenValue || !isTokenExpiring()) return;

      if (retryAttemptsRef.current >= MAX_RETRY_ATTEMPTS) {
        dispatch(logout());
        return;
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshTokenValue}`
        }
      });

      if (!response.ok) throw new Error('Token refresh failed');

      const data: AuthResponse = await response.json();
      dispatch(refreshToken(data));
      retryAttemptsRef.current = 0;
    } catch (error) {
      retryAttemptsRef.current++;
      setTimeout(handleTokenRefresh, ERROR_RETRY_DELAY);
    }
  }, [dispatch, refreshTokenValue, isTokenExpiring]);

  /**
   * Setup token refresh interval
   */
  useEffect(() => {
    if (accessToken && !refreshTimerRef.current) {
      refreshTimerRef.current = setInterval(handleTokenRefresh, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [accessToken, handleTokenRefresh]);

  /**
   * Monitor user activity and token expiration
   */
  useEffect(() => {
    if (lastActivity && Date.now() - lastActivity > TOKEN_REFRESH_INTERVAL * 2) {
      dispatch(logout());
    }
  }, [dispatch, lastActivity]);

  /**
   * Enhanced login function with security measures
   */
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      dispatch(loginRequest({ email, password }));

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data: AuthResponse = await response.json();

      if (data.user.securitySettings.mfaEnabled) {
        // Handle MFA flow
        return;
      }

      dispatch(loginSuccess(data));
    } catch (error) {
      dispatch(loginFailure(error.message));
    }
  }, [dispatch]);

  /**
   * Enhanced logout function with cleanup
   */
  const handleLogout = useCallback((): void => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    dispatch(logout());
  }, [dispatch]);

  /**
   * Clear authentication errors
   */
  const handleClearError = useCallback((): void => {
    dispatch(clearAuthError());
  }, [dispatch]);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!accessToken && !isTokenExpiring(),
    login,
    logout: handleLogout,
    clearError: handleClearError
  };
};

export default useAuth;