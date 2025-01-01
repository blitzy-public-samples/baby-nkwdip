/**
 * @fileoverview Type definitions for audio processing and analysis in the Baby Cry Analyzer
 * @version 1.0.0
 */

/**
 * Configuration interface for audio processing settings
 */
export interface AudioConfig {
  /** Sample rate in Hz (e.g., 44100) */
  sampleRate: number;
  /** Number of audio channels (1 for mono, 2 for stereo) */
  channels: number;
  /** Bit depth for audio processing (e.g., 16, 24, 32) */
  bitDepth: number;
  /** Size of the audio processing buffer */
  bufferSize: number;
}

/**
 * Interface for extracted audio features used in cry analysis
 */
export interface AudioFeatures {
  /** Array of amplitude values over time */
  amplitude: number[];
  /** Array of frequency components */
  frequency: number[];
  /** Ambient noise level measurement */
  noiseLevel: number;
  /** Weighted mean of frequencies present in the signal */
  spectralCentroid: number;
  /** Mel-frequency cepstral coefficients */
  mfcc: number[];
  /** Rate of sign changes in the signal */
  zeroCrossingRate: number;
}

/**
 * Interface for waveform visualization data
 */
export interface WaveformData {
  /** Array of normalized amplitude values (-1 to 1) */
  data: number[];
  /** Sample rate of the waveform data */
  sampleRate: number;
  /** Duration of the waveform in milliseconds */
  duration: number;
}

/**
 * Enum for tracking audio recording and analysis states
 */
export enum AudioState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

/**
 * Interface for cry analysis results
 */
export interface AudioAnalysisResult {
  /** Classified need type (e.g., "hunger", "pain", "tiredness") */
  needType: string;
  /** Confidence score of the classification (0-1) */
  confidence: number;
  /** Extracted audio features used for analysis */
  features: AudioFeatures;
  /** Unix timestamp of the analysis */
  timestamp: number;
  /** Reliability score of the analysis (0-1) */
  reliability: number;
  /** Alternative possible need types in order of likelihood */
  alternativeNeedTypes: string[];
  /** Additional metadata from the analysis process */
  analysisMetadata: Record<string, unknown>;
}

/**
 * Interface for audio quality measurement metrics
 */
export interface AudioQualityMetrics {
  /** Signal-to-noise ratio in decibels */
  signalToNoiseRatio: number;
  /** Clarity score (0-1) */
  clarity: number;
  /** Audio distortion measurement (0-1) */
  distortion: number;
}

/**
 * Default configuration values for audio processing
 */
export const DEFAULT_SAMPLE_RATE = 44100;
export const DEFAULT_CHANNELS = 1;
export const DEFAULT_BIT_DEPTH = 16;
export const MIN_CONFIDENCE_THRESHOLD = 0.7;
export const DEFAULT_BUFFER_SIZE = 4096;
export const MAX_RECORDING_DURATION = 300000; // 5 minutes in milliseconds