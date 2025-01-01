/**
 * @fileoverview Core service for managing audio recording, processing, and analysis
 * @version 1.0.0
 * Library versions:
 * - web-media-recorder@2.0.0
 * - @tensorflow/tfjs@4.2.0
 * - compression-streams-polyfill@1.0.0
 */

import { injectable } from 'inversify';
import { MediaRecorder } from 'web-media-recorder';
import * as tf from '@tensorflow/tfjs';
import {
  AudioConfig,
  AudioFeatures,
  WaveformData,
  AudioState,
  AudioAnalysisResult,
  AudioQualityMetrics,
} from '../types/audio.types';
import {
  processAudioChunk,
  generateWaveform,
  validateAudioQuality,
} from '../utils/audio.util';
import { ApiService } from './api.service';

// Constants for audio processing
const CHUNK_SIZE = 4096;
const MAX_RECORDING_DURATION = 300000; // 5 minutes
const WAVEFORM_POINTS = 100;
const ANALYSIS_INTERVAL = 1000;
const RETRY_ATTEMPTS = 3;
const COMPRESSION_THRESHOLD = 10485760; // 10MB
const NOISE_ADAPTATION_INTERVAL = 5000;

interface RetryConfig {
  attempts: number;
  backoffMs: number;
}

@injectable()
export class AudioService {
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private currentState: AudioState = AudioState.IDLE;
  private processingWorker: Worker | null = null;
  private qualityMetrics: AudioQualityMetrics | null = null;
  private recordingTimeout: NodeJS.Timeout | null = null;
  private chunks: Blob[] = [];
  private analysisInterval: NodeJS.Timeout | null = null;
  private noiseAdaptationInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: AudioConfig,
    private apiService: ApiService,
    private retrySettings: RetryConfig = { attempts: RETRY_ATTEMPTS, backoffMs: 1000 }
  ) {
    this.validateBrowserSupport();
    this.initializeAudioContext();
    this.setupProcessingWorker();
  }

  /**
   * Starts audio recording with quality monitoring
   * @throws {Error} If recording cannot be started
   */
  public async startRecording(): Promise<void> {
    try {
      await this.validatePermissions();
      await this.setupAudioStream();

      this.recorder = await this.createMediaRecorder();
      this.setupRecorderHandlers();
      this.startQualityMonitoring();
      
      this.recorder.start(CHUNK_SIZE);
      this.currentState = AudioState.RECORDING;
      
      this.setupRecordingTimeout();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.currentState = AudioState.ERROR;
      throw error;
    }
  }

  /**
   * Stops current recording and processes collected data
   * @returns {Promise<AudioAnalysisResult>} Analysis results
   */
  public async stopRecording(): Promise<AudioAnalysisResult> {
    if (this.currentState !== AudioState.RECORDING) {
      throw new Error('No active recording to stop');
    }

    try {
      this.clearIntervals();
      this.recorder?.stop();
      
      const audioBlob = await this.processRecordedChunks();
      const analysisResult = await this.analyzeAudio(audioBlob);
      
      this.resetState();
      return analysisResult;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.currentState = AudioState.ERROR;
      throw error;
    }
  }

  /**
   * Generates waveform data for visualization
   * @param audioData Raw audio data
   * @returns {Promise<WaveformData>} Processed waveform data
   */
  public async getWaveformData(audioData: Float32Array): Promise<WaveformData> {
    try {
      return await generateWaveform(audioData, this.config.sampleRate, {
        points: WAVEFORM_POINTS,
        normalize: true,
      });
    } catch (error) {
      console.error('Failed to generate waveform:', error);
      throw error;
    }
  }

  /**
   * Processes audio data and returns analysis results
   * @param audioBlob Audio data to analyze
   * @returns {Promise<AudioAnalysisResult>} Analysis results
   */
  private async analyzeAudio(audioBlob: Blob): Promise<AudioAnalysisResult> {
    this.currentState = AudioState.ANALYZING;

    try {
      const compressedBlob = await this.compressAudioIfNeeded(audioBlob);
      const features = await this.extractFeatures(compressedBlob);
      
      return await this.retryAnalysis(async () => {
        return await this.apiService.analyzeAudio(compressedBlob);
      });
    } catch (error) {
      console.error('Audio analysis failed:', error);
      throw error;
    }
  }

  private async validatePermissions(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      throw new Error('Microphone permission denied');
    }
  }

  private async setupAudioStream(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: this.config.channels,
        sampleRate: this.config.sampleRate,
      },
    });

    if (this.audioContext) {
      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(
        CHUNK_SIZE,
        this.config.channels,
        this.config.channels
      );

      source.connect(processor);
      processor.connect(this.audioContext.destination);
    }
  }

  private createMediaRecorder(): MediaRecorder {
    const options = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: this.config.bitDepth * this.config.sampleRate,
    };

    return new MediaRecorder(
      new MediaStream([this.createAudioTrack()]),
      options
    );
  }

  private setupRecorderHandlers(): void {
    if (!this.recorder) return;

    this.recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
        await this.processLatestChunk(event.data);
      }
    };

    this.recorder.onerror = (error) => {
      console.error('Recorder error:', error);
      this.currentState = AudioState.ERROR;
    };
  }

  private async processLatestChunk(chunk: Blob): Promise<void> {
    try {
      const arrayBuffer = await chunk.arrayBuffer();
      const audioData = new Float32Array(arrayBuffer);
      
      const features = await processAudioChunk(arrayBuffer, this.config);
      this.updateQualityMetrics(features);
      
      if (this.processingWorker) {
        this.processingWorker.postMessage({
          type: 'processChunk',
          data: audioData,
          config: this.config,
        });
      }
    } catch (error) {
      console.error('Chunk processing failed:', error);
    }
  }

  private async compressAudioIfNeeded(blob: Blob): Promise<Blob> {
    if (blob.size < COMPRESSION_THRESHOLD) {
      return blob;
    }

    const compressed = new Blob([await new Response(
      new CompressionStream('deflate').writable
    ).blob()], { type: blob.type });

    return compressed;
  }

  private async extractFeatures(audioBlob: Blob): Promise<AudioFeatures> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    return await processAudioChunk(arrayBuffer, this.config);
  }

  private async retryAnalysis<T>(
    operation: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.retrySettings.attempts) throw error;
      
      await new Promise(resolve => 
        setTimeout(resolve, this.retrySettings.backoffMs * Math.pow(2, attempt))
      );
      
      return this.retryAnalysis(operation, attempt + 1);
    }
  }

  private validateBrowserSupport(): void {
    if (!navigator.mediaDevices || !MediaRecorder) {
      throw new Error('Browser does not support audio recording');
    }
  }

  private initializeAudioContext(): void {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: this.config.sampleRate,
      latencyHint: 'interactive',
    });
  }

  private setupProcessingWorker(): void {
    this.processingWorker = new Worker(
      new URL('../workers/audio.worker', import.meta.url)
    );

    this.processingWorker.onmessage = (event) => {
      if (event.data.type === 'featureExtracted') {
        this.handleFeatureExtraction(event.data.features);
      }
    };
  }

  private clearIntervals(): void {
    if (this.recordingTimeout) clearTimeout(this.recordingTimeout);
    if (this.analysisInterval) clearInterval(this.analysisInterval);
    if (this.noiseAdaptationInterval) clearInterval(this.noiseAdaptationInterval);
  }

  private resetState(): void {
    this.chunks = [];
    this.currentState = AudioState.IDLE;
    this.qualityMetrics = null;
    this.clearIntervals();
  }

  private createAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    return dst.stream.getAudioTracks()[0];
  }

  private startQualityMonitoring(): void {
    this.analysisInterval = setInterval(() => {
      if (this.qualityMetrics && this.qualityMetrics.signalToNoiseRatio < 0.2) {
        console.warn('Poor audio quality detected');
      }
    }, ANALYSIS_INTERVAL);
  }

  private setupRecordingTimeout(): void {
    this.recordingTimeout = setTimeout(() => {
      if (this.currentState === AudioState.RECORDING) {
        this.stopRecording().catch(console.error);
      }
    }, MAX_RECORDING_DURATION);
  }

  private handleFeatureExtraction(features: AudioFeatures): void {
    // Handle extracted features for real-time analysis
    if (this.currentState === AudioState.RECORDING) {
      this.updateQualityMetrics(features);
    }
  }

  private updateQualityMetrics(features: AudioFeatures): void {
    // Update quality metrics based on extracted features
    this.qualityMetrics = {
      signalToNoiseRatio: features.noiseLevel,
      clarity: features.zeroCrossingRate,
      distortion: 0,
    };
  }
}