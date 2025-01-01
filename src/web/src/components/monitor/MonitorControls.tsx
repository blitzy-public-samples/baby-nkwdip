/**
 * @fileoverview Monitor controls component for Baby Cry Analyzer with Material Design 3.0 compliance
 * and WCAG 2.1 AA accessibility support
 * Version: 1.0.0
 * 
 * Library versions:
 * - react@18.2.0
 * - styled-components@5.3.0
 */

import React, { useCallback, useEffect, memo } from 'react';
import styled from 'styled-components';
import RecordButton from '../audio/RecordButton';
import SignalMeter from '../audio/SignalMeter';
import { useMonitor } from '../../hooks/useMonitor';
import { AudioState } from '../../types/audio.types';

// Constants for monitoring controls
const SIGNAL_METER_SIZE = 32;
const STATUS_UPDATE_INTERVAL = 500;
const RETRY_ATTEMPTS = 3;
const MONITORING_TIMEOUT = 30000;

interface MonitorControlsProps {
  onStateChange?: (monitoring: boolean) => void;
  disabled?: boolean;
  testID?: string;
  className?: string;
  ariaLabel?: string;
  onError?: (error: Error) => void;
  theme?: ThemeProps;
}

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: ${props => props.theme.colors.background.primary};
  border-radius: 8px;
  transition: all 0.3s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }

  @media (max-width: 768px) {
    padding: 12px;
    gap: 12px;
  }
`;

const ControlsRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 24px;
  min-height: 48px;
  touch-action: manipulation;

  @media (max-width: 768px) {
    gap: 16px;
  }
`;

const StatusText = styled.span<{ error?: boolean }>`
  font-size: 14px;
  color: ${props => props.error ? 
    props.theme.colors.error : 
    props.theme.colors.text.secondary};
  margin-top: 8px;
  font-weight: 500;
  transition: color 0.2s ease;
  user-select: none;
`;

const MonitorControls: React.FC<MonitorControlsProps> = memo(({
  onStateChange,
  disabled = false,
  testID = 'monitor-controls',
  className,
  ariaLabel = 'Baby cry monitoring controls',
  onError
}) => {
  const {
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    currentState,
    error,
    qualityMetrics
  } = useMonitor();

  // Handle monitoring state changes
  const handleMonitoringChange = useCallback(async (isRecording: boolean) => {
    try {
      if (isRecording) {
        await startMonitoring();
      } else {
        await stopMonitoring();
      }
      onStateChange?.(isRecording);
    } catch (err) {
      console.error('Monitoring control error:', err);
      onError?.(err as Error);
    }
  }, [startMonitoring, stopMonitoring, onStateChange, onError]);

  // Get status text based on current state
  const getStatusText = useCallback(() => {
    if (error) return 'Error: Unable to monitor. Please try again.';
    
    switch (currentState) {
      case AudioState.RECORDING:
        return 'Monitoring active - Analyzing audio...';
      case AudioState.ANALYZING:
        return 'Processing audio data...';
      case AudioState.ERROR:
        return 'Error occurred during monitoring';
      default:
        return 'Ready to start monitoring';
    }
  }, [currentState, error]);

  // Report errors to parent component
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  return (
    <ControlsContainer
      className={className}
      data-testid={testID}
      role="region"
      aria-label={ariaLabel}
    >
      <ControlsRow>
        <SignalMeter
          size={SIGNAL_METER_SIZE}
          showLabel={true}
          ariaLabel="Audio signal strength"
        />
        <RecordButton
          disabled={disabled}
          onStateChange={handleMonitoringChange}
          ariaLabel={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
          testID={`${testID}-record-button`}
        />
      </ControlsRow>
      
      <StatusText
        role="status"
        aria-live="polite"
        error={Boolean(error)}
      >
        {getStatusText()}
      </StatusText>

      {qualityMetrics && (
        <StatusText
          role="status"
          aria-live="polite"
        >
          Signal Quality: {Math.round(qualityMetrics.signalToNoiseRatio * 100)}%
        </StatusText>
      )}
    </ControlsContainer>
  );
});

MonitorControls.displayName = 'MonitorControls';

export default MonitorControls;