/**
 * @fileoverview Enhanced login screen component with Material Design 3.0 and WCAG 2.1 AA compliance
 * Implements secure authentication flow with comprehensive error handling and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';

// Constants for rate limiting and validation
const MAX_LOGIN_ATTEMPTS = 3;
const ATTEMPT_RESET_TIME = 300000; // 5 minutes
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Enhanced login screen component with security features
 */
const LoginScreen: React.FC = React.memo(() => {
  // State management
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lastAttempt, setLastAttempt] = useState(0);

  // Hooks
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { login, loading, error: authError } = useAuth();

  /**
   * Reset error states when screen gains focus
   */
  useEffect(() => {
    if (isFocused) {
      setEmailError('');
      setPasswordError('');
    }
  }, [isFocused]);

  /**
   * Validate email format
   */
  const validateEmail = useCallback((value: string): boolean => {
    if (!value) {
      setEmailError('Email is required');
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  }, []);

  /**
   * Validate password requirements
   */
  const validatePassword = useCallback((value: string): boolean => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }
    if (value.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return false;
    }
    setPasswordError('');
    return true;
  }, []);

  /**
   * Check rate limiting before login attempt
   */
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      if (now - lastAttempt < ATTEMPT_RESET_TIME) {
        Alert.alert(
          'Too Many Attempts',
          'Please try again in 5 minutes',
          [{ text: 'OK' }],
          { cancelable: false }
        );
        return false;
      }
      setAttempts(0);
    }
    return true;
  }, [attempts, lastAttempt]);

  /**
   * Handle login form submission with security measures
   */
  const handleLogin = useCallback(async () => {
    try {
      // Validate inputs
      const isEmailValid = validateEmail(email);
      const isPasswordValid = validatePassword(password);
      
      if (!isEmailValid || !isPasswordValid) {
        return;
      }

      // Check rate limiting
      if (!checkRateLimit()) {
        return;
      }

      // Attempt login
      await login(email, password);
      
      // Reset attempts on success
      setAttempts(0);
      setLastAttempt(0);
    } catch (error) {
      // Update attempt tracking
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setLastAttempt(Date.now());

      // Show error message
      Alert.alert(
        'Login Failed',
        error.message || 'Please check your credentials and try again',
        [{ text: 'OK' }],
        { cancelable: false }
      );
    }
  }, [email, password, attempts, validateEmail, validatePassword, checkRateLimit, login]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.form}>
        <Input
          name="email"
          label="Email"
          value={email}
          onChange={setEmail}
          error={emailError}
          disabled={loading}
          required
          autoComplete="email"
          autoCapitalize="none"
          testID="login-email-input"
          accessibilityLabel="Email input field"
          placeholder="Enter your email"
        />

        <Input
          name="password"
          label="Password"
          value={password}
          onChange={setPassword}
          error={passwordError}
          disabled={loading}
          required
          type="password"
          autoComplete="current-password"
          testID="login-password-input"
          accessibilityLabel="Password input field"
          placeholder="Enter your password"
        />

        <Button
          onPress={handleLogin}
          loading={loading}
          disabled={loading || attempts >= MAX_LOGIN_ATTEMPTS}
          accessibilityLabel="Login button"
          testID="login-submit-button"
          variant="primary"
        >
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});

LoginScreen.displayName = 'LoginScreen';

export default LoginScreen;