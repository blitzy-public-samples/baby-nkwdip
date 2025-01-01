import { Test, TestingModule } from '@nestjs/testing'; // v9.0.0
import { getModelToken } from '@nestjs/mongoose'; // v9.0.0
import { Model } from 'mongoose'; // v6.0.0
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // v1.0.0
import { AnalysisService } from '../analysis.service';
import { MLService } from '../../ml/ml.service';
import { NeedType, IAnalysisResult, IAnalysisDocument } from '../interfaces/analysis.interface';

describe('AnalysisService', () => {
    let service: AnalysisService;
    let mockMLService: jest.Mocked<MLService>;
    let mockAnalysisModel: jest.Mocked<Model<IAnalysisDocument>>;
    let mockCacheManager: jest.Mocked<any>;

    // Mock audio data for testing
    const mockAudioData = {
        data: new Float32Array(1024),
        sampleRate: 44100,
        babyId: 'test-baby-id'
    };

    // Mock analysis result
    const mockAnalysisResult: IAnalysisResult = {
        id: 'test-analysis-id',
        babyId: 'test-baby-id',
        needType: NeedType.HUNGER,
        confidence: 0.95,
        features: {
            amplitude: -20,
            frequency: 350,
            duration: 2.5,
            pattern: 'TEST-PATTERN',
            noiseLevel: 30,
            signalToNoise: 15,
            harmonics: [440, 880],
            energyDistribution: { 'band1': 0.5 }
        },
        timestamp: new Date(),
        environmentalFactors: {},
        modelVersion: '1.0.0',
        processingDuration: 150
    };

    beforeEach(async () => {
        // Initialize mocks
        mockMLService = {
            analyzeCry: jest.fn(),
            getConfidenceScore: jest.fn(),
            filterBackgroundNoise: jest.fn()
        } as any;

        mockAnalysisModel = {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            countDocuments: jest.fn(),
            db: {
                collection: jest.fn().mockReturnValue({
                    stats: jest.fn().mockResolvedValue({})
                })
            }
        } as any;

        mockCacheManager = {
            get: jest.fn(),
            set: jest.fn(),
            reset: jest.fn()
        };

        // Create testing module
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AnalysisService,
                {
                    provide: MLService,
                    useValue: mockMLService
                },
                {
                    provide: getModelToken('Analysis'),
                    useValue: mockAnalysisModel
                },
                {
                    provide: CACHE_MANAGER,
                    useValue: mockCacheManager
                }
            ]
        }).compile();

        service = module.get<AnalysisService>(AnalysisService);
    });

    describe('analyzeAudio', () => {
        it('should successfully analyze audio with high confidence', async () => {
            // Arrange
            mockMLService.analyzeCry.mockResolvedValue({
                needType: NeedType.HUNGER,
                confidence: 0.95,
                features: mockAnalysisResult.features,
                modelVersion: '1.0.0',
                latency: 150
            });
            mockAnalysisModel.create.mockResolvedValue(mockAnalysisResult);
            mockCacheManager.get.mockResolvedValue(null);

            // Act
            const result = await service.analyzeAudio(mockAudioData);

            // Assert
            expect(result).toBeDefined();
            expect(result.needType).toBe(NeedType.HUNGER);
            expect(result.confidence).toBeGreaterThanOrEqual(0.90);
            expect(mockMLService.analyzeCry).toHaveBeenCalledWith(
                mockAudioData.data,
                mockAudioData.sampleRate
            );
            expect(mockCacheManager.set).toHaveBeenCalled();
        });

        it('should handle background noise effectively', async () => {
            // Arrange
            const noisyAudio = {
                ...mockAudioData,
                data: new Float32Array(Array(1024).fill(0.5))
            };
            mockMLService.analyzeCry.mockResolvedValue({
                needType: NeedType.HUNGER,
                confidence: 0.92,
                features: {
                    ...mockAnalysisResult.features,
                    noiseLevel: 45,
                    signalToNoise: 10
                },
                modelVersion: '1.0.0',
                latency: 180
            });

            // Act
            const result = await service.analyzeAudio(noisyAudio);

            // Assert
            expect(result).toBeDefined();
            expect(result.features.noiseLevel).toBeDefined();
            expect(result.features.signalToNoise).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0.90);
        });

        it('should return cached result when available', async () => {
            // Arrange
            mockCacheManager.get.mockResolvedValue(mockAnalysisResult);

            // Act
            const result = await service.analyzeAudio(mockAudioData);

            // Assert
            expect(result).toEqual(mockAnalysisResult);
            expect(mockMLService.analyzeCry).not.toHaveBeenCalled();
        });

        it('should handle invalid audio data', async () => {
            // Arrange
            const invalidAudio = {
                ...mockAudioData,
                data: null
            };

            // Act & Assert
            await expect(service.analyzeAudio(invalidAudio))
                .rejects
                .toThrow('Invalid audio data format');
        });
    });

    describe('getAnalysisHistory', () => {
        it('should retrieve paginated analysis history', async () => {
            // Arrange
            const mockResults = [mockAnalysisResult];
            mockAnalysisModel.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(mockResults)
            });
            mockAnalysisModel.countDocuments.mockResolvedValue(1);

            // Act
            const result = await service.getAnalysisHistory('test-baby-id', {
                page: 1,
                limit: 10
            });

            // Assert
            expect(result.results).toEqual(mockResults);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(mockAnalysisModel.find).toHaveBeenCalled();
        });

        it('should apply correct filters', async () => {
            // Arrange
            const filters = {
                page: 1,
                limit: 10,
                startDate: new Date('2023-01-01'),
                endDate: new Date('2023-12-31'),
                needType: NeedType.HUNGER,
                minConfidence: 0.9
            };

            mockAnalysisModel.find.mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockAnalysisResult])
            });

            // Act
            await service.getAnalysisHistory('test-baby-id', filters);

            // Assert
            expect(mockAnalysisModel.find).toHaveBeenCalledWith(expect.objectContaining({
                babyId: 'test-baby-id',
                needType: NeedType.HUNGER,
                confidence: { $gte: 0.9 },
                timestamp: {
                    $gte: filters.startDate,
                    $lte: filters.endDate
                }
            }));
        });
    });

    describe('deleteAnalysis', () => {
        it('should successfully delete analysis', async () => {
            // Arrange
            const analysisId = 'test-analysis-id';
            mockAnalysisModel.findOne.mockReturnValue({
                deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
            });

            // Act
            await service.deleteAnalysis(analysisId);

            // Assert
            expect(mockAnalysisModel.findOne).toHaveBeenCalledWith({ id: analysisId });
        });

        it('should handle non-existent analysis', async () => {
            // Arrange
            mockAnalysisModel.findOne.mockResolvedValue(null);

            // Act & Assert
            await expect(service.deleteAnalysis('non-existent-id'))
                .rejects
                .toThrow('Analysis not found');
        });
    });

    describe('batchAnalyzeAudio', () => {
        it('should process multiple audio samples efficiently', async () => {
            // Arrange
            const audioSamples = [mockAudioData, mockAudioData];
            mockMLService.analyzeCry.mockResolvedValue({
                needType: NeedType.HUNGER,
                confidence: 0.95,
                features: mockAnalysisResult.features,
                modelVersion: '1.0.0',
                latency: 150
            });

            // Act
            const results = await service.batchAnalyzeAudio(audioSamples);

            // Assert
            expect(results).toHaveLength(2);
            expect(mockMLService.analyzeCry).toHaveBeenCalledTimes(2);
            results.forEach(result => {
                expect(result.confidence).toBeGreaterThanOrEqual(0.90);
            });
        });
    });
});