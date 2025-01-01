/**
 * @fileoverview Comprehensive test suite for AudioWaveform component
 * Library versions:
 * - react@18.2.0
 * - @testing-library/react@13.4.0
 * - jest@29.0.0
 * - axe-core@4.7.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AudioWaveform } from '../../../components/audio/AudioWaveform';
import { useAudio } from '../../../hooks/useAudio';
import { AudioState } from '../../../types/audio.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAudio hook
jest.mock('../../../hooks/useAudio');

// Mock canvas and WebGL contexts
const mockCanvasContext = jest.fn();
const mockWebGLContext = jest.fn();
const mockGetContext = jest.fn();

// Mock performance.now for animation frame testing
const mockPerformanceNow = jest.fn();

describe('AudioWaveform', () => {
  // Default props for component testing
  const defaultProps = {
    width: 800,
    height: 400,
    color: '#2196F3',
    theme: {
      colors: {
        primary: '#2196F3',
        background: '#ffffff',
        error: '#ff0000'
      },
      borderRadius: '4px'
    }
  };

  // Mock waveform data
  const mockWaveformData = {
    data: Float32Array.from(Array(100).fill(0).map(() => Math.random() * 2 - 1)),
    sampleRate: 44100,
    duration: 1000
  };

  beforeAll(() => {
    // Setup canvas mocking
    HTMLCanvasElement.prototype.getContext = mockGetContext;
    window.performance.now = mockPerformanceNow;

    // Setup WebGL context mocking
    mockWebGLContext.mockImplementation(() => ({
      viewport: jest.fn(),
      clear: jest.fn(),
      createShader: jest.fn(),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      createProgram: jest.fn(),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      useProgram: jest.fn(),
      createBuffer: jest.fn(),
      bindBuffer: jest.fn(),
      bufferData: jest.fn(),
      getAttribLocation: jest.fn(),
      enableVertexAttribArray: jest.fn(),
      vertexAttribPointer: jest.fn(),
      getUniformLocation: jest.fn(),
      uniform4fv: jest.fn(),
      drawArrays: jest.fn()
    }));

    // Setup 2D context mocking
    mockCanvasContext.mockImplementation(() => ({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn()
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
    mockGetContext.mockImplementation((contextType) => {
      return contextType === 'webgl' ? mockWebGLContext() : mockCanvasContext();
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering and Initialization', () => {
    it('should render without errors', () => {
      (useAudio as jest.Mock).mockReturnValue({
        waveformData: null,
        audioState: AudioState.IDLE,
        error: null
      });

      const { container } = render(<AudioWaveform {...defaultProps} />);
      expect(container).toBeTruthy();
      expect(screen.getByTestId('waveform-canvas')).toBeInTheDocument();
    });

    it('should initialize with correct dimensions', () => {
      render(<AudioWaveform {...defaultProps} />);
      const canvas = screen.getByTestId('waveform-canvas');
      expect(canvas).toHaveAttribute('width', defaultProps.width.toString());
      expect(canvas).toHaveAttribute('height', defaultProps.height.toString());
    });

    it('should meet accessibility standards', async () => {
      const { container } = render(<AudioWaveform {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('WebGL Rendering', () => {
    it('should initialize WebGL context when supported', () => {
      render(<AudioWaveform {...defaultProps} />);
      expect(mockGetContext).toHaveBeenCalledWith('webgl');
    });

    it('should fallback to 2D context when WebGL is not supported', () => {
      mockGetContext.mockImplementation((contextType) => {
        return contextType === 'webgl' ? null : mockCanvasContext();
      });
      render(<AudioWaveform {...defaultProps} />);
      expect(mockGetContext).toHaveBeenCalledWith('2d');
    });

    it('should setup WebGL shaders and buffers correctly', () => {
      (useAudio as jest.Mock).mockReturnValue({
        waveformData: mockWaveformData,
        audioState: AudioState.RECORDING,
        error: null
      });

      render(<AudioWaveform {...defaultProps} />);
      expect(mockWebGLContext().createShader).toHaveBeenCalled();
      expect(mockWebGLContext().createProgram).toHaveBeenCalled();
      expect(mockWebGLContext().createBuffer).toHaveBeenCalled();
    });
  });

  describe('Waveform Visualization', () => {
    it('should update canvas when waveform data changes', async () => {
      (useAudio as jest.Mock).mockReturnValue({
        waveformData: mockWaveformData,
        audioState: AudioState.RECORDING,
        error: null
      });

      render(<AudioWaveform {...defaultProps} />);
      await waitFor(() => {
        expect(mockWebGLContext().drawArrays).toHaveBeenCalled();
      });
    });

    it('should handle empty waveform data gracefully', () => {
      (useAudio as jest.Mock).mockReturnValue({
        waveformData: { data: new Float32Array(), sampleRate: 44100, duration: 0 },
        audioState: AudioState.IDLE,
        error: null
      });

      render(<AudioWaveform {...defaultProps} />);
      expect(mockWebGLContext().drawArrays).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when audio error occurs', () => {
      const error = { code: 'AUDIO_ERROR', message: 'Audio processing failed' };
      (useAudio as jest.Mock).mockReturnValue({
        waveformData: null,
        audioState: AudioState.ERROR,
        error
      });

      render(<AudioWaveform {...defaultProps} />);
      expect(screen.getByRole('alert')).toHaveTextContent(error.message);
    });

    it('should call onError callback when canvas error occurs', () => {
      const onError = jest.fn();
      mockGetContext.mockReturnValue(null);

      render(<AudioWaveform {...defaultProps} onError={onError} />);
      expect(onError).toHaveBeenCalledWith({
        code: 'CANVAS_CONTEXT_ERROR',
        message: 'Failed to get canvas context'
      });
    });
  });

  describe('Performance', () => {
    it('should maintain consistent frame rate', async () => {
      const frameTimings: number[] = [];
      mockPerformanceNow.mockImplementation(() => frameTimings.length * 16.67);

      (useAudio as jest.Mock).mockReturnValue({
        waveformData: mockWaveformData,
        audioState: AudioState.RECORDING,
        error: null
      });

      render(<AudioWaveform {...defaultProps} />);

      // Simulate 60 frames
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 16.67));
        frameTimings.push(performance.now());
      }

      // Check frame timing consistency
      const frameDeltas = frameTimings.slice(1).map((time, i) => time - frameTimings[i]);
      const avgDelta = frameDeltas.reduce((a, b) => a + b) / frameDeltas.length;
      expect(avgDelta).toBeCloseTo(16.67, 1);
    });
  });

  describe('Accessibility', () => {
    it('should provide appropriate ARIA labels', () => {
      render(<AudioWaveform {...defaultProps} />);
      const container = screen.getByRole('img');
      expect(container).toHaveAttribute('aria-label', 'Audio waveform visualization');
    });

    it('should hide canvas from screen readers', () => {
      render(<AudioWaveform {...defaultProps} />);
      const canvas = screen.getByTestId('waveform-canvas');
      expect(canvas).toHaveAttribute('aria-hidden', 'true');
    });
  });
});