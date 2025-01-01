/**
 * @fileoverview Comprehensive test suite for LoginScreen component
 * Testing authentication flow, accessibility compliance, and Material Design implementation
 * @version 1.0.0
 */

import React from 'react';
import { render, fireEvent, waitFor, within, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import LoginScreen from '../../../screens/auth/LoginScreen';
import { useAuth } from '../../../hooks/useAuth';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useIsFocused: () => true
}));

// Mock auth hook
jest.mock('../../../hooks/useAuth');
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginScreen', () => {
  // Test user credentials
  const testCredentials = {
    email: 'test@example.com',
    password: 'SecurePass123!'
  };

  // Setup before each test
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      login: jest.fn(),
      loading: false,
      error: null,
      user: null,
      isAuthenticated: false,
      logout: jest.fn(),
      clearError: jest.fn()
    });
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Material Design Compliance', () => {
    it('renders all form elements with proper Material Design styling', () => {
      const { getByTestId, getByLabelText } = render(<LoginScreen />);
      
      const emailInput = getByTestId('login-email-input');
      const passwordInput = getByTestId('login-password-input');
      const submitButton = getByTestId('login-submit-button');

      // Verify Material Design styling
      expect(emailInput).toHaveStyle({
        borderRadius: '4px',
        padding: '12px'
      });

      expect(passwordInput).toHaveStyle({
        borderRadius: '4px',
        padding: '12px'
      });

      expect(submitButton).toHaveStyle({
        borderRadius: '4px'
      });
    });

    it('displays proper labels and placeholders', () => {
      const { getByLabelText, getByPlaceholderText } = render(<LoginScreen />);

      expect(getByLabelText('Email')).toBeInTheDocument();
      expect(getByLabelText('Password')).toBeInTheDocument();
      expect(getByPlaceholderText('Enter your email')).toBeInTheDocument();
      expect(getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates email format', async () => {
      const { getByTestId } = render(<LoginScreen />);
      const emailInput = getByTestId('login-email-input');

      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('enforces password requirements', async () => {
      const { getByTestId } = render(<LoginScreen />);
      const passwordInput = getByTestId('login-password-input');

      await userEvent.type(passwordInput, 'short');
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('handles empty form submission', async () => {
      const { getByTestId } = render(<LoginScreen />);
      const submitButton = getByTestId('login-submit-button');

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password is required')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('handles successful login', async () => {
      const mockLogin = jest.fn();
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        loading: false,
        error: null,
        user: null,
        isAuthenticated: false,
        logout: jest.fn(),
        clearError: jest.fn()
      });

      const { getByTestId } = render(<LoginScreen />);

      await userEvent.type(getByTestId('login-email-input'), testCredentials.email);
      await userEvent.type(getByTestId('login-password-input'), testCredentials.password);
      fireEvent.click(getByTestId('login-submit-button'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(testCredentials.email, testCredentials.password);
      });
    });

    it('shows loading state during authentication', async () => {
      mockUseAuth.mockReturnValue({
        login: jest.fn(),
        loading: true,
        error: null,
        user: null,
        isAuthenticated: false,
        logout: jest.fn(),
        clearError: jest.fn()
      });

      const { getByTestId } = render(<LoginScreen />);
      const submitButton = getByTestId('login-submit-button');

      expect(submitButton).toBeDisabled();
      expect(within(submitButton).getByText('Logging in...')).toBeInTheDocument();
    });

    it('handles login failure', async () => {
      const errorMessage = 'Invalid credentials';
      mockUseAuth.mockReturnValue({
        login: jest.fn(),
        loading: false,
        error: errorMessage,
        user: null,
        isAuthenticated: false,
        logout: jest.fn(),
        clearError: jest.fn()
      });

      const { getByText } = render(<LoginScreen />);
      
      await waitFor(() => {
        expect(getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('implements rate limiting for login attempts', async () => {
      const { getByTestId } = render(<LoginScreen />);
      const submitButton = getByTestId('login-submit-button');

      // Simulate multiple failed attempts
      for (let i = 0; i < 4; i++) {
        fireEvent.click(submitButton);
      }

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(screen.getByText('Too Many Attempts')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('meets WCAG 2.1 AA standards', async () => {
      const { container } = render(<LoginScreen />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      const { getByTestId } = render(<LoginScreen />);
      const emailInput = getByTestId('login-email-input');
      const passwordInput = getByTestId('login-password-input');
      const submitButton = getByTestId('login-submit-button');

      // Test tab order
      expect(document.body).toHaveFocus();
      
      await userEvent.tab();
      expect(emailInput).toHaveFocus();
      
      await userEvent.tab();
      expect(passwordInput).toHaveFocus();
      
      await userEvent.tab();
      expect(submitButton).toHaveFocus();
    });

    it('provides proper ARIA labels', () => {
      const { getByRole } = render(<LoginScreen />);

      expect(getByRole('textbox', { name: 'Email input field' })).toBeInTheDocument();
      expect(getByRole('button', { name: 'Login button' })).toBeInTheDocument();
    });

    it('announces form errors to screen readers', async () => {
      const { getByTestId } = render(<LoginScreen />);
      const emailInput = getByTestId('login-email-input');

      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      await waitFor(() => {
        const errorMessage = screen.getByText('Please enter a valid email address');
        expect(errorMessage).toHaveAttribute('aria-label', 'Error: Please enter a valid email address');
      });
    });
  });
});