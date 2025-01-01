/**
 * @fileoverview Test suite for HistoryChart component
 * Verifies chart rendering, data visualization, accessibility, and responsiveness
 * Version: 1.0.0
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material';
import HistoryChart from '../../../components/history/HistoryChart';
import { useHistory } from '../../../hooks/useHistory';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock useHistory hook
jest.mock('../../../hooks/useHistory');
const mockUseHistory = useHistory as jest.MockedFunction<typeof useHistory>;

// Mock theme constants
const mockTheme = {
  colors: {
    primary: '#6200EE',
    surface: '#F5F5F5',
    monitor: {
      confidenceHunger: '#4CAF50',
      confidenceTired: '#FFC107',
      confidencePain: '#F44336',
      confidenceDiscomfort: '#03DAC6',
    },
  },
  spacing: {
    md: '16px',
  },
  components: {
    card: {
      borderRadius: '8px',
    },
  },
  elevation: {
    low: '0px 1px 3px rgba(0, 0, 0, 0.12)',
  },
};

// Test data
const mockDistribution = {
  Hunger: 45,
  Tired: 28,
  Pain: 12,
  Discomfort: 15,
};

const mockRecords = [
  {
    id: 'test-id-1',
    needType: 'Hunger',
    confidence: 0.95,
    timestamp: '2023-01-01T12:00:00Z',
    metadata: {
      duration: 30,
      intensity: 'high',
    },
  },
];

/**
 * Helper function to render component with providers
 */
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('HistoryChart Component', () => {
  const defaultProps = {
    babyId: 'test-baby-id',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'),
    onPatternSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    mockUseHistory.mockReturnValue({
      distribution: {},
      isLoading: true,
      error: null,
      records: [],
    });

    renderWithProviders(<HistoryChart {...defaultProps} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('renders chart with correct pattern distribution', async () => {
    mockUseHistory.mockReturnValue({
      distribution: mockDistribution,
      isLoading: false,
      error: null,
      records: mockRecords,
    });

    renderWithProviders(<HistoryChart {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByLabelText(/cry pattern distribution chart/i)).toBeInTheDocument();
    });

    // Verify accessible description
    const accessibleMessage = screen.getByRole('status');
    expect(accessibleMessage).toHaveTextContent(/Hunger: 45%/);
    expect(accessibleMessage).toHaveTextContent(/Tired: 28%/);
  });

  it('handles empty distribution data gracefully', () => {
    mockUseHistory.mockReturnValue({
      distribution: {},
      isLoading: false,
      error: null,
      records: [],
    });

    renderWithProviders(<HistoryChart {...defaultProps} />);

    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.queryByText(/no data available/i)).toBeInTheDocument();
  });

  it('updates chart when date range changes', async () => {
    const newProps = {
      ...defaultProps,
      startDate: new Date('2023-02-01'),
      endDate: new Date('2023-02-28'),
    };

    mockUseHistory.mockReturnValue({
      distribution: mockDistribution,
      isLoading: false,
      error: null,
      records: mockRecords,
    });

    const { rerender } = renderWithProviders(<HistoryChart {...defaultProps} />);
    rerender(<HistoryChart {...newProps} />);

    await waitFor(() => {
      expect(mockUseHistory).toHaveBeenCalledWith(expect.objectContaining({
        startDate: newProps.startDate,
        endDate: newProps.endDate,
      }));
    });
  });

  it('meets accessibility requirements', async () => {
    mockUseHistory.mockReturnValue({
      distribution: mockDistribution,
      isLoading: false,
      error: null,
      records: mockRecords,
    });

    const { container } = renderWithProviders(<HistoryChart {...defaultProps} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles pattern selection interaction', async () => {
    mockUseHistory.mockReturnValue({
      distribution: mockDistribution,
      isLoading: false,
      error: null,
      records: mockRecords,
    });

    renderWithProviders(<HistoryChart {...defaultProps} />);

    const chart = screen.getByRole('img');
    await userEvent.click(chart);

    expect(defaultProps.onPatternSelect).toHaveBeenCalled();
  });

  it('maintains responsive layout', async () => {
    mockUseHistory.mockReturnValue({
      distribution: mockDistribution,
      isLoading: false,
      error: null,
      records: mockRecords,
    });

    const { container } = renderWithProviders(<HistoryChart {...defaultProps} />);

    // Verify responsive container styles
    const chartContainer = container.firstChild;
    expect(chartContainer).toHaveStyle({
      width: '100%',
      height: '300px',
    });

    // Verify media query styles
    const styles = window.getComputedStyle(chartContainer as Element);
    expect(styles.getPropertyValue('height')).toBe('300px');
  });

  it('handles theme changes correctly', async () => {
    const darkTheme = {
      ...mockTheme,
      colors: {
        ...mockTheme.colors,
        surface: '#121212',
      },
    };

    mockUseHistory.mockReturnValue({
      distribution: mockDistribution,
      isLoading: false,
      error: null,
      records: mockRecords,
    });

    const { rerender } = renderWithProviders(<HistoryChart {...defaultProps} />);

    rerender(
      <ThemeProvider theme={darkTheme}>
        <HistoryChart {...defaultProps} />
      </ThemeProvider>
    );

    const chartContainer = screen.getByRole('img').parentElement;
    expect(chartContainer).toHaveStyle({
      backgroundColor: darkTheme.colors.surface,
    });
  });
});