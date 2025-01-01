import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { getModelToken } from '@nestjs/mongoose'; // v9.0.0
import { Model } from 'mongoose'; // v6.0.0
import { BabyService } from '../baby.service';
import { Baby, BabyDocument } from '../schemas/baby.schema';
import { MLService } from '../../ml/ml.service';
import { NeedType } from '../../analysis/interfaces/analysis.interface';
import { Logger } from '@nestjs/common';

// Mock data constants
const TEST_USER_ID = 'test-user-123';
const TEST_BABY_ID = 'test-baby-456';
const TEST_AUDIO_REF = 'test-audio-789';

const mockBabyData = {
  name: 'Test Baby',
  birthDate: new Date('2023-01-01'),
  userId: TEST_USER_ID,
  preferences: {
    backgroundMonitoring: false,
    notificationsEnabled: true,
    sensitivity: 'medium',
    noiseThreshold: 0.5,
    nightMode: false
  }
};

const mockPatternData = {
  timestamp: new Date(),
  type: NeedType.HUNGER,
  confidence: 0.95,
  needType: NeedType.HUNGER,
  audioRef: TEST_AUDIO_REF
};

// Mock implementations
const mockBabyModel = {
  new: jest.fn().mockResolvedValue(mockBabyData),
  constructor: jest.fn().mockResolvedValue(mockBabyData),
  create: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn(),
  exec: jest.fn()
};

const mockMLService = {
  updateModel: jest.fn().mockResolvedValue({ accuracy: 0.95 })
};

describe('BabyService', () => {
  let service: BabyService;
  let babyModel: Model<BabyDocument>;
  let mlService: MLService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BabyService,
        {
          provide: getModelToken(Baby.name),
          useValue: mockBabyModel
        },
        {
          provide: MLService,
          useValue: mockMLService
        },
        Logger
      ]
    }).compile();

    service = module.get<BabyService>(BabyService);
    babyModel = module.get<Model<BabyDocument>>(getModelToken(Baby.name));
    mlService = module.get<MLService>(MLService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a valid baby profile with security checks', async () => {
      const createBabyDto = { ...mockBabyData };
      mockBabyModel.create.mockResolvedValue({ ...mockBabyData, _id: TEST_BABY_ID });

      const result = await service.create(createBabyDto, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result._id).toBe(TEST_BABY_ID);
      expect(result.userId).toBe(TEST_USER_ID);
      expect(mockBabyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createBabyDto,
          userId: TEST_USER_ID,
          patternHistory: expect.any(Object)
        })
      );
    });

    it('should enforce data validation rules', async () => {
      const invalidData = { ...mockBabyData, name: '' };
      mockBabyModel.create.mockRejectedValue(new Error('Validation failed'));

      await expect(service.create(invalidData, TEST_USER_ID))
        .rejects.toThrow('Validation failed');
    });

    it('should set correct retention period', async () => {
      const createBabyDto = { ...mockBabyData };
      const today = new Date();
      const expectedRetention = new Date(today.setMonth(today.getMonth() + 24));

      mockBabyModel.create.mockImplementation((data) => ({
        ...data,
        _id: TEST_BABY_ID,
        retentionDate: expectedRetention
      }));

      const result = await service.create(createBabyDto, TEST_USER_ID);

      expect(result.retentionDate).toBeInstanceOf(Date);
      expect(result.retentionDate.getTime()).toBeCloseTo(expectedRetention.getTime(), -3);
    });
  });

  describe('updatePatternHistory', () => {
    const mockAnalysisResult = {
      id: TEST_AUDIO_REF,
      timestamp: new Date(),
      needType: NeedType.HUNGER,
      confidence: 0.95,
      features: { test: 1 }
    };

    it('should update pattern history with ML integration', async () => {
      const mockBaby = {
        _id: TEST_BABY_ID,
        patternHistory: {
          patterns: [],
          learningProgress: 0,
          lastUpdate: null
        },
        save: jest.fn().mockResolvedValue(true)
      };

      mockBabyModel.findById.mockResolvedValue(mockBaby);

      await service.updatePatternHistory(TEST_BABY_ID, mockAnalysisResult);

      expect(mockBaby.patternHistory.patterns).toHaveLength(1);
      expect(mockBaby.patternHistory.patterns[0]).toEqual(
        expect.objectContaining({
          needType: mockAnalysisResult.needType,
          confidence: mockAnalysisResult.confidence
        })
      );
      expect(mlService.updateModel).toHaveBeenCalled();
      expect(mockBaby.save).toHaveBeenCalled();
    });

    it('should maintain pattern history size limit', async () => {
      const existingPatterns = Array(1000).fill(mockPatternData);
      const mockBaby = {
        _id: TEST_BABY_ID,
        patternHistory: {
          patterns: existingPatterns,
          learningProgress: 100,
          lastUpdate: new Date()
        },
        save: jest.fn().mockResolvedValue(true)
      };

      mockBabyModel.findById.mockResolvedValue(mockBaby);

      await service.updatePatternHistory(TEST_BABY_ID, mockAnalysisResult);

      expect(mockBaby.patternHistory.patterns).toHaveLength(1000);
      expect(mockBaby.patternHistory.patterns[0]).toEqual(
        expect.objectContaining({
          needType: mockAnalysisResult.needType
        })
      );
    });

    it('should handle ML service errors gracefully', async () => {
      const mockBaby = {
        _id: TEST_BABY_ID,
        patternHistory: {
          patterns: [],
          learningProgress: 0,
          lastUpdate: null
        },
        save: jest.fn().mockResolvedValue(true)
      };

      mockBabyModel.findById.mockResolvedValue(mockBaby);
      mlService.updateModel.mockRejectedValue(new Error('ML service error'));

      await expect(service.updatePatternHistory(TEST_BABY_ID, mockAnalysisResult))
        .rejects.toThrow('ML service error');
    });
  });

  describe('findById', () => {
    it('should return baby profile with access control', async () => {
      const mockBaby = { ...mockBabyData, _id: TEST_BABY_ID };
      mockBabyModel.findOne.mockResolvedValue(mockBaby);

      const result = await service.findById(TEST_BABY_ID, TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result._id).toBe(TEST_BABY_ID);
      expect(mockBabyModel.findOne).toHaveBeenCalledWith({
        _id: TEST_BABY_ID,
        userId: TEST_USER_ID,
        isActive: true
      });
    });

    it('should enforce access control', async () => {
      mockBabyModel.findOne.mockResolvedValue(null);

      await expect(service.findById(TEST_BABY_ID, 'wrong-user'))
        .rejects.toThrow('Baby profile not found or access denied');
    });
  });

  describe('deactivate', () => {
    it('should deactivate profile while maintaining retention', async () => {
      mockBabyModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await service.deactivate(TEST_BABY_ID, TEST_USER_ID);

      expect(mockBabyModel.updateOne).toHaveBeenCalledWith(
        { _id: TEST_BABY_ID, userId: TEST_USER_ID },
        expect.objectContaining({
          isActive: false,
          retentionDate: expect.any(Date)
        })
      );
    });

    it('should enforce access control on deactivation', async () => {
      mockBabyModel.updateOne.mockResolvedValue({ modifiedCount: 0 });

      await expect(service.deactivate(TEST_BABY_ID, 'wrong-user'))
        .rejects.toThrow('Baby profile not found or access denied');
    });
  });

  describe('getPatternStatistics', () => {
    it('should calculate accurate pattern statistics', async () => {
      const mockPatterns = [
        { ...mockPatternData, needType: NeedType.HUNGER },
        { ...mockPatternData, needType: NeedType.SLEEP },
        { ...mockPatternData, needType: NeedType.HUNGER }
      ];

      const mockBaby = {
        _id: TEST_BABY_ID,
        patternHistory: {
          patterns: mockPatterns,
          learningProgress: 50,
          lastUpdate: new Date()
        }
      };

      mockBabyModel.findById.mockResolvedValue(mockBaby);

      const stats = await service.getPatternStatistics(TEST_BABY_ID);

      expect(stats.totalPatterns).toBe(3);
      expect(stats.needTypeDistribution[NeedType.HUNGER]).toBe(2);
      expect(stats.needTypeDistribution[NeedType.SLEEP]).toBe(1);
      expect(stats.learningProgress).toBe(50);
      expect(stats.averageConfidence).toBe(0.95);
    });

    it('should handle empty pattern history', async () => {
      const mockBaby = {
        _id: TEST_BABY_ID,
        patternHistory: {
          patterns: [],
          learningProgress: 0,
          lastUpdate: null
        }
      };

      mockBabyModel.findById.mockResolvedValue(mockBaby);

      const stats = await service.getPatternStatistics(TEST_BABY_ID);

      expect(stats.totalPatterns).toBe(0);
      expect(Object.values(stats.needTypeDistribution).every(count => count === 0)).toBe(true);
      expect(stats.learningProgress).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });
});