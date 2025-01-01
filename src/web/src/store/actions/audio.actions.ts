/**
 * @fileoverview Redux action creators for audio recording and analysis functionality
 * @version 1.0.0
 * Library versions:
 * - @reduxjs/toolkit@1.9.0
 */

import { createAction } from '@reduxjs/toolkit';
import { 
  AudioState, 
  AudioConfig, 
  WaveformData, 
  AudioAnalysisResult, 
  AudioError 
} from '../../types/audio.types';
import { AudioService } from '../../services/audio.service';

// Action type constants
export const START_RECORDING = 'audio/startRecording' as const;
export const STOP_RECORDING = 'audio/stopRecording' as const;
export const SET_AUDIO_STATE = 'audio/setAudioState' as const;
export const UPDATE_WAVEFORM = 'audio/updateWaveform' as const;
export const SET_ANALYSIS_RESULT = 'audio/setAnalysisResult' as const;
export const SET_AUDIO_ERROR = 'audio/setError' as const;
export const CLEAR_AUDIO_ERROR = 'audio/clearError' as const;
export const UPDATE_AUDIO_QUALITY = 'audio/updateQuality' as const;

/**
 * Action creator for starting audio recording with configuration
 */
export const startRecording = createAction<
  AudioConfig,
  typeof START_RECORDING,
  { error?: AudioError }
>(START_RECORDING, (config) => ({
  payload: {
    sampleRate: config.sampleRate,
    channels: config.channels,
    bitDepth: config.bitDepth,
    bufferSize: config.bufferSize
  },
  error: undefined,
  meta: {
    timestamp: Date.now()
  }
}));

/**
 * Action creator for stopping current audio recording
 */
export const stopRecording = createAction<
  void,
  typeof STOP_RECORDING,
  { error?: AudioError }
>(STOP_RECORDING, () => ({
  payload: undefined,
  error: undefined,
  meta: {
    timestamp: Date.now()
  }
}));

/**
 * Action creator for updating current audio state
 */
export const setAudioState = createAction<
  AudioState,
  typeof SET_AUDIO_STATE,
  { error?: AudioError }
>(SET_AUDIO_STATE, (state) => ({
  payload: state,
  error: undefined,
  meta: {
    timestamp: Date.now()
  }
}));

/**
 * Action creator for updating waveform visualization data
 */
export const updateWaveform = createAction<
  WaveformData,
  typeof UPDATE_WAVEFORM,
  { error?: AudioError }
>(UPDATE_WAVEFORM, (data) => ({
  payload: {
    data: data.data,
    sampleRate: data.sampleRate,
    duration: data.duration
  },
  error: undefined,
  meta: {
    timestamp: Date.now()
  }
}));

/**
 * Action creator for storing cry analysis results
 */
export const setAnalysisResult = createAction<
  AudioAnalysisResult,
  typeof SET_ANALYSIS_RESULT,
  { error?: AudioError }
>(SET_ANALYSIS_RESULT, (result) => ({
  payload: {
    needType: result.needType,
    confidence: result.confidence,
    features: result.features,
    timestamp: result.timestamp,
    reliability: result.reliability,
    alternativeNeedTypes: result.alternativeNeedTypes,
    analysisMetadata: result.analysisMetadata
  },
  error: undefined,
  meta: {
    timestamp: Date.now()
  }
}));

/**
 * Action creator for setting audio processing error
 */
export const setAudioError = createAction<
  AudioError,
  typeof SET_AUDIO_ERROR
>(SET_AUDIO_ERROR, (error) => ({
  payload: error,
  meta: {
    timestamp: Date.now()
  }
}));

/**
 * Action creator for clearing audio processing error
 */
export const clearAudioError = createAction(
  CLEAR_AUDIO_ERROR,
  () => ({
    payload: undefined,
    meta: {
      timestamp: Date.now()
    }
  })
);

/**
 * Action creator for updating audio quality metrics
 */
export const updateAudioQuality = createAction<
  {
    signalToNoiseRatio: number;
    clarity: number;
    distortion: number;
  },
  typeof UPDATE_AUDIO_QUALITY,
  { error?: AudioError }
>(UPDATE_AUDIO_QUALITY, (metrics) => ({
  payload: metrics,
  error: undefined,
  meta: {
    timestamp: Date.now()
  }
}));

// Type for all audio actions
export type AudioActionTypes = 
  | ReturnType<typeof startRecording>
  | ReturnType<typeof stopRecording>
  | ReturnType<typeof setAudioState>
  | ReturnType<typeof updateWaveform>
  | ReturnType<typeof setAnalysisResult>
  | ReturnType<typeof setAudioError>
  | ReturnType<typeof clearAudioError>
  | ReturnType<typeof updateAudioQuality>;