/**
 * @fileoverview Redux reducer for managing audio recording and analysis state
 * @version 1.0.0
 * Library versions:
 * - @reduxjs/toolkit@1.9.0
 */

import { createReducer } from '@reduxjs/toolkit';
import {
  AudioState,
  AudioConfig,
  WaveformData,
  AudioAnalysisResult,
  AudioError
} from '../../types/audio.types';
import {
  startRecording,
  stopRecording,
  setAudioState,
  updateWaveform,
  setAnalysisResult,
  setAudioError,
  clearAudioError,
  updateAudioQuality
} from '../actions/audio.actions';

// Interface for the audio state slice
interface AudioStateType {
  state: AudioState;
  config: AudioConfig | null;
  waveform: WaveformData | null;
  analysisResult: AudioAnalysisResult | null;
  error: AudioError | null;
  lastUpdate: number;
  qualityMetrics: {
    signalToNoiseRatio: number;
    clarity: number;
    distortion: number;
  } | null;
}

// Initial state with type safety
const initialState: AudioStateType = {
  state: AudioState.IDLE,
  config: null,
  waveform: null,
  analysisResult: null,
  error: null,
  lastUpdate: Date.now(),
  qualityMetrics: null
};

/**
 * Redux reducer for managing audio recording and analysis state
 */
export const audioReducer = createReducer(initialState, (builder) => {
  builder
    // Handle recording start
    .addCase(startRecording, (state, action) => {
      if (state.state !== AudioState.IDLE) {
        return {
          ...state,
          error: { code: 'INVALID_STATE', message: 'Cannot start recording in current state' },
          lastUpdate: Date.now()
        };
      }

      return {
        ...state,
        state: AudioState.RECORDING,
        config: action.payload,
        error: null,
        waveform: null,
        analysisResult: null,
        lastUpdate: Date.now()
      };
    })

    // Handle recording stop
    .addCase(stopRecording, (state) => {
      if (state.state !== AudioState.RECORDING) {
        return {
          ...state,
          error: { code: 'INVALID_STATE', message: 'No active recording to stop' },
          lastUpdate: Date.now()
        };
      }

      return {
        ...state,
        state: AudioState.ANALYZING,
        lastUpdate: Date.now()
      };
    })

    // Handle audio state updates
    .addCase(setAudioState, (state, action) => {
      // Validate state transition
      const isValidTransition = validateStateTransition(state.state, action.payload);
      if (!isValidTransition) {
        return {
          ...state,
          error: { code: 'INVALID_TRANSITION', message: 'Invalid state transition' },
          lastUpdate: Date.now()
        };
      }

      return {
        ...state,
        state: action.payload,
        lastUpdate: Date.now()
      };
    })

    // Handle waveform updates
    .addCase(updateWaveform, (state, action) => {
      if (state.state !== AudioState.RECORDING && state.state !== AudioState.ANALYZING) {
        return state;
      }

      return {
        ...state,
        waveform: action.payload,
        lastUpdate: Date.now()
      };
    })

    // Handle analysis results
    .addCase(setAnalysisResult, (state, action) => {
      if (state.state !== AudioState.ANALYZING) {
        return {
          ...state,
          error: { code: 'INVALID_STATE', message: 'Cannot set analysis result in current state' },
          lastUpdate: Date.now()
        };
      }

      return {
        ...state,
        state: AudioState.COMPLETE,
        analysisResult: action.payload,
        lastUpdate: Date.now()
      };
    })

    // Handle audio errors
    .addCase(setAudioError, (state, action) => {
      return {
        ...state,
        state: AudioState.ERROR,
        error: action.payload,
        lastUpdate: Date.now()
      };
    })

    // Handle error clearing
    .addCase(clearAudioError, (state) => {
      return {
        ...state,
        error: null,
        state: AudioState.IDLE,
        lastUpdate: Date.now()
      };
    })

    // Handle audio quality updates
    .addCase(updateAudioQuality, (state, action) => {
      if (state.state !== AudioState.RECORDING && state.state !== AudioState.ANALYZING) {
        return state;
      }

      return {
        ...state,
        qualityMetrics: action.payload,
        lastUpdate: Date.now()
      };
    });
});

/**
 * Validates state transitions to ensure they follow the correct flow
 * @param currentState Current audio state
 * @param nextState Proposed next state
 * @returns boolean indicating if the transition is valid
 */
function validateStateTransition(currentState: AudioState, nextState: AudioState): boolean {
  const validTransitions: Record<AudioState, AudioState[]> = {
    [AudioState.IDLE]: [AudioState.RECORDING, AudioState.ERROR],
    [AudioState.RECORDING]: [AudioState.ANALYZING, AudioState.ERROR],
    [AudioState.ANALYZING]: [AudioState.COMPLETE, AudioState.ERROR],
    [AudioState.COMPLETE]: [AudioState.IDLE, AudioState.ERROR],
    [AudioState.ERROR]: [AudioState.IDLE]
  };

  return validTransitions[currentState]?.includes(nextState) ?? false;
}

export default audioReducer;