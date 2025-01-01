import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { HttpStatus } from '@nestjs/common'; // v9.0.0
import { JwtAuthGuard } from '@nestjs/jwt'; // v9.0.0
import { TestingLogger } from '@nestjs/common/testing'; // v9.0.0
import { AnalysisController } from '../analysis.controller';
import { AnalysisService } from '../analysis.service';
import { NeedType } from '../interfaces/analysis.interface';

// Constants for test configuration
const PERFORMANCE_THRESHOLD = 200; // 200ms max processing time
const ACCURACY_THRESHOLD = 0.9; // 90% minimum accuracy requirement
const TEST_TIMEOUT = 10000; // 10 second test timeout

// Mock data
const mockAnalysisService = {
  analyzeAudio: jest.fn(),
  getAnalysisHistory: jest.fn(),
  getAnalysisById: jest.fn(),
  deleteAnalysis: jest.fn(),
  getAnalysisMetrics: jest.fn(),
  batchAnalyzeAudio: jest.fn()
};

const mockJwtAuthGuard = {
  canActivate: jest.fn().mockImplementation(() => true)
};

describe('AnalysisController', () => {
  let controller: AnalysisController;
  let service: AnalysisService;
  let logger: TestingLogger;

  beforeAll(async () => {
    logger = new TestingLogger();
    logger.setLogLevels(['error', 'warn']);
    jest.setTimeout(TEST_TIMEOUT);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        {
          provide: AnalysisService,
          useValue: mockAnalysisService
        }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .setLogger(logger)
      .compile();

    controller = module.get<AnalysisController>(AnalysisController);
    service = module.get<AnalysisService>(AnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeAudio', () => {
    const mockAudioData = {
      babyId: '123e4567-e89b-12d3-a456-426614174000',
      audioData: new Float32Array(16000).buffer, // 1 second of audio at 16kHz
      timestamp: new Date().toISOString(),
      metadata: {
        environment: 'quiet',
        deviceType: 'iOS'
      }
    };

    const mockAnalysisResult = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      babyId: mockAudioData.babyId,
      needType: NeedType.HUNGER,
      confidence: 0.95,
      features: {
        amplitude: 75,
        frequency: 350,
        duration: 2.5,
        pattern: 'PATTERN-001',
        noiseLevel: 20
      },
      timestamp: new Date(),
      modelVersion: '1.0.0',
      processingDuration: 150
    };

    it('should analyze audio with high accuracy within performance threshold', async () => {
      mockAnalysisService.analyzeAudio.mockResolvedValue(mockAnalysisResult);
      
      const startTime = performance.now();
      const result = await controller.analyzeAudio(mockAudioData);
      const processingTime = performance.now() - startTime;

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
      expect(processingTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD);
      expect(result.needType).toBeDefined();
      expect(result.features).toBeDefined();
    });

    it('should handle invalid audio data gracefully', async () => {
      const invalidData = { ...mockAudioData, audioData: null };
      
      await expect(controller.analyzeAudio(invalidData))
        .rejects
        .toThrow('Audio analysis failed');
    });

    it('should validate minimum confidence threshold', async () => {
      const lowConfidenceResult = {
        ...mockAnalysisResult,
        confidence: 0.85
      };
      mockAnalysisService.analyzeAudio.mockResolvedValue(lowConfidenceResult);

      const result = await controller.analyzeAudio(mockAudioData);
      expect(result.confidence).toBeLessThan(ACCURACY_THRESHOLD);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('getAnalysisHistory', () => {
    const mockHistoryParams = {
      babyId: '123e4567-e89b-12d3-a456-426614174000',
      page: 1,
      limit: 10,
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31'),
      needType: NeedType.HUNGER,
      minConfidence: 0.9
    };

    const mockHistoryResult = {
      results: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          babyId: mockHistoryParams.babyId,
          needType: NeedType.HUNGER,
          confidence: 0.95,
          timestamp: new Date(),
          features: {
            amplitude: 75,
            frequency: 350,
            duration: 2.5,
            pattern: 'PATTERN-001',
            noiseLevel: 20
          }
        }
      ],
      total: 1,
      page: 1,
      pages: 1
    };

    it('should retrieve analysis history with pagination', async () => {
      mockAnalysisService.getAnalysisHistory.mockResolvedValue(mockHistoryResult);

      const result = await controller.getAnalysisHistory(
        mockHistoryParams.babyId,
        mockHistoryParams.page,
        mockHistoryParams.limit,
        mockHistoryParams.startDate,
        mockHistoryParams.endDate,
        mockHistoryParams.needType,
        mockHistoryParams.minConfidence
      );

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.results[0].confidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    });

    it('should handle invalid date range filters', async () => {
      const invalidParams = {
        ...mockHistoryParams,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2023-01-01')
      };

      await expect(controller.getAnalysisHistory(
        invalidParams.babyId,
        invalidParams.page,
        invalidParams.limit,
        invalidParams.startDate,
        invalidParams.endDate,
        invalidParams.needType,
        invalidParams.minConfidence
      )).rejects.toThrow();
    });
  });

  describe('getAnalysisMetrics', () => {
    const mockMetricsParams = {
      babyId: '123e4567-e89b-12d3-a456-426614174000'
    };

    const mockMetricsResult = {
      totalAnalyses: 100,
      avgConfidence: 0.95,
      needTypeDistribution: {
        [NeedType.HUNGER]: 40,
        [NeedType.SLEEP]: 30,
        [NeedType.PAIN]: 15,
        [NeedType.DISCOMFORT]: 15
      },
      processingMetrics: {
        totalAnalyses: 100,
        avgProcessingTime: 150,
        successRate: 0.98,
        lastUpdateTime: Date.now()
      }
    };

    it('should retrieve comprehensive analysis metrics', async () => {
      mockAnalysisService.getAnalysisMetrics.mockResolvedValue(mockMetricsResult);

      const result = await controller.getAnalysisMetrics(mockMetricsParams.babyId);

      expect(result).toBeDefined();
      expect(result.avgConfidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
      expect(result.processingMetrics.avgProcessingTime).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD);
      expect(Object.keys(result.needTypeDistribution)).toHaveLength(Object.keys(NeedType).length);
    });
  });

  describe('batchAnalyzeAudio', () => {
    const mockBatchData = [
      {
        babyId: '123e4567-e89b-12d3-a456-426614174000',
        audioData: new Float32Array(16000).buffer,
        timestamp: new Date().toISOString()
      },
      {
        babyId: '123e4567-e89b-12d3-a456-426614174000',
        audioData: new Float32Array(16000).buffer,
        timestamp: new Date().toISOString()
      }
    ];

    const mockBatchResults = mockBatchData.map((data, index) => ({
      id: `123e4567-e89b-12d3-a456-42661417400${index}`,
      babyId: data.babyId,
      needType: NeedType.HUNGER,
      confidence: 0.95,
      features: {
        amplitude: 75,
        frequency: 350,
        duration: 2.5,
        pattern: `PATTERN-00${index}`,
        noiseLevel: 20
      },
      timestamp: new Date(),
      modelVersion: '1.0.0',
      processingDuration: 150
    }));

    it('should process batch analysis efficiently', async () => {
      mockAnalysisService.batchAnalyzeAudio.mockResolvedValue(mockBatchResults);

      const startTime = performance.now();
      const results = await controller.batchAnalyzeAudio(mockBatchData);
      const processingTime = performance.now() - startTime;

      expect(results).toHaveLength(mockBatchData.length);
      expect(processingTime / results.length).toBeLessThanOrEqual(PERFORMANCE_THRESHOLD);
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
      });
    });
  });
});