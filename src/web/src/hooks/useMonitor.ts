/**
 * @fileoverview Custom React hook for managing real-time baby cry monitoring functionality
 * @version 1.0.0
 * Library versions:
 * - react@18.2.0
 * - react-redux@8.0.5
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AudioService } from '../../services/audio.service';
import { AudioQualityMetrics, AudioState } from '../../types/audio.types';

// Constants for monitoring configuration
const DEFAULT_CONFIG = {
  sampleRate: 44100,
  channels: 1,
  bitDepth: 16,
  qualityThreshold: 0.7
};

const MONITORING_INTERVAL = 100;
const QUALITY_CHECK_INTERVAL = 1000;
const MAX_RETRY_ATTEMPTS = 3;
const CLEANUP_TIMEOUT = 5000;

interface MonitoringState {
  isMonitoring: boolean;
  currentState: AudioState;
  waveformData: number[];
  qualityMetrics: AudioQualityMetrics | null;
  error: Error | null;
}

/**
 * Enhanced custom hook for managing baby cry monitoring functionality
 * with quality control and error handling
 */
export function useMonitor() {
  // Initialize state
  const [state, setState] = useState<MonitoringState>({
    isMonitoring: false,
    currentState: AudioState.IDLE,
    waveformData: [],
    qualityMetrics: null,
    error: null
  });

  // Redux setup
  const dispatch = useDispatch();

  // Refs for managing intervals and service instance
  const audioServiceRef = useRef<AudioService | null>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qualityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryAttemptsRef = useRef(0);

  /**
   * Initialize audio service with optimal settings
   */
  const initializeAudioService = useCallback(async () => {
    try {
      if (!audioServiceRef.current) {
        audioServiceRef.current = new AudioService(
          DEFAULT_CONFIG,
          null as any, // ApiService will be injected by DI
          { attempts: MAX_RETRY_ATTEMPTS, backoffMs: 1000 }
        );
      }
      return audioServiceRef.current;
    } catch (error) {
      console.error('Failed to initialize audio service:', error);
      throw error;
    }
  }, []);

  /**
   * Start monitoring with quality validation
   */
  const startMonitoring = useCallback(async () => {
    try {
      const audioService = await initializeAudioService();
      
      setState(prev => ({
        ...prev,
        isMonitoring: true,
        currentState: AudioState.RECORDING,
        error: null
      }));

      await audioService.startRecording();

      // Setup continuous monitoring
      monitoringIntervalRef.current = setInterval(async () => {
        try {
          const waveformData = await audioService.getWaveformData(new Float32Array());
          setState(prev => ({
            ...prev,
            waveformData: waveformData.data
          }));
        } catch (error) {
          console.warn('Waveform update failed:', error);
        }
      }, MONITORING_INTERVAL);

      // Setup quality monitoring
      qualityCheckIntervalRef.current = setInterval(async () => {
        try {
          const metrics = await audioService.getQualityMetrics();
          if (metrics.signalToNoiseRatio < DEFAULT_CONFIG.qualityThreshold) {
            await audioService.adjustQuality();
          }
          setState(prev => ({
            ...prev,
            qualityMetrics: metrics
          }));
        } catch (error) {
          console.warn('Quality check failed:', error);
        }
      }, QUALITY_CHECK_INTERVAL);

    } catch (error) {
      handleMonitoringError(error as Error);
    }
  }, [initializeAudioService]);

  /**
   * Stop monitoring with cleanup
   */
  const stopMonitoring = useCallback(async () => {
    try {
      if (audioServiceRef.current) {
        await audioServiceRef.current.stopRecording();
      }

      // Clear intervals
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
      }

      setState(prev => ({
        ...prev,
        isMonitoring: false,
        currentState: AudioState.IDLE,
        waveformData: [],
        qualityMetrics: null
      }));

    } catch (error) {
      handleMonitoringError(error as Error);
    }
  }, []);

  /**
   * Handle monitoring errors with retry logic
   */
  const handleMonitoringError = useCallback((error: Error) => {
    console.error('Monitoring error:', error);
    
    if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
      retryAttemptsRef.current++;
      startMonitoring().catch(console.error);
    } else {
      setState(prev => ({
        ...prev,
        isMonitoring: false,
        currentState: AudioState.ERROR,
        error
      }));
    }
  }, [startMonitoring]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        try {
          if (state.isMonitoring) {
            await stopMonitoring();
          }
          
          // Clear all intervals
          if (monitoringIntervalRef.current) {
            clearInterval(monitoringIntervalRef.current);
          }
          if (qualityCheckIntervalRef.current) {
            clearInterval(qualityCheckIntervalRef.current);
          }

          // Reset state
          setState({
            isMonitoring: false,
            currentState: AudioState.IDLE,
            waveformData: [],
            qualityMetrics: null,
            error: null
          });
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      };

      const timeoutId = setTimeout(cleanup, CLEANUP_TIMEOUT);
      return () => clearTimeout(timeoutId);
    };
  }, [state.isMonitoring, stopMonitoring]);

  return {
    startMonitoring,
    stopMonitoring,
    isMonitoring: state.isMonitoring,
    currentState: state.currentState,
    waveformData: state.waveformData,
    qualityMetrics: state.qualityMetrics,
    error: state.error
  };
}