/**
 * @fileoverview Core utility functions for audio processing, analysis, and visualization
 * @version 1.0.0
 * Library versions:
 * - @tensorflow/tfjs@4.2.0
 * - worker-loader@3.0.8
 */

import * as tf from '@tensorflow/tfjs';
import Worker from 'worker-loader!./audio.worker';
import {
  AudioConfig,
  AudioFeatures,
  WaveformData,
  AudioQualityMetrics,
} from '../types/audio.types';

// Constants for audio processing
const FFT_SIZE = 2048;
const NOISE_THRESHOLD = 0.1;
const FEATURE_WINDOW_SIZE = 4096;
const MAX_FREQUENCY = 4000;
const RETRY_ATTEMPTS = 3;
const PROCESSING_TIMEOUT = 5000;
const CACHE_DURATION = 300000;
const WORKER_POOL_SIZE = 4;

// Worker pool for parallel processing
const workerPool: Worker[] = Array(WORKER_POOL_SIZE)
  .fill(null)
  .map(() => new Worker());
let currentWorkerIndex = 0;

/**
 * Performance monitoring decorator
 */
function measurePerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      console.debug(`${propertyKey} execution time: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      console.error(`${propertyKey} performance measurement failed:`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Retry decorator for error handling
 */
function retry(attempts: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      for (let i = 0; i < attempts; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;
          console.warn(
            `Retry attempt ${i + 1}/${attempts} for ${propertyKey} failed:`,
            error
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
      throw lastError!;
    };
    return descriptor;
  };
}

/**
 * Processes raw audio data chunks for analysis
 * @param audioData Raw audio data as ArrayBuffer
 * @param config Audio configuration parameters
 * @param options Processing options
 * @returns Processed audio features
 */
@retry(RETRY_ATTEMPTS)
@measurePerformance
export async function processAudioChunk(
  audioData: ArrayBuffer,
  config: AudioConfig,
  options: ProcessingOptions = {}
): Promise<AudioFeatures> {
  try {
    // Input validation
    if (!audioData?.byteLength) {
      throw new Error('Invalid audio data provided');
    }

    // Convert ArrayBuffer to Float32Array
    const float32Data = new Float32Array(audioData);
    
    // Get next available worker
    const worker = workerPool[currentWorkerIndex];
    currentWorkerIndex = (currentWorkerIndex + 1) % WORKER_POOL_SIZE;

    // Process audio data using TensorFlow.js
    const tensor = tf.tensor1d(float32Data);
    const spectralData = await tf.spectral.stft(tensor, FFT_SIZE);
    
    // Extract features
    const amplitude = Array.from(float32Data);
    const frequency = await calculateFrequencyFeatures(spectralData);
    const noiseLevel = calculateNoiseLevel(float32Data);

    // Clean up tensors
    tensor.dispose();
    spectralData.dispose();

    // Quality checks
    const qualityMetrics = await calculateQualityMetrics(float32Data, config);
    if (qualityMetrics.signalToNoise < NOISE_THRESHOLD) {
      throw new Error('Audio quality below acceptable threshold');
    }

    return {
      amplitude,
      frequency,
      noiseLevel,
      spectralCentroid: calculateSpectralCentroid(frequency),
      mfcc: await calculateMFCC(spectralData),
      zeroCrossingRate: calculateZeroCrossingRate(float32Data)
    };
  } catch (error) {
    console.error('Audio processing error:', error);
    throw error;
  }
}

/**
 * Generates optimized waveform visualization data
 * @param audioData Audio data as Float32Array
 * @param sampleRate Audio sample rate
 * @param options Waveform generation options
 * @returns Waveform visualization data
 */
@measurePerformance
export async function generateWaveform(
  audioData: Float32Array,
  sampleRate: number,
  options: WaveformOptions = {}
): Promise<WaveformData> {
  try {
    // Input validation
    if (!audioData?.length || !sampleRate) {
      throw new Error('Invalid input for waveform generation');
    }

    // Calculate optimal downsample factor
    const downsampleFactor = Math.max(
      1,
      Math.floor(audioData.length / (options.points || 1000))
    );

    // Generate waveform data with progressive loading
    const waveformData = new Array(Math.floor(audioData.length / downsampleFactor));
    for (let i = 0; i < waveformData.length; i++) {
      const slice = audioData.slice(
        i * downsampleFactor,
        (i + 1) * downsampleFactor
      );
      waveformData[i] = Math.max(...slice.map(Math.abs));
    }

    return {
      data: waveformData,
      sampleRate: sampleRate / downsampleFactor,
      duration: (audioData.length / sampleRate) * 1000
    };
  } catch (error) {
    console.error('Waveform generation error:', error);
    throw error;
  }
}

// Helper functions
async function calculateFrequencyFeatures(
  spectralData: tf.Tensor
): Promise<number[]> {
  const magnitudes = tf.abs(spectralData);
  const frequencies = await magnitudes.array();
  magnitudes.dispose();
  return frequencies[0];
}

function calculateNoiseLevel(audioData: Float32Array): number {
  const rms = Math.sqrt(
    audioData.reduce((sum, x) => sum + x * x, 0) / audioData.length
  );
  return rms;
}

async function calculateQualityMetrics(
  audioData: Float32Array,
  config: AudioConfig
): Promise<AudioQualityMetrics> {
  const signalPower = audioData.reduce((sum, x) => sum + x * x, 0);
  const noisePower = calculateNoiseFloor(audioData);
  
  return {
    signalToNoise: 10 * Math.log10(signalPower / noisePower),
    clarity: calculateClarity(audioData),
    distortion: calculateDistortion(audioData, config.bitDepth)
  };
}

function calculateSpectralCentroid(frequencies: number[]): number {
  const totalWeight = frequencies.reduce((sum, f, i) => sum + f * i, 0);
  const totalMagnitude = frequencies.reduce((sum, f) => sum + f, 0);
  return totalWeight / totalMagnitude;
}

async function calculateMFCC(spectralData: tf.Tensor): Promise<number[]> {
  const mfcc = await tf.signal.mfccs(spectralData, {
    sampleRate: 44100,
    melCount: 13
  }).array();
  return mfcc[0];
}

function calculateZeroCrossingRate(audioData: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < audioData.length; i++) {
    if ((audioData[i] * audioData[i - 1]) < 0) {
      crossings++;
    }
  }
  return crossings / audioData.length;
}

// Types for internal use
interface ProcessingOptions {
  normalize?: boolean;
  filterFrequency?: number;
  windowSize?: number;
}

interface WaveformOptions {
  points?: number;
  normalize?: boolean;
  progressive?: boolean;
}

function calculateNoiseFloor(audioData: Float32Array): number {
  const sorted = Float32Array.from(audioData).sort();
  return sorted[Math.floor(sorted.length * 0.1)];
}

function calculateClarity(audioData: Float32Array): number {
  const peakLevel = Math.max(...audioData.map(Math.abs));
  const avgLevel = audioData.reduce((sum, x) => sum + Math.abs(x), 0) / audioData.length;
  return peakLevel / avgLevel;
}

function calculateDistortion(audioData: Float32Array, bitDepth: number): number {
  const maxValue = Math.pow(2, bitDepth - 1) - 1;
  const clippedSamples = audioData.filter(x => Math.abs(x) >= maxValue).length;
  return clippedSamples / audioData.length;
}