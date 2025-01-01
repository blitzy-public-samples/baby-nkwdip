/**
 * @fileoverview Test suite for Button component validating Material Design 3.0 compliance,
 * accessibility standards, theme integration, and interactive behaviors
 * Version: 1.0.0
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { axe, toHaveNoViolations } from '@axe-core/react-native';
import Button from '../../../components/common/Button';
import { DEFAULT_THEME } from '../../../constants/theme.constants';
import { ThemeProvider } from 'styled-components/native';

// Add custom matchers
expect.extend(toHaveNoViolations);

// Mock theme hook
jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: DEFAULT_THEME })
}));

describe('Button Component', () => {
  // Test setup with theme provider
  const renderWithTheme = (component: React.ReactElement) => {
    return render(
      <ThemeProvider theme={DEFAULT_THEME}>
        {component}
      </ThemeProvider>
    );
  };

  // Mock handlers
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Styling', () => {
    test('renders primary variant correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button variant="primary" onPress={mockOnPress}>
          Primary Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: DEFAULT_THEME.colors.primary,
        borderRadius: DEFAULT_THEME.components.button.borderRadius,
        minHeight: 44 // WCAG touch target size
      });
    });

    test('renders secondary variant correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button variant="secondary" onPress={mockOnPress}>
          Secondary Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: DEFAULT_THEME.colors.secondary
      });
    });

    test('renders outline variant correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button variant="outline" onPress={mockOnPress}>
          Outline Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: DEFAULT_THEME.colors.primary
      });
    });

    test('renders text variant correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button variant="text" onPress={mockOnPress}>
          Text Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: 'transparent',
        paddingHorizontal: DEFAULT_THEME.spacing.xs
      });
    });
  });

  describe('Size Variants', () => {
    test.each(['small', 'medium', 'large'] as const)('renders %s size correctly', (size) => {
      const { getByRole } = renderWithTheme(
        <Button size={size} onPress={mockOnPress}>
          {size} Button
        </Button>
      );

      const button = getByRole('button');
      const expectedPadding = DEFAULT_THEME.components.button[size === 'small' ? 'paddingSmall' : size === 'medium' ? 'paddingMedium' : 'paddingLarge'];
      expect(button).toHaveStyle({ padding: expectedPadding });
    });
  });

  describe('Accessibility', () => {
    test('meets WCAG 2.1 AA requirements', async () => {
      const { container } = renderWithTheme(
        <Button onPress={mockOnPress} accessibilityLabel="Test Button">
          Accessible Button
        </Button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('supports screen reader with correct accessibility props', () => {
      const { getByRole } = renderWithTheme(
        <Button 
          onPress={mockOnPress}
          accessibilityLabel="Test Button"
          accessibilityState={{ disabled: false }}
        >
          Screen Reader Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveAccessibilityValue({ text: 'Test Button' });
      expect(button).toHaveAccessibilityState({ disabled: false });
    });

    test('handles disabled state correctly for screen readers', () => {
      const { getByRole } = renderWithTheme(
        <Button 
          onPress={mockOnPress}
          disabled
          accessibilityLabel="Disabled Button"
        >
          Disabled Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveAccessibilityState({ disabled: true });
      expect(button).toHaveStyle({ opacity: 0.6 });
    });
  });

  describe('Interactive Behavior', () => {
    test('handles press events correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button onPress={mockOnPress}>
          Clickable Button
        </Button>
      );

      const button = getByRole('button');
      fireEvent.press(button);
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    test('prevents interaction when disabled', () => {
      const { getByRole } = renderWithTheme(
        <Button onPress={mockOnPress} disabled>
          Disabled Button
        </Button>
      );

      const button = getByRole('button');
      fireEvent.press(button);
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    test('shows loading state correctly', () => {
      const { getByRole, getByLabelText } = renderWithTheme(
        <Button onPress={mockOnPress} loading>
          Loading Button
        </Button>
      );

      const button = getByRole('button');
      const spinner = getByLabelText('Loading');
      
      expect(button).toHaveAccessibilityState({ busy: true });
      expect(spinner).toBeTruthy();
      expect(button).toBeDisabled();
    });
  });

  describe('Theme Integration', () => {
    test('applies theme colors correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button onPress={mockOnPress}>
          Themed Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: DEFAULT_THEME.colors.primary
      });
    });

    test('supports custom styles without breaking theme', () => {
      const customStyle = {
        marginTop: 20,
        width: 200
      };

      const { getByRole } = renderWithTheme(
        <Button onPress={mockOnPress} style={customStyle}>
          Custom Styled Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({
        ...customStyle,
        backgroundColor: DEFAULT_THEME.colors.primary
      });
    });
  });

  describe('Full Width Behavior', () => {
    test('renders full width correctly', () => {
      const { getByRole } = renderWithTheme(
        <Button onPress={mockOnPress} fullWidth>
          Full Width Button
        </Button>
      );

      const button = getByRole('button');
      expect(button).toHaveStyle({ width: '100%' });
    });
  });
});