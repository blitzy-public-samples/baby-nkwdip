import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from 'styled-components';
import AnalysisResult from '../../../components/monitor/AnalysisResult';
import { AudioAnalysisResult } from '../../../types/audio.types';
import { DEFAULT_THEME } from '../../../constants/theme.constants';

expect.extend(toHaveNoViolations);

// Custom render function with theme provider
const renderWithTheme = (ui: React.ReactNode, options = {}) => {
  return render(
    <ThemeProvider theme={DEFAULT_THEME}>
      {ui}
    </ThemeProvider>,
    options
  );
};

// Mock data factory
const createMockAnalysisResult = (overrides?: Partial<AudioAnalysisResult>): AudioAnalysisResult => ({
  needType: 'hunger',
  confidence: 0.95,
  features: {
    amplitude: [0.5, 0.6, 0.7],
    frequency: [300, 400, 500],
    noiseLevel: 0.1,
    spectralCentroid: 450,
    mfcc: [1, 2, 3],
    zeroCrossingRate: 0.15
  },
  timestamp: Date.now(),
  reliability: 0.9,
  alternativeNeedTypes: ['discomfort', 'tiredness'],
  analysisMetadata: {
    processingTime: 150,
    modelVersion: '1.0.0'
  },
  ...overrides
});

describe('AnalysisResult Component', () => {
  const mockActionHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders analysis result correctly', () => {
      const result = createMockAnalysisResult();
      renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      // Verify need type display
      expect(screen.getByText('hunger')).toBeInTheDocument();
      
      // Verify confidence display
      expect(screen.getByText('95%')).toBeInTheDocument();
      
      // Verify recommended actions are displayed
      expect(screen.getByText('Feed baby')).toBeInTheDocument();
      expect(screen.getByText('Check last feeding time')).toBeInTheDocument();
    });

    it('displays alternative need types when available', () => {
      const result = createMockAnalysisResult();
      renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      expect(screen.getByText(/discomfort, tiredness/)).toBeInTheDocument();
    });

    it('handles null result gracefully', () => {
      renderWithTheme(
        <AnalysisResult 
          result={null}
          onActionSelected={mockActionHandler}
        />
      );

      expect(screen.getByText(/No analysis available/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 AA standards', async () => {
      const result = createMockAnalysisResult();
      const { container } = renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels', () => {
      const result = createMockAnalysisResult();
      renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Analysis Result'
      );

      const confidenceLabel = screen.getByLabelText(/Confidence level: 95%/);
      expect(confidenceLabel).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      const result = createMockAnalysisResult();
      renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      const actionButtons = screen.getAllByRole('button');
      actionButtons[0].focus();
      expect(document.activeElement).toBe(actionButtons[0]);
    });
  });

  describe('User Interactions', () => {
    it('handles action selection correctly', async () => {
      const result = createMockAnalysisResult();
      renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      const actionButton = screen.getByText('Feed baby');
      fireEvent.click(actionButton);

      expect(mockActionHandler).toHaveBeenCalledWith('Feed baby');
    });

    it('updates confidence indicator dynamically', async () => {
      const result = createMockAnalysisResult({ confidence: 0.5 });
      const { rerender } = renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      expect(screen.getByText('50%')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={DEFAULT_THEME}>
          <AnalysisResult 
            result={createMockAnalysisResult({ confidence: 0.8 })}
            onActionSelected={mockActionHandler}
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('80%')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles error callback correctly', () => {
      const mockErrorHandler = jest.fn();
      const result = createMockAnalysisResult();
      
      renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
          onError={mockErrorHandler}
        />
      );

      // Simulate error condition
      fireEvent.error(screen.getByTestId('analysis-result'));

      expect(mockErrorHandler).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('memoizes expensive calculations', () => {
      const result = createMockAnalysisResult();
      const { rerender } = renderWithTheme(
        <AnalysisResult 
          result={result}
          onActionSelected={mockActionHandler}
        />
      );

      const initialRender = screen.getByTestId('analysis-result');
      
      rerender(
        <ThemeProvider theme={DEFAULT_THEME}>
          <AnalysisResult 
            result={result}
            onActionSelected={mockActionHandler}
          />
        </ThemeProvider>
      );

      const secondRender = screen.getByTestId('analysis-result');
      expect(initialRender).toBe(secondRender);
    });
  });
});