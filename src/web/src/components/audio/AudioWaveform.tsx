/**
 * @fileoverview Enhanced audio waveform visualization component with accessibility and performance optimizations
 * @version 1.0.0
 * Library versions:
 * - react@18.2.0
 * - styled-components@5.3.10
 */

import React, { useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAudio } from '../../hooks/useAudio';
import { WaveformData, AudioState, AudioError } from '../../types/audio.types';

// Constants for waveform rendering
const CANVAS_UPDATE_INTERVAL = 16.67; // ~60fps
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_LINE_COLOR = '#2196F3';
const BUFFER_SIZE = 2048;
const MAX_CANVAS_POINTS = 1000;
const WEBGL_ENABLED = true;

// Styled components for enhanced visuals and accessibility
const WaveformContainer = styled.div<{ isRecording: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  background-color: ${({ theme }) => theme.colors.background};
  border-radius: ${({ theme }) => theme.borderRadius};
  box-shadow: ${({ isRecording }) => isRecording ? '0 0 8px rgba(33, 150, 243, 0.4)' : 'none'};
  transition: box-shadow 0.3s ease;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.colors.error};
  text-align: center;
  padding: 1rem;
`;

// Interface definitions
interface WaveformTheme {
  colors: {
    primary: string;
    background: string;
    error: string;
  };
  borderRadius: string;
}

interface AudioWaveformProps {
  width: number;
  height: number;
  color?: string;
  theme?: WaveformTheme;
  onError?: (error: AudioError) => void;
}

/**
 * Enhanced audio waveform visualization component
 * @param props Component properties
 * @returns React component
 */
export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  width,
  height,
  color = DEFAULT_LINE_COLOR,
  theme,
  onError
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const { waveformData, audioState, audioError } = useAudio();

  /**
   * Optimized waveform drawing function with WebGL support
   */
  const drawWaveform = useCallback((
    ctx: CanvasRenderingContext2D | WebGLRenderingContext,
    data: number[],
    width: number,
    height: number,
    state: AudioState
  ) => {
    if (ctx instanceof WebGLRenderingContext && WEBGL_ENABLED) {
      drawWaveformWebGL(ctx, data, width, height, state);
    } else if (ctx instanceof CanvasRenderingContext2D) {
      drawWaveform2D(ctx, data, width, height, state);
    }
  }, []);

  /**
   * WebGL-based waveform rendering for improved performance
   */
  const drawWaveformWebGL = (
    gl: WebGLRenderingContext,
    data: number[],
    width: number,
    height: number,
    state: AudioState
  ) => {
    // WebGL initialization and shader setup
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    // Vertex shader program
    gl.shaderSource(vertexShader, `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `);

    // Fragment shader program
    gl.shaderSource(fragmentShader, `
      precision mediump float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }
    `);

    // Compile and link shaders
    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Create vertex buffer
    const vertices = new Float32Array(data.reduce((arr, value, i) => {
      const x = (i / data.length) * 2 - 1;
      const y = value * 0.5;
      return [...arr, x, y];
    }, []));

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set attributes and uniforms
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const colorLocation = gl.getUniformLocation(program, 'color');
    gl.uniform4fv(colorLocation, [0.13, 0.59, 0.95, 1.0]);

    // Draw waveform
    gl.drawArrays(gl.LINE_STRIP, 0, data.length);
  };

  /**
   * Canvas 2D-based waveform rendering fallback
   */
  const drawWaveform2D = (
    ctx: CanvasRenderingContext2D,
    data: number[],
    width: number,
    height: number,
    state: AudioState
  ) => {
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.lineWidth = DEFAULT_LINE_WIDTH;
    ctx.strokeStyle = state === AudioState.RECORDING ? color : '#999';

    const sliceWidth = width / Math.min(data.length, MAX_CANVAS_POINTS);
    const centerY = height / 2;
    let x = 0;

    for (let i = 0; i < data.length; i += Math.ceil(data.length / MAX_CANVAS_POINTS)) {
      const y = (data[i] * height) / 2 + centerY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
  };

  /**
   * Handle canvas rendering errors
   */
  const handleCanvasError = useCallback((error: AudioError) => {
    console.error('Canvas error:', error);
    onError?.(error);
  }, [onError]);

  /**
   * Setup canvas rendering and animation loop
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = WEBGL_ENABLED ? 
      canvas.getContext('webgl') || canvas.getContext('2d') :
      canvas.getContext('2d');

    if (!ctx) {
      handleCanvasError({
        code: 'CANVAS_CONTEXT_ERROR',
        message: 'Failed to get canvas context'
      });
      return;
    }

    const animate = () => {
      if (waveformData?.data) {
        drawWaveform(ctx, waveformData.data, width, height, audioState);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, waveformData, audioState, drawWaveform, handleCanvasError]);

  // Render component with error handling
  if (audioError) {
    return (
      <ErrorMessage role="alert" aria-live="polite">
        {audioError.message}
      </ErrorMessage>
    );
  }

  return (
    <WaveformContainer
      isRecording={audioState === AudioState.RECORDING}
      role="img"
      aria-label="Audio waveform visualization"
    >
      <Canvas
        ref={canvasRef}
        aria-hidden="true"
        data-testid="waveform-canvas"
      />
    </WaveformContainer>
  );
};

export default AudioWaveform;