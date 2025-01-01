/**
 * @fileoverview Test suite for audio processing utilities
 * @version 1.0.0
 * Library versions:
 * - jest@29.0.0
 * - jest-performance@1.0.0
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'jest-performance';
import {
  processAudioChunk,
  generateWaveform,
  calculateNoiseLevel,
  extractFeatures,
  initializeWorker
} from '../../utils/audio.util';
import { AudioTypes } from '../../types/audio.types';

// Test constants
const TEST_SAMPLE_RATE = 44100;
const TEST_CHANNELS = 1;
const TEST_BIT_DEPTH = 16;
const TEST_CHUNK_SIZE = 4096;
const TEST_WORKER_COUNT = 2;
const PERFORMANCE_THRESHOLD_MS = 100;

// Mock audio configuration
const mockAudioConfig: AudioTypes.AudioConfig = {
  sampleRate: TEST_SAMPLE_RATE,
  channels: TEST_CHANNELS,
  bitDepth: TEST_BIT_DEPTH,
  bufferSize: TEST_CHUNK_SIZE
};

describe('processAudioChunk', () => {
  let mockAudioData: ArrayBuffer;
  
  beforeEach(() => {
    mockAudioData = new ArrayBuffer(TEST_CHUNK_SIZE);
    jest.spyOn(performance, 'now');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should process valid audio chunk within performance threshold', async () => {
    const startTime = performance.now();
    
    const result = await processAudioChunk(mockAudioData, mockAudioConfig);
    
    const processingTime = performance.now() - startTime;
    
    expect(result).toBeDefined();
    expect(result.amplitude).toBeInstanceOf(Array);
    expect(result.frequency).toBeInstanceOf(Array);
    expect(result.noiseLevel).toBeGreaterThanOrEqual(0);
    expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });

  test('should handle worker thread initialization and management', async () => {
    const worker = await initializeWorker();
    
    expect(worker).toBeDefined();
    expect(worker.postMessage).toBeDefined();
    
    const processingPromise = processAudioChunk(mockAudioData, mockAudioConfig);
    await expect(processingPromise).resolves.not.toThrow();
  });

  test('should throw error for invalid audio data', async () => {
    const invalidData = new ArrayBuffer(0);
    
    await expect(
      processAudioChunk(invalidData, mockAudioConfig)
    ).rejects.toThrow('Invalid audio data provided');
  });

  test('should retry processing on temporary failures', async () => {
    const mockFailure = jest.spyOn(global, 'ArrayBuffer').mockImplementationOnce(() => {
      throw new Error('Temporary failure');
    });

    const result = await processAudioChunk(mockAudioData, mockAudioConfig);
    
    expect(result).toBeDefined();
    expect(mockFailure).toHaveBeenCalled();
  });
});

describe('generateWaveform', () => {
  let mockAudioData: Float32Array;

  beforeEach(() => {
    mockAudioData = new Float32Array(TEST_CHUNK_SIZE).fill(0.5);
  });

  test('should generate waveform with correct dimensions', async () => {
    const result = await generateWaveform(mockAudioData, TEST_SAMPLE_RATE);
    
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });

  test('should optimize memory usage during waveform generation', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    await generateWaveform(mockAudioData, TEST_SAMPLE_RATE);
    
    const memoryDelta = process.memoryUsage().heapUsed - initialMemory;
    expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });

  test('should handle progressive loading of large audio files', async () => {
    const largeAudioData = new Float32Array(TEST_CHUNK_SIZE * 10);
    const options = { progressive: true, points: 1000 };
    
    const result = await generateWaveform(largeAudioData, TEST_SAMPLE_RATE, options);
    
    expect(result.data.length).toBeLessThanOrEqual(options.points);
  });
});

describe('calculateNoiseLevel', () => {
  test('should accurately calculate noise levels', () => {
    const quietAudio = new Float32Array(TEST_CHUNK_SIZE).fill(0.1);
    const loudAudio = new Float32Array(TEST_CHUNK_SIZE).fill(0.8);
    
    const quietLevel = calculateNoiseLevel(quietAudio);
    const loudLevel = calculateNoiseLevel(loudAudio);
    
    expect(quietLevel).toBeLessThan(loudLevel);
    expect(quietLevel).toBeGreaterThan(0);
    expect(loudLevel).toBeLessThan(1);
  });

  test('should handle different noise patterns', () => {
    const mixedAudio = new Float32Array(TEST_CHUNK_SIZE);
    for (let i = 0; i < TEST_CHUNK_SIZE; i++) {
      mixedAudio[i] = Math.sin(i / 10) * 0.5;
    }
    
    const noiseLevel = calculateNoiseLevel(mixedAudio);
    
    expect(noiseLevel).toBeGreaterThan(0);
    expect(noiseLevel).toBeLessThan(1);
  });
});

describe('extractFeatures', () => {
  let mockSpectralData: Float32Array;

  beforeEach(() => {
    mockSpectralData = new Float32Array(TEST_CHUNK_SIZE);
    for (let i = 0; i < TEST_CHUNK_SIZE; i++) {
      mockSpectralData[i] = Math.random();
    }
  });

  test('should extract features within performance constraints', async () => {
    const startTime = performance.now();
    
    const features = await extractFeatures(mockSpectralData);
    
    const processingTime = performance.now() - startTime;
    
    expect(features).toBeDefined();
    expect(features.mfcc).toBeInstanceOf(Array);
    expect(features.spectralCentroid).toBeGreaterThan(0);
    expect(processingTime).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  });

  test('should maintain consistent feature dimensions', async () => {
    const features1 = await extractFeatures(mockSpectralData);
    const features2 = await extractFeatures(mockSpectralData);
    
    expect(features1.mfcc.length).toBe(features2.mfcc.length);
    expect(features1.frequency.length).toBe(features2.frequency.length);
  });

  test('should handle worker thread errors gracefully', async () => {
    const mockWorkerError = new Error('Worker thread error');
    jest.spyOn(global, 'Worker').mockImplementationOnce(() => {
      throw mockWorkerError;
    });

    await expect(extractFeatures(mockSpectralData)).rejects.toThrow();
  });
});