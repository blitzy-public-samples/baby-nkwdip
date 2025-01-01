/**
 * @fileoverview Material Design 3.0 compliant Input component with WCAG 2.1 AA support
 * Implements dynamic theming, RTL support, and comprehensive validation
 * Version: 1.0.0
 */

import React, { useState, useRef, useCallback } from 'react';
import styled from 'styled-components';
import Text from './Text';
import { useTheme } from '../../hooks/useTheme';

interface InputProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'search';
  label: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  autoComplete?: string;
  autoCapitalize?: string;
  testID?: string;
  accessibilityLabel?: string;
  style?: React.CSSProperties;
  loading?: boolean;
  direction?: 'ltr' | 'rtl';
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyPress?: (event: React.KeyboardEvent) => void;
}

const StyledInputContainer = styled.div<{
  direction?: string;
  isLoading?: boolean;
}>`
  position: relative;
  width: 100%;
  margin: ${({ theme }) => theme.spacing.xs} 0;
  direction: ${({ direction }) => direction || 'ltr'};
  opacity: ${({ isLoading }) => (isLoading ? 0.7 : 1)};
  transition: opacity ${({ theme }) => theme.animation.duration.fast} ${({ theme }) => theme.animation.easing.standard};
`;

const StyledLabel = styled.label<{
  required?: boolean;
  hasError?: boolean;
  isFocused?: boolean;
}>`
  display: block;
  margin-bottom: ${({ theme }) => theme.spacing.xxs};
  color: ${({ theme, hasError, isFocused }) =>
    hasError ? theme.colors.error : isFocused ? theme.colors.primary : theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.typography.fontSize.body2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  transition: color ${({ theme }) => theme.animation.duration.fast} ${({ theme }) => theme.animation.easing.standard};

  &::after {
    content: ${({ required }) => (required ? '" *"' : '""')};
    color: ${({ theme }) => theme.colors.error};
  }
`;

const StyledInput = styled.input<{
  disabled?: boolean;
  hasError?: boolean;
  isFocused?: boolean;
  textDirection?: string;
}>`
  width: 100%;
  padding: ${({ theme }) => theme.components.input.padding};
  border: 1px solid ${({ theme, hasError, isFocused }) =>
    hasError ? theme.colors.error : isFocused ? theme.colors.primary : theme.colors.border};
  border-radius: ${({ theme }) => theme.components.input.borderRadius};
  background-color: ${({ theme, disabled }) => (disabled ? theme.colors.surfaceVariant : theme.colors.surface)};
  color: ${({ theme, disabled }) => (disabled ? theme.colors.textSecondary : theme.colors.text)};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.body1};
  line-height: ${({ theme }) => theme.typography.lineHeight.body1};
  direction: ${({ textDirection }) => textDirection || 'ltr'};
  transition: all ${({ theme }) => theme.animation.duration.fast} ${({ theme }) => theme.animation.easing.standard};

  &:focus {
    outline: none;
    border-color: ${({ theme, hasError }) => (hasError ? theme.colors.error : theme.colors.primary)};
    box-shadow: 0 0 0 2px ${({ theme, hasError }) =>
      hasError ? `${theme.colors.error}33` : `${theme.colors.primary}33`};
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.textSecondary};
    opacity: 0.7;
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const Input: React.FC<InputProps> = ({
  name,
  value,
  onChange,
  type = 'text',
  label,
  placeholder,
  error,
  disabled = false,
  required = false,
  maxLength,
  autoComplete,
  autoCapitalize,
  testID,
  accessibilityLabel,
  style,
  loading = false,
  direction,
  onFocus,
  onBlur,
  onKeyPress,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = event.target.value;

      if (maxLength) {
        newValue = newValue.slice(0, maxLength);
      }

      // Format phone numbers
      if (type === 'tel') {
        newValue = newValue.replace(/[^\d+]/g, '');
      }

      // Format numbers
      if (type === 'number') {
        newValue = newValue.replace(/[^\d.-]/g, '');
      }

      onChange(newValue);
    },
    [onChange, type, maxLength]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  return (
    <StyledInputContainer direction={direction} isLoading={loading}>
      <StyledLabel
        htmlFor={name}
        required={required}
        hasError={!!error}
        isFocused={isFocused}
      >
        {label}
      </StyledLabel>
      <StyledInput
        ref={inputRef}
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        disabled={disabled || loading}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        data-testid={testID}
        aria-label={accessibilityLabel || label}
        aria-invalid={!!error}
        aria-required={required}
        hasError={!!error}
        isFocused={isFocused}
        textDirection={direction}
        style={style}
      />
      {error && (
        <Text
          variant="caption"
          color={theme.colors.error}
          style={{ marginTop: theme.spacing.xxs }}
          accessibilityLabel={`Error: ${error}`}
        >
          {error}
        </Text>
      )}
    </StyledInputContainer>
  );
};

export default Input;