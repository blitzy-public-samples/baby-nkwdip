/**
 * @fileoverview Advanced React hook for managing real-time audio recording and analysis
 * @version 1.0.0
 * Library versions:
 * - react@18.2.0
 * - @tensorflow/tfjs@4.2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  processAudioChunk,
  generateWaveform,
  calculateNoiseLevel
} from '../utils/audio.util';
import { AudioService } from '../services/audio.service';
import {
  AudioConfig,
  AudioState,
  AudioFeatures,
  WaveformData,
  AudioAnalysisResult
} from '../types/audio.types';

// Constants for audio processing
const DEFAULT_CONFIG: AudioConfig = {
  sampleRate: 44100,
  channels: 1,
  bitDepth: 16,
  bufferSize: 4096
};

const WAVEFORM_UPDATE_INTERVAL = 100;
const MAX_RETRY_ATTEMPTS = 3;
const WORKER_TIMEOUT = 5000;

interface AudioHookState {
  audioState: AudioState;
  isRecording: boolean;
  waveformData: WaveformData | null;
  noiseLevel: number;
  analysisResult: AudioAnalysisResult | null;
  error: Error | null;
  features: AudioFeatures | null;
}

interface AudioHookReturn extends AudioHookState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  retryRecording: () => Promise<void>;
  resetError: () => void;
}

/**
 * Advanced hook for managing audio recording and analysis state
 * @param config - Audio configuration parameters
 * @returns Audio state and control functions
 */
export function useAudio(config: Partial<AudioConfig> = {}): AudioHookReturn {
  // Initialize state with error boundaries
  const [state, setState] = useState<AudioHookState>({
    audioState: AudioState.IDLE,
    isRecording: false,
    waveformData: null,
    noiseLevel: 0,
    analysisResult: null,
    error: null,
    features: null
  });

  // Initialize audio service with enhanced configuration
  const [audioService] = useState(() => new AudioService({
    ...DEFAULT_CONFIG,
    ...config
  }));

  // Waveform update interval reference
  const [waveformInterval, setWaveformInterval] = useState<NodeJS.Timeout | null>(null);

  /**
   * Start audio recording with error handling
   */
  const startRecording = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        audioState: AudioState.RECORDING,
        isRecording: true,
        error: null
      }));

      await audioService.startRecording();

      // Start waveform updates
      const interval = setInterval(async () => {
        try {
          const audioData = await audioService.getWaveformData(new Float32Array());
          const noiseLevel = calculateNoiseLevel(new Float32Array(audioData.data));

          setState(prev => ({
            ...prev,
            waveformData: audioData,
            noiseLevel
          }));
        } catch (error) {
          console.error('Waveform update error:', error);
        }
      }, WAVEFORM_UPDATE_INTERVAL);

      setWaveformInterval(interval);
    } catch (error) {
      setState(prev => ({
        ...prev,
        audioState: AudioState.ERROR,
        isRecording: false,
        error: error as Error
      }));
    }
  }, [audioService]);

  /**
   * Stop recording and process results
   */
  const stopRecording = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        audioState: AudioState.ANALYZING
      }));

      // Clear waveform interval
      if (waveformInterval) {
        clearInterval(waveformInterval);
        setWaveformInterval(null);
      }

      const result = await audioService.stopRecording();

      setState(prev => ({
        ...prev,
        audioState: AudioState.IDLE,
        isRecording: false,
        analysisResult: result,
        features: result.features
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        audioState: AudioState.ERROR,
        isRecording: false,
        error: error as Error
      }));
    }
  }, [audioService, waveformInterval]);

  /**
   * Retry recording after error
   */
  const retryRecording = useCallback(async () => {
    let attempts = 0;
    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        setState(prev => ({ ...prev, error: null }));
        await startRecording();
        return;
      } catch (error) {
        attempts++;
        if (attempts === MAX_RETRY_ATTEMPTS) {
          setState(prev => ({
            ...prev,
            error: new Error(`Failed to retry recording after ${MAX_RETRY_ATTEMPTS} attempts`)
          }));
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
      }
    }
  }, [startRecording]);

  /**
   * Reset error state
   */
  const resetError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (waveformInterval) {
        clearInterval(waveformInterval);
      }
      if (state.isRecording) {
        audioService.stopRecording().catch(console.error);
      }
    };
  }, [audioService, waveformInterval, state.isRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    retryRecording,
    resetError
  };
}