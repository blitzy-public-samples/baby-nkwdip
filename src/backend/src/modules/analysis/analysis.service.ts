import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common'; // v9.0.0
import { InjectModel } from '@nestjs/mongoose'; // v9.0.0
import { Model, FilterQuery } from 'mongoose'; // v6.0.0
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // v1.0.0
import { Cache } from 'cache-manager';
import { NeedType, IAnalysisFeatures, IAnalysisResult, IAnalysisDocument } from './interfaces/analysis.interface';
import { MLService } from '../ml/ml.service';

// Constants for service configuration
const CACHE_TTL = 3600; // 1 hour in seconds
const MIN_CONFIDENCE_THRESHOLD = 0.90; // 90% minimum confidence requirement
const MAX_PROCESSING_TIME = 5000; // 5 seconds maximum processing time
const BATCH_SIZE = 32;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

@Injectable()
export class AnalysisService {
    private readonly logger = new Logger(AnalysisService.name);
    private readonly performanceMetrics: {
        totalAnalyses: number;
        avgProcessingTime: number;
        successRate: number;
        lastUpdateTime: number;
    };

    constructor(
        @InjectModel('Analysis') private readonly analysisModel: Model<IAnalysisDocument>,
        private readonly mlService: MLService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
    ) {
        this.performanceMetrics = {
            totalAnalyses: 0,
            avgProcessingTime: 0,
            successRate: 0,
            lastUpdateTime: Date.now()
        };
        this.initializeService();
    }

    /**
     * Analyzes baby cry audio with real-time processing and caching
     */
    async analyzeAudio(audioData: {
        data: Float32Array;
        sampleRate: number;
        babyId: string;
    }): Promise<IAnalysisResult> {
        const startTime = performance.now();

        try {
            // Input validation
            this.validateInput(audioData);

            // Check cache
            const cacheKey = await this.generateCacheKey(audioData.data);
            const cachedResult = await this.cacheManager.get<IAnalysisResult>(cacheKey);
            if (cachedResult) {
                this.logger.debug('Cache hit for analysis');
                return cachedResult;
            }

            // Process audio with retry mechanism
            const analysisResult = await this.processAudioWithRetry(audioData);

            // Validate confidence threshold
            if (analysisResult.confidence < MIN_CONFIDENCE_THRESHOLD) {
                this.logger.warn('Analysis confidence below threshold', {
                    confidence: analysisResult.confidence,
                    threshold: MIN_CONFIDENCE_THRESHOLD
                });
            }

            // Store result in database
            const savedAnalysis = await this.saveAnalysis(analysisResult);

            // Cache result
            await this.cacheManager.set(cacheKey, savedAnalysis, CACHE_TTL);

            // Update performance metrics
            this.updatePerformanceMetrics(performance.now() - startTime, true);

            return savedAnalysis;

        } catch (error) {
            this.updatePerformanceMetrics(performance.now() - startTime, false);
            this.logger.error('Audio analysis failed', {
                error,
                babyId: audioData.babyId,
                sampleRate: audioData.sampleRate
            });
            throw new HttpException(
                'Audio analysis failed',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Retrieves analysis history with pagination and filtering
     */
    async getAnalysisHistory(
        babyId: string,
        options: {
            page: number;
            limit: number;
            startDate?: Date;
            endDate?: Date;
            needType?: NeedType;
            minConfidence?: number;
        }
    ): Promise<{
        results: IAnalysisResult[];
        total: number;
        page: number;
        pages: number;
    }> {
        try {
            const query: FilterQuery<IAnalysisDocument> = { babyId };

            // Apply filters
            if (options.startDate || options.endDate) {
                query.timestamp = {};
                if (options.startDate) query.timestamp.$gte = options.startDate;
                if (options.endDate) query.timestamp.$lte = options.endDate;
            }
            if (options.needType) query.needType = options.needType;
            if (options.minConfidence) query.confidence = { $gte: options.minConfidence };

            // Execute query with pagination
            const total = await this.analysisModel.countDocuments(query);
            const pages = Math.ceil(total / options.limit);
            const results = await this.analysisModel
                .find(query)
                .sort({ timestamp: -1 })
                .skip((options.page - 1) * options.limit)
                .limit(options.limit)
                .exec();

            return {
                results,
                total,
                page: options.page,
                pages
            };

        } catch (error) {
            this.logger.error('Failed to retrieve analysis history', {
                error,
                babyId,
                options
            });
            throw new HttpException(
                'Failed to retrieve analysis history',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Retrieves analysis metrics and statistics
     */
    async getAnalysisMetrics(babyId: string): Promise<{
        totalAnalyses: number;
        avgConfidence: number;
        needTypeDistribution: Record<NeedType, number>;
        processingMetrics: typeof this.performanceMetrics;
    }> {
        try {
            const analyses = await this.analysisModel
                .find({ babyId })
                .select('needType confidence')
                .exec();

            const needTypeDistribution = analyses.reduce((acc, analysis) => {
                acc[analysis.needType] = (acc[analysis.needType] || 0) + 1;
                return acc;
            }, {} as Record<NeedType, number>);

            const avgConfidence = analyses.reduce((sum, analysis) => 
                sum + analysis.confidence, 0) / analyses.length;

            return {
                totalAnalyses: analyses.length,
                avgConfidence,
                needTypeDistribution,
                processingMetrics: this.performanceMetrics
            };

        } catch (error) {
            this.logger.error('Failed to retrieve analysis metrics', {
                error,
                babyId
            });
            throw new HttpException(
                'Failed to retrieve analysis metrics',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Initializes the analysis service
     */
    private async initializeService(): Promise<void> {
        try {
            // Validate database connection
            await this.analysisModel.db.collection('analyses').stats();
            
            // Initialize cache
            await this.cacheManager.reset();

            this.logger.log('Analysis service initialized successfully');

        } catch (error) {
            this.logger.error('Service initialization failed', { error });
            throw error;
        }
    }

    /**
     * Processes audio with retry mechanism
     */
    private async processAudioWithRetry(audioData: {
        data: Float32Array;
        sampleRate: number;
        babyId: string;
    }): Promise<IAnalysisResult> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
            try {
                const result = await this.mlService.analyzeCry(
                    audioData.data,
                    audioData.sampleRate
                );

                return {
                    id: crypto.randomUUID(),
                    babyId: audioData.babyId,
                    needType: result.needType,
                    confidence: result.confidence,
                    features: result.features as IAnalysisFeatures,
                    timestamp: new Date(),
                    environmentalFactors: {},
                    modelVersion: result.modelVersion,
                    processingDuration: result.latency
                };

            } catch (error) {
                lastError = error;
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                this.logger.warn(`Retry attempt ${attempt} failed`, { error });
            }
        }

        throw lastError || new Error('All retry attempts failed');
    }

    /**
     * Validates input parameters
     */
    private validateInput(audioData: {
        data: Float32Array;
        sampleRate: number;
        babyId: string;
    }): void {
        if (!audioData.data || !(audioData.data instanceof Float32Array)) {
            throw new HttpException(
                'Invalid audio data format',
                HttpStatus.BAD_REQUEST
            );
        }
        if (!audioData.sampleRate || audioData.sampleRate <= 0) {
            throw new HttpException(
                'Invalid sample rate',
                HttpStatus.BAD_REQUEST
            );
        }
        if (!audioData.babyId) {
            throw new HttpException(
                'Baby ID is required',
                HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Generates cache key for audio data
     */
    private async generateCacheKey(data: Float32Array): Promise<string> {
        const buffer = await crypto.subtle.digest(
            'SHA-256',
            data.buffer
        );
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Saves analysis result to database
     */
    private async saveAnalysis(analysis: IAnalysisResult): Promise<IAnalysisResult> {
        const newAnalysis = new this.analysisModel(analysis);
        return await newAnalysis.save();
    }

    /**
     * Updates performance metrics
     */
    private updatePerformanceMetrics(processingTime: number, success: boolean): void {
        this.performanceMetrics.totalAnalyses++;
        this.performanceMetrics.avgProcessingTime = (
            this.performanceMetrics.avgProcessingTime * (this.performanceMetrics.totalAnalyses - 1) +
            processingTime
        ) / this.performanceMetrics.totalAnalyses;
        this.performanceMetrics.successRate = (
            this.performanceMetrics.successRate * (this.performanceMetrics.totalAnalyses - 1) +
            (success ? 1 : 0)
        ) / this.performanceMetrics.totalAnalyses;
        this.performanceMetrics.lastUpdateTime = Date.now();
    }
}