/**
 * @fileoverview Test suite for MonitorScreen component
 * Version: 1.0.0
 * 
 * Library versions:
 * - @testing-library/react@13.0.0
 * - @testing-library/jest-dom@5.16.0
 * - jest@29.0.0
 * - axe-core@4.7.0
 */

import React from 'react';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react';
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import MonitorScreen from '../../../screens/monitor/MonitorScreen';
import { useMonitor } from '../../../hooks/useMonitor';
import { AudioState } from '../../../types/audio.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../../hooks/useMonitor');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}));

// Mock theme provider
const mockTheme = {
  colors: {
    background: '#FFFFFF',
    text: '#000000',
    primary: '#6200EE',
    error: '#B00020',
    monitor: {
      confidenceHigh: '#4CAF50',
      confidenceMedium: '#FFC107',
      confidenceLow: '#F44336'
    }
  },
  spacing: {
    md: '16px',
    lg: '24px'
  }
};

// Test data
const mockAnalysisResult = {
  needType: 'hunger',
  confidence: 0.95,
  timestamp: Date.now(),
  features: {
    amplitude: [0.1, 0.2, 0.3],
    frequency: [100, 200, 300],
    noiseLevel: 0.1,
    spectralCentroid: 150,
    mfcc: [1, 2, 3],
    zeroCrossingRate: 0.2
  },
  reliability: 0.9,
  alternativeNeedTypes: ['tiredness', 'discomfort'],
  analysisMetadata: {}
};

describe('MonitorScreen', () => {
  // Setup mocks before each test
  beforeEach(() => {
    const mockUseMonitor = useMonitor as jest.Mock;
    mockUseMonitor.mockReturnValue({
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn(),
      isMonitoring: false,
      currentState: AudioState.IDLE,
      waveformData: [],
      qualityMetrics: {
        signalToNoiseRatio: 0.8,
        clarity: 0.9,
        distortion: 0.1
      },
      error: null
    });
  });

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and meets accessibility standards', async () => {
    const { container, getByRole, getByTestId } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    // Check basic rendering
    expect(getByRole('main')).toBeInTheDocument();
    expect(getByTestId('monitor-controls')).toBeInTheDocument();

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles monitoring lifecycle correctly', async () => {
    const mockStartMonitoring = jest.fn();
    const mockStopMonitoring = jest.fn();
    
    (useMonitor as jest.Mock).mockReturnValue({
      startMonitoring: mockStartMonitoring,
      stopMonitoring: mockStopMonitoring,
      isMonitoring: false,
      currentState: AudioState.IDLE,
      error: null
    });

    const { getByTestId, getByRole } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    // Start monitoring
    const startButton = getByTestId('monitor-controls-record-button');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockStartMonitoring).toHaveBeenCalled();
    });

    // Update monitoring state
    (useMonitor as jest.Mock).mockReturnValue({
      startMonitoring: mockStartMonitoring,
      stopMonitoring: mockStopMonitoring,
      isMonitoring: true,
      currentState: AudioState.RECORDING,
      error: null
    });

    // Stop monitoring
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockStopMonitoring).toHaveBeenCalled();
    });
  });

  it('displays analysis results correctly', async () => {
    (useMonitor as jest.Mock).mockReturnValue({
      isMonitoring: true,
      currentState: AudioState.RECORDING,
      currentAnalysis: mockAnalysisResult,
      error: null
    });

    const { getByText, getByTestId } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    await waitFor(() => {
      expect(getByText('hunger')).toBeInTheDocument();
      expect(getByText('95%')).toBeInTheDocument();
    });

    // Verify recommended actions
    expect(getByText('Feed baby')).toBeInTheDocument();
    expect(getByText('Check last feeding time')).toBeInTheDocument();
  });

  it('handles errors appropriately', async () => {
    const mockError = new Error('Permission denied');
    
    (useMonitor as jest.Mock).mockReturnValue({
      isMonitoring: false,
      currentState: AudioState.ERROR,
      error: mockError
    });

    const { getByRole } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    await waitFor(() => {
      const errorAlert = getByRole('alert');
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent('Permission denied');
    });
  });

  it('supports reduced motion preferences', async () => {
    const { getByTestId } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
        accessibility={{ reduceMotion: true }}
      />
    );

    const monitorControls = getByTestId('monitor-controls');
    expect(monitorControls).toHaveStyle({ transition: 'none' });
  });

  it('handles offline mode gracefully', async () => {
    // Simulate offline state
    Object.defineProperty(navigator, 'onLine', { value: false });
    
    const { getByTestId } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    const startButton = getByTestId('monitor-controls-record-button');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(getByTestId('monitor-controls')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('maintains audio quality monitoring', async () => {
    const mockQualityMetrics = {
      signalToNoiseRatio: 0.3,
      clarity: 0.5,
      distortion: 0.1
    };

    (useMonitor as jest.Mock).mockReturnValue({
      isMonitoring: true,
      currentState: AudioState.RECORDING,
      qualityMetrics: mockQualityMetrics,
      error: null
    });

    const { getByText } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    await waitFor(() => {
      expect(getByText(/Low audio quality detected/i)).toBeInTheDocument();
    });
  });

  it('cleans up resources on unmount', async () => {
    const mockStopMonitoring = jest.fn();
    
    (useMonitor as jest.Mock).mockReturnValue({
      stopMonitoring: mockStopMonitoring,
      isMonitoring: true,
      currentState: AudioState.RECORDING
    });

    const { unmount } = render(
      <MonitorScreen 
        navigation={{}} 
        route={{}} 
        theme={mockTheme}
      />
    );

    unmount();

    await waitFor(() => {
      expect(mockStopMonitoring).toHaveBeenCalled();
    });
  });
});