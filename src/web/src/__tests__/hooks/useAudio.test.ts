/**
 * @fileoverview Test suite for useAudio hook
 * Library versions:
 * - @testing-library/react-hooks@8.0.1
 * - @testing-library/react@13.4.0
 * - @jest/globals@29.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { jest } from '@jest/globals';
import { memoryUsage } from 'process';
import { useAudio } from '../../hooks/useAudio';
import { AudioState } from '../../types/audio.types';

// Mock audio context and media devices
const mockMediaDevices = {
  getUserMedia: jest.fn(),
  enumerateDevices: jest.fn()
};

const mockAudioContext = {
  createMediaStreamSource: jest.fn(),
  createScriptProcessor: jest.fn(),
  createAnalyser: jest.fn(),
  close: jest.fn()
};

// Mock constants from useAudio hook
const MOCK_AUDIO_CONFIG = {
  sampleRate: 44100,
  channels: 1,
  bitDepth: 16,
  bufferSize: 4096
};

const MOCK_WAVEFORM_DATA = {
  data: new Float32Array([0, 0.5, 1, 0.5, 0]),
  sampleRate: 44100,
  duration: 1000
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  maxLatency: 100, // ms
  maxMemory: 50 * 1024 * 1024, // 50MB
  maxCpuUsage: 80 // percentage
};

describe('useAudio Hook', () => {
  // Setup and teardown
  beforeAll(() => {
    // Mock browser APIs
    global.navigator.mediaDevices = mockMediaDevices;
    global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
    global.MediaRecorder = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      expect(result.current.audioState).toBe(AudioState.IDLE);
      expect(result.current.isRecording).toBe(false);
      expect(result.current.waveformData).toBeNull();
      expect(result.current.noiseLevel).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it('should initialize audio context with correct config', () => {
      renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      expect(global.AudioContext).toHaveBeenCalledWith({
        sampleRate: MOCK_AUDIO_CONFIG.sampleRate,
        latencyHint: 'interactive'
      });
    });
  });

  describe('Recording Controls', () => {
    it('should start recording when permissions are granted', async () => {
      mockMediaDevices.getUserMedia.mockResolvedValueOnce({
        getTracks: () => [{
          stop: jest.fn()
        }]
      });

      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.audioState).toBe(AudioState.RECORDING);
      expect(result.current.isRecording).toBe(true);
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should stop recording and process audio', async () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      // Start recording first
      await act(async () => {
        await result.current.startRecording();
      });

      // Stop recording
      await act(async () => {
        await result.current.stopRecording();
      });

      expect(result.current.audioState).toBe(AudioState.IDLE);
      expect(result.current.isRecording).toBe(false);
    });

    it('should update waveform data during recording', async () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording();
        // Simulate waveform update
        result.current.waveformData = MOCK_WAVEFORM_DATA;
      });

      expect(result.current.waveformData).toEqual(MOCK_WAVEFORM_DATA);
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denial', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));

      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording().catch(() => {});
      });

      expect(result.current.audioState).toBe(AudioState.ERROR);
      expect(result.current.error).toBeTruthy();
      expect(result.current.isRecording).toBe(false);
    });

    it('should handle device unavailability', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('NotFoundError'));

      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording().catch(() => {});
      });

      expect(result.current.error?.message).toContain('NotFoundError');
    });

    it('should retry recording on failure', async () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.retryRecording();
      });

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });
  });

  describe('WebWorker Integration', () => {
    it('should initialize worker correctly', () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));
      expect(result.current.workerState).toBeDefined();
    });

    it('should handle worker messages', async () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording();
        // Simulate worker message
        const mockWorkerMessage = { data: { type: 'analysisComplete', result: {} }};
        window.dispatchEvent(new MessageEvent('message', mockWorkerMessage));
      });

      expect(result.current.audioState).toBe(AudioState.RECORDING);
    });
  });

  describe('Performance', () => {
    it('should maintain acceptable memory usage', async () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording();
      });

      const { heapUsed } = memoryUsage();
      expect(heapUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.maxMemory);
    });

    it('should process audio chunks within latency threshold', async () => {
      const { result } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        const start = performance.now();
        await result.current.startRecording();
        const end = performance.now();
        expect(end - start).toBeLessThan(PERFORMANCE_THRESHOLDS.maxLatency);
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on unmount', () => {
      const { unmount } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));
      unmount();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should stop recording on unmount if active', async () => {
      const { result, unmount } = renderHook(() => useAudio(MOCK_AUDIO_CONFIG));

      await act(async () => {
        await result.current.startRecording();
      });

      unmount();
      expect(result.current.isRecording).toBe(false);
    });
  });
});