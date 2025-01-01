/**
 * @fileoverview Main monitoring screen component for Baby Cry Analyzer
 * Implements Material Design 3.0 with WCAG 2.1 AA compliance
 * Version: 1.0.0
 * 
 * Library versions:
 * - react@18.0.0
 * - styled-components@5.3.0
 * - react-i18next@12.0.0
 * - react-error-boundary@4.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';

import MonitorControls from '../../components/monitor/MonitorControls';
import AnalysisResult from '../../components/monitor/AnalysisResult';
import { useMonitor } from '../../hooks/useMonitor';

// Constants for monitoring configuration
const ANALYSIS_UPDATE_INTERVAL = 1000;
const MIN_CONFIDENCE_THRESHOLD = 0.7;
const QUALITY_CHECK_INTERVAL = 500;
const MAX_OFFLINE_QUEUE_SIZE = 100;
const ERROR_RETRY_ATTEMPTS = 3;

// Styled components with Material Design 3.0 principles
const ScreenContainer = styled.div`
  flex: 1;
  background-color: ${props => props.theme.colors.background};
  padding: ${props => props.theme.spacing.md};
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MonitoringSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
  margin-top: ${props => props.theme.spacing.lg};
`;

const ErrorContainer = styled.div`
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.error};
  color: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.components.card.borderRadius};
  margin: ${props => props.theme.spacing.md} 0;
`;

interface MonitorScreenProps {
  navigation: any;
  route: any;
  theme: any;
  accessibility?: {
    reduceMotion?: boolean;
    screenReaderEnabled?: boolean;
  };
}

interface MonitoringState {
  isActive: boolean;
  currentAnalysis: AudioAnalysisResult | null;
  lastAction: string | null;
  qualityMetrics: AudioQualityMetrics;
  errorState: Error | null;
  offlineQueue: Array<{ action: string; timestamp: number }>;
}

const MonitorScreen: React.FC<MonitorScreenProps> = ({
  navigation,
  route,
  theme,
  accessibility = {}
}) => {
  const { t } = useTranslation();
  const [state, setState] = useState<MonitoringState>({
    isActive: false,
    currentAnalysis: null,
    lastAction: null,
    qualityMetrics: { signalToNoiseRatio: 0, clarity: 0, distortion: 0 },
    errorState: null,
    offlineQueue: []
  });

  const {
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    currentState,
    qualityMetrics,
    error
  } = useMonitor();

  // Handle monitoring state changes
  const handleStateChange = useCallback(async (monitoring: boolean) => {
    try {
      if (monitoring) {
        await startMonitoring();
      } else {
        await stopMonitoring();
      }
      setState(prev => ({ ...prev, isActive: monitoring, errorState: null }));
    } catch (err) {
      setState(prev => ({ ...prev, errorState: err as Error }));
    }
  }, [startMonitoring, stopMonitoring]);

  // Handle quality metric updates
  const handleQualityChange = useCallback((metrics: AudioQualityMetrics) => {
    setState(prev => ({ ...prev, qualityMetrics: metrics }));
    
    // Alert if quality drops below threshold
    if (metrics.signalToNoiseRatio < MIN_CONFIDENCE_THRESHOLD) {
      console.warn('Low audio quality detected');
    }
  }, []);

  // Handle recommended actions
  const handleActionSelected = useCallback((action: string) => {
    const actionRecord = { action, timestamp: Date.now() };
    
    // Handle offline queue
    if (!navigator.onLine && state.offlineQueue.length < MAX_OFFLINE_QUEUE_SIZE) {
      setState(prev => ({
        ...prev,
        offlineQueue: [...prev.offlineQueue, actionRecord]
      }));
      return;
    }

    setState(prev => ({ ...prev, lastAction: action }));
  }, [state.offlineQueue]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }) => (
    <ErrorContainer role="alert" aria-live="assertive">
      <h3>{t('monitor.errorTitle')}</h3>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>
        {t('monitor.retryButton')}
      </button>
    </ErrorContainer>
  ), [t]);

  // Sync offline queue when back online
  useEffect(() => {
    const syncOfflineQueue = async () => {
      if (navigator.onLine && state.offlineQueue.length > 0) {
        try {
          // Process offline queue
          setState(prev => ({ ...prev, offlineQueue: [] }));
        } catch (error) {
          console.error('Failed to sync offline queue:', error);
        }
      }
    };

    window.addEventListener('online', syncOfflineQueue);
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, [state.offlineQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isMonitoring) {
        stopMonitoring().catch(console.error);
      }
    };
  }, [isMonitoring, stopMonitoring]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => setState(prev => ({ ...prev, errorState: null }))}
    >
      <ScreenContainer
        role="main"
        aria-label={t('monitor.screenTitle')}
      >
        <MonitoringSection>
          <MonitorControls
            onStateChange={handleStateChange}
            onQualityChange={handleQualityChange}
            disabled={!!state.errorState}
            testID="monitor-controls"
            ariaLabel={t('monitor.controls')}
          />

          {state.currentAnalysis && (
            <AnalysisResult
              result={state.currentAnalysis}
              onActionSelected={handleActionSelected}
              onError={(error) => setState(prev => ({ ...prev, errorState: error }))}
              theme={theme}
            />
          )}

          {state.errorState && (
            <ErrorContainer role="alert" aria-live="assertive">
              <p>{state.errorState.message}</p>
            </ErrorContainer>
          )}
        </MonitoringSection>
      </ScreenContainer>
    </ErrorBoundary>
  );
};

MonitorScreen.displayName = 'MonitorScreen';

export default React.memo(MonitorScreen);