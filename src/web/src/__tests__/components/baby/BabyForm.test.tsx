import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import BabyForm from '../../../components/baby/BabyForm';
import { Baby, BabyPreferences } from '../../../types/baby.types';
import { useBaby } from '../../../hooks/useBaby';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useBaby hook
jest.mock('../../../hooks/useBaby', () => ({
  __esModule: true,
  default: jest.fn()
}));

// Mock date for consistent testing
const mockDate = new Date('2024-01-01T00:00:00.000Z');

describe('BabyForm', () => {
  // Mock functions
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();
  const mockCreateBaby = jest.fn();
  const mockUpdateBaby = jest.fn();

  // Default test props
  const defaultProps = {
    baby: null,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
    loading: false,
    error: null
  };

  // Test baby data
  const testBaby: Baby = {
    id: '123',
    name: 'Test Baby',
    birthDate: mockDate,
    monitoringEnabled: true,
    notificationsEnabled: true,
    sensitivity: 'medium',
    nightMode: false,
    backgroundMonitoring: false,
    dataRetention: '90days'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useBaby as jest.Mock).mockReturnValue({
      createBaby: mockCreateBaby,
      updateBaby: mockUpdateBaby
    });
  });

  it('renders form fields correctly', () => {
    render(<BabyForm {...defaultProps} />);

    // Verify all form fields are present
    expect(screen.getByTestId('baby-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-birthdate-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-sensitivity-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-monitoring-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-notifications-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-nightmode-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-background-input')).toBeInTheDocument();
    expect(screen.getByTestId('baby-retention-input')).toBeInTheDocument();
  });

  it('validates accessibility requirements', async () => {
    const { container } = render(<BabyForm {...defaultProps} />);

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check ARIA labels
    const nameInput = screen.getByTestId('baby-name-input');
    expect(nameInput).toHaveAttribute('aria-required', 'true');
    expect(nameInput).toHaveAttribute('aria-invalid', 'false');

    // Test keyboard navigation
    const form = screen.getByRole('form');
    const focusableElements = within(form).getAllByRole('textbox');
    expect(focusableElements.length).toBeGreaterThan(0);
  });

  it('handles form validation', async () => {
    render(<BabyForm {...defaultProps} />);
    const user = userEvent.setup();

    // Test required field validation
    await user.click(screen.getByTestId('baby-submit-button'));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();

    // Test name field validation
    const nameInput = screen.getByTestId('baby-name-input');
    await user.type(nameInput, 'a');
    expect(await screen.findByText(/name must be at least 2 characters/i)).toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, 'Test Baby123');
    expect(await screen.findByText(/name can only contain letters/i)).toBeInTheDocument();

    // Test birth date validation
    const birthDateInput = screen.getByTestId('baby-birthdate-input');
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await user.type(birthDateInput, futureDate.toISOString().split('T')[0]);
    expect(await screen.findByText(/birth date cannot be in the future/i)).toBeInTheDocument();
  });

  it('handles form submission correctly', async () => {
    render(<BabyForm {...defaultProps} />);
    const user = userEvent.setup();

    // Fill form with valid data
    await user.type(screen.getByTestId('baby-name-input'), 'Test Baby');
    await user.type(screen.getByTestId('baby-birthdate-input'), '2023-01-01');
    
    // Select sensitivity
    const sensitivitySelect = screen.getByTestId('baby-sensitivity-input');
    await user.selectOptions(sensitivitySelect, 'high');

    // Toggle checkboxes
    await user.click(screen.getByTestId('baby-monitoring-input'));
    await user.click(screen.getByTestId('baby-notifications-input'));

    // Submit form
    await user.click(screen.getByTestId('baby-submit-button'));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Baby',
        birthDate: expect.any(Date),
        sensitivity: 'high',
        monitoringEnabled: true,
        notificationsEnabled: true
      }));
    });
  });

  it('handles edit mode correctly', () => {
    render(<BabyForm {...defaultProps} baby={testBaby} />);

    // Verify form is populated with baby data
    expect(screen.getByTestId('baby-name-input')).toHaveValue(testBaby.name);
    expect(screen.getByTestId('baby-sensitivity-input')).toHaveValue(testBaby.sensitivity);
    expect(screen.getByTestId('baby-monitoring-input')).toBeChecked();
    expect(screen.getByTestId('baby-notifications-input')).toBeChecked();
  });

  it('handles loading state correctly', () => {
    render(<BabyForm {...defaultProps} loading={true} />);

    // Verify form fields are disabled during loading
    expect(screen.getByTestId('baby-name-input')).toBeDisabled();
    expect(screen.getByTestId('baby-birthdate-input')).toBeDisabled();
    expect(screen.getByTestId('baby-submit-button')).toBeDisabled();
    expect(screen.getByTestId('baby-cancel-button')).toBeDisabled();
  });

  it('handles error state correctly', () => {
    const error = new Error('Test error');
    render(<BabyForm {...defaultProps} error={error} />);

    // Verify error message is displayed
    expect(screen.getByRole('alert')).toHaveTextContent(error.message);
  });

  it('handles form cancellation', async () => {
    render(<BabyForm {...defaultProps} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('baby-cancel-button'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('preserves form state during updates', async () => {
    const { rerender } = render(<BabyForm {...defaultProps} />);
    const user = userEvent.setup();

    // Fill form
    await user.type(screen.getByTestId('baby-name-input'), 'Test Baby');
    
    // Rerender with new props
    rerender(<BabyForm {...defaultProps} loading={true} />);

    // Verify form state is preserved
    expect(screen.getByTestId('baby-name-input')).toHaveValue('Test Baby');
  });
});