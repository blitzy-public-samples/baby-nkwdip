import { Injectable, Logger } from '@nestjs/common';
import {
  extractAudioFeatures,
  filterBackground,
  computeMFCC,
  detectPitch,
  IAudioFeatures,
  IAudioOptions,
  IFilterOptions
} from '../../../common/utils/audio.util';

/**
 * Version control for feature extraction algorithms
 */
const FEATURE_VERSION = '1.0.0';

/**
 * Configuration constants for feature extraction
 */
const FEATURE_CONFIG = {
  NORMALIZATION_RANGE: [-1, 1],
  MAX_QUEUE_SIZE: 1000,
  PROCESSING_TIMEOUT: 5000,
  BATCH_SIZE: 32,
  MIN_CONFIDENCE_THRESHOLD: 0.7
} as const;

/**
 * Interface for feature extraction options
 */
interface FeatureExtractionOptions extends IAudioOptions {
  enableNoiseReduction?: boolean;
  enableBatchProcessing?: boolean;
  confidenceThreshold?: number;
  timeoutMs?: number;
}

/**
 * Interface for normalization options
 */
interface NormalizationOptions {
  range?: [number, number];
  outlierThreshold?: number;
  method?: 'minmax' | 'zscore' | 'robust';
}

/**
 * Interface for feature quality metrics
 */
interface FeatureQualityMetrics {
  snr: number;
  clarity: number;
  confidence: number;
  processingTime: number;
}

/**
 * Service responsible for extracting and processing acoustic features from baby cry audio
 * with real-time optimization and comprehensive error handling.
 */
@Injectable()
export class FeatureExtractionService {
  private readonly logger = new Logger(FeatureExtractionService.name);
  private readonly featureConfig: typeof FEATURE_CONFIG;
  private readonly processingQueue: Array<{
    id: string;
    data: Float32Array;
    timestamp: number;
  }>;
  private readonly qualityMetrics: Map<string, FeatureQualityMetrics>;

  constructor() {
    this.logger.log(`Initializing FeatureExtractionService v${FEATURE_VERSION}`);
    this.featureConfig = FEATURE_CONFIG;
    this.processingQueue = [];
    this.qualityMetrics = new Map();

    // Initialize performance monitoring
    this.setupPerformanceMonitoring();
  }

  /**
   * Extracts comprehensive feature set from audio data with real-time optimization
   * @param audioData Raw audio samples as Float32Array
   * @param sampleRate Audio sample rate in Hz
   * @param options Feature extraction configuration options
   * @returns Promise resolving to extracted and normalized features with quality metrics
   */
  async extractFeatures(
    audioData: Float32Array,
    sampleRate: number,
    options: FeatureExtractionOptions = {}
  ): Promise<Record<string, number>> {
    const startTime = performance.now();

    try {
      // Validate input parameters
      this.validateInput(audioData, sampleRate, options);

      // Queue management
      if (this.processingQueue.length >= this.featureConfig.MAX_QUEUE_SIZE) {
        throw new Error('Processing queue is full');
      }

      const processId = crypto.randomUUID();
      this.processingQueue.push({
        id: processId,
        data: audioData,
        timestamp: Date.now()
      });

      // Apply noise reduction if enabled
      let processedData = audioData;
      if (options.enableNoiseReduction !== false) {
        processedData = filterBackground(audioData, sampleRate, {
          adaptiveThreshold: true,
          spectralSubtraction: true,
          wienerFilter: true,
          medianFilter: true
        });
      }

      // Extract features with timeout protection
      const timeoutMs = options.timeoutMs || this.featureConfig.PROCESSING_TIMEOUT;
      const featuresPromise = Promise.race([
        extractAudioFeatures(processedData, sampleRate, options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Feature extraction timeout')), timeoutMs)
        )
      ]);

      const features = await featuresPromise as IAudioFeatures;

      // Normalize and validate features
      const normalizedFeatures = this.normalizeFeatures(features, {
        range: this.featureConfig.NORMALIZATION_RANGE,
        outlierThreshold: 2.5,
        method: 'robust'
      });

      // Calculate quality metrics
      const processingTime = performance.now() - startTime;
      const qualityMetrics = this.calculateQualityMetrics(
        normalizedFeatures,
        processingTime
      );

      // Cache quality metrics
      this.qualityMetrics.set(processId, qualityMetrics);

      // Cleanup queue
      this.processingQueue.splice(
        this.processingQueue.findIndex(item => item.id === processId),
        1
      );

      // Validate confidence threshold
      if (qualityMetrics.confidence < (options.confidenceThreshold || this.featureConfig.MIN_CONFIDENCE_THRESHOLD)) {
        this.logger.warn('Low confidence in extracted features', { qualityMetrics });
      }

      return normalizedFeatures;

    } catch (error) {
      this.logger.error('Feature extraction failed', {
        error,
        sampleRate,
        dataLength: audioData?.length
      });
      throw error;
    }
  }

  /**
   * Normalizes extracted features with advanced outlier handling
   * @param features Raw extracted features
   * @param options Normalization configuration options
   * @returns Normalized features with quality metrics
   */
  private normalizeFeatures(
    features: IAudioFeatures,
    options: NormalizationOptions
  ): Record<string, number> {
    const normalizedFeatures: Record<string, number> = {};

    try {
      // Flatten features object
      const flatFeatures = this.flattenFeatures(features);

      // Calculate statistics for normalization
      const stats = this.calculateFeatureStatistics(flatFeatures);

      // Apply normalization based on selected method
      for (const [key, value] of Object.entries(flatFeatures)) {
        switch (options.method) {
          case 'zscore':
            normalizedFeatures[key] = (value - stats.mean[key]) / stats.std[key];
            break;
          case 'robust':
            normalizedFeatures[key] = (value - stats.median[key]) / stats.iqr[key];
            break;
          case 'minmax':
          default:
            normalizedFeatures[key] = (value - stats.min[key]) / (stats.max[key] - stats.min[key]);
        }

        // Scale to target range
        const [min, max] = options.range || this.featureConfig.NORMALIZATION_RANGE;
        normalizedFeatures[key] = normalizedFeatures[key] * (max - min) + min;

        // Handle outliers
        if (options.outlierThreshold) {
          normalizedFeatures[key] = this.clampOutliers(
            normalizedFeatures[key],
            options.outlierThreshold
          );
        }
      }

      return normalizedFeatures;

    } catch (error) {
      this.logger.error('Feature normalization failed', { error });
      throw error;
    }
  }

  /**
   * Validates input parameters for feature extraction
   */
  private validateInput(
    audioData: Float32Array,
    sampleRate: number,
    options: FeatureExtractionOptions
  ): void {
    if (!audioData || !(audioData instanceof Float32Array)) {
      throw new Error('Invalid audio data: Expected Float32Array');
    }
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new Error('Invalid sample rate');
    }
    if (audioData.length === 0) {
      throw new Error('Empty audio data');
    }
  }

  /**
   * Calculates quality metrics for extracted features
   */
  private calculateQualityMetrics(
    features: Record<string, number>,
    processingTime: number
  ): FeatureQualityMetrics {
    return {
      snr: this.calculateSignalToNoiseRatio(features),
      clarity: this.calculateClarity(features),
      confidence: this.calculateConfidenceScore(features),
      processingTime
    };
  }

  /**
   * Sets up performance monitoring for the service
   */
  private setupPerformanceMonitoring(): void {
    setInterval(() => {
      const queueSize = this.processingQueue.length;
      const avgProcessingTime = Array.from(this.qualityMetrics.values())
        .reduce((sum, metrics) => sum + metrics.processingTime, 0) / this.qualityMetrics.size;

      this.logger.debug('Performance metrics', {
        queueSize,
        avgProcessingTime,
        metricsCount: this.qualityMetrics.size
      });

      // Cleanup old metrics
      const oldestAllowed = Date.now() - 3600000; // 1 hour
      this.processingQueue
        .filter(item => item.timestamp < oldestAllowed)
        .forEach(item => this.qualityMetrics.delete(item.id));
    }, 60000); // Every minute
  }

  // Additional private utility methods would be implemented here...
}