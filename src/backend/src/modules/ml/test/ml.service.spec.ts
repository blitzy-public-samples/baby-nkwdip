import { Test, TestingModule } from '@nestjs/testing';
import * as tf from '@tensorflow/tfjs-node-gpu'; // v4.2.0
import { MLService } from '../ml.service';
import { FeatureExtractionService } from '../services/feature-extraction.service';
import { PredictionService } from '../services/prediction.service';
import { NeedType } from '../../analysis/interfaces/analysis.interface';

// Mock data and configurations
const MOCK_AUDIO_DATA = new Float32Array(1024).fill(0.5);
const MOCK_SAMPLE_RATE = 44100;
const MOCK_FEATURES = {
  temporal: { rms: 0.8, zeroCrossingRate: 0.3, energy: 0.9 },
  spectral: {
    centroid: 440,
    spread: 0.5,
    flatness: 0.7,
    rolloff: 0.8,
    mfcc: new Array(13).fill(0.5)
  },
  cry: {
    fundamentalFreq: 350,
    formants: [500, 1500, 2500],
    harmonicRatio: 0.85,
    confidence: 0.92
  }
};

const MOCK_PREDICTION = {
  needType: NeedType.HUNGER,
  confidence: 0.95,
  features: MOCK_FEATURES,
  timestamp: new Date(),
  modelVersion: '1.0.0'
};

const GPU_CONFIG = {
  memory: {
    limit: 0.8,
    forceGPU: true
  },
  optimization: {
    batchSize: 32,
    cacheEnabled: true
  }
};

const DISTRIBUTED_CONFIG = {
  nodes: 3,
  batchSize: 64,
  syncInterval: 1000,
  learningRate: 0.001
};

describe('MLService', () => {
  let service: MLService;
  let featureExtractionService: FeatureExtractionService;
  let predictionService: PredictionService;
  let module: TestingModule;

  beforeEach(async () => {
    // Configure mocks with performance tracking
    const mockFeatureExtractionService = {
      extractFeatures: jest.fn().mockResolvedValue(MOCK_FEATURES),
      optimizeForGPU: jest.fn().mockResolvedValue(true)
    };

    const mockPredictionService = {
      predict: jest.fn().mockResolvedValue(MOCK_PREDICTION),
      loadModel: jest.fn().mockResolvedValue(true),
      enableDistributedTraining: jest.fn().mockResolvedValue(true)
    };

    // Create testing module with GPU optimization
    module = await Test.createTestingModule({
      providers: [
        MLService,
        {
          provide: FeatureExtractionService,
          useValue: mockFeatureExtractionService
        },
        {
          provide: PredictionService,
          useValue: mockPredictionService
        }
      ]
    }).compile();

    // Initialize services
    service = module.get<MLService>(MLService);
    featureExtractionService = module.get<FeatureExtractionService>(FeatureExtractionService);
    predictionService = module.get<PredictionService>(PredictionService);

    // Configure TensorFlow for GPU
    await tf.setBackend('tensorflow');
    tf.enableProdMode();
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('analyzeCry', () => {
    it('should achieve >90% classification accuracy', async () => {
      // Prepare test data
      const testCases = Array(100).fill(null).map(() => ({
        audio: MOCK_AUDIO_DATA,
        sampleRate: MOCK_SAMPLE_RATE,
        expectedType: NeedType.HUNGER
      }));

      // Track accuracy metrics
      let correctPredictions = 0;

      // Run test cases
      for (const testCase of testCases) {
        const result = await service.analyzeCry(testCase.audio, testCase.sampleRate);
        if (result.needType === testCase.expectedType && result.confidence > 0.9) {
          correctPredictions++;
        }
      }

      const accuracy = correctPredictions / testCases.length;
      expect(accuracy).toBeGreaterThan(0.9);
    });

    it('should process audio with GPU optimization', async () => {
      const gpuSpy = jest.spyOn(tf, 'tidy');
      
      await service.analyzeCry(MOCK_AUDIO_DATA, MOCK_SAMPLE_RATE);
      
      expect(gpuSpy).toHaveBeenCalled();
      expect(featureExtractionService.optimizeForGPU).toHaveBeenCalled();
    });

    it('should handle background noise effectively', async () => {
      // Add noise to test data
      const noisyData = MOCK_AUDIO_DATA.map(x => x + Math.random() * 0.1);
      
      const result = await service.analyzeCry(new Float32Array(noisyData), MOCK_SAMPLE_RATE);
      
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('should maintain real-time performance', async () => {
      const startTime = performance.now();
      
      await service.analyzeCry(MOCK_AUDIO_DATA, MOCK_SAMPLE_RATE);
      
      const processingTime = performance.now() - startTime;
      expect(processingTime).toBeLessThan(1000); // Max 1 second processing time
    });
  });

  describe('trainNewModel', () => {
    it('should achieve learning speed of <2 weeks', async () => {
      const trainingData = Array(1000).fill(MOCK_AUDIO_DATA);
      const labels = Array(1000).fill(NeedType.HUNGER);
      
      const startTime = Date.now();
      
      await service.trainNewModel(trainingData, labels, {
        ...DISTRIBUTED_CONFIG,
        gpuConfig: GPU_CONFIG
      });
      
      const trainingTime = Date.now() - startTime;
      const twoWeeksInMs = 14 * 24 * 60 * 60 * 1000;
      
      expect(trainingTime).toBeLessThan(twoWeeksInMs);
    });

    it('should utilize distributed training effectively', async () => {
      const trainingData = Array(1000).fill(MOCK_AUDIO_DATA);
      const labels = Array(1000).fill(NeedType.HUNGER);
      
      await service.trainNewModel(trainingData, labels, DISTRIBUTED_CONFIG);
      
      expect(predictionService.enableDistributedTraining)
        .toHaveBeenCalledWith(expect.objectContaining({
          nodes: DISTRIBUTED_CONFIG.nodes,
          batchSize: DISTRIBUTED_CONFIG.batchSize
        }));
    });

    it('should optimize GPU memory usage', async () => {
      const memorySpy = jest.spyOn(tf, 'memory');
      
      await service.trainNewModel(
        [MOCK_AUDIO_DATA],
        [NeedType.HUNGER],
        { ...DISTRIBUTED_CONFIG, gpuConfig: GPU_CONFIG }
      );
      
      expect(memorySpy).toHaveBeenCalled();
      const memoryInfo = await tf.memory();
      expect(memoryInfo.numBytes / memoryInfo.numBytesInGPU)
        .toBeLessThan(GPU_CONFIG.memory.limit);
    });
  });

  describe('updateModel', () => {
    it('should maintain accuracy after updates', async () => {
      const newData = Array(100).fill(MOCK_AUDIO_DATA);
      const newLabels = Array(100).fill(NeedType.HUNGER);
      
      const result = await service.updateModel(newData, newLabels);
      
      expect(result.accuracy).toBeGreaterThan(0.9);
    });

    it('should handle incremental learning efficiently', async () => {
      const updateSpy = jest.spyOn(service, 'updateModel');
      
      for (let i = 0; i < 5; i++) {
        await service.updateModel(
          [MOCK_AUDIO_DATA],
          [NeedType.HUNGER]
        );
      }
      
      expect(updateSpy).toHaveBeenCalledTimes(5);
      expect(featureExtractionService.extractFeatures)
        .toHaveBeenCalledTimes(5);
    });
  });

  describe('getModelMetrics', () => {
    it('should track comprehensive performance metrics', async () => {
      const metrics = await service.getModelMetrics();
      
      expect(metrics).toEqual(expect.objectContaining({
        accuracy: expect.any(Number),
        latency: expect.any(Number),
        gpuUtilization: expect.any(Number),
        memoryUsage: expect.any(Number)
      }));
      
      expect(metrics.accuracy).toBeGreaterThan(0.9);
      expect(metrics.latency).toBeLessThan(1000);
    });
  });
});