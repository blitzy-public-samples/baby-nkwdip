import { Injectable, Logger } from '@nestjs/common'; // v9.0.0
import { Model } from 'mongoose'; // v6.0.0
import { Baby, BabyDocument } from './schemas/baby.schema';
import { CreateBabyDto } from './dto/create-baby.dto';
import { MLService } from '../ml/ml.service';
import { IAnalysisResult, NeedType } from '../analysis/interfaces/analysis.interface';

@Injectable()
export class BabyService {
    private readonly logger = new Logger(BabyService.name);
    private readonly RETENTION_PERIOD_MONTHS = 24; // 24-month retention policy
    private readonly MAX_PATTERN_HISTORY = 1000;

    constructor(
        private readonly babyModel: Model<BabyDocument>,
        private readonly mlService: MLService,
        private readonly logger: Logger
    ) {
        this.logger.log('Initializing BabyService with enhanced security and ML integration');
    }

    /**
     * Creates a new baby profile with enhanced security and data validation
     * @param createBabyDto Baby creation data transfer object
     * @param userId Associated user ID
     * @returns Created baby document
     */
    async create(createBabyDto: CreateBabyDto, userId: string): Promise<BabyDocument> {
        this.logger.debug('Creating new baby profile', { userId });

        try {
            // Set retention date (24 months from creation)
            const retentionDate = new Date();
            retentionDate.setMonth(retentionDate.getMonth() + this.RETENTION_PERIOD_MONTHS);

            // Create new baby document with enhanced security
            const baby = new this.babyModel({
                ...createBabyDto,
                userId,
                retentionDate,
                patternHistory: {
                    patterns: [],
                    learningProgress: 0,
                    lastUpdate: null
                },
                isActive: true,
                lastAnalysis: null
            });

            // Save baby profile
            const savedBaby = await baby.save();
            this.logger.log('Baby profile created successfully', { babyId: savedBaby._id });

            return savedBaby;
        } catch (error) {
            this.logger.error('Failed to create baby profile', { error, userId });
            throw error;
        }
    }

    /**
     * Updates baby profile with new pattern analysis and ML model integration
     * @param id Baby profile ID
     * @param analysisResult Cry analysis result
     */
    async updatePatternHistory(id: string, analysisResult: IAnalysisResult): Promise<void> {
        this.logger.debug('Updating pattern history', { babyId: id });

        try {
            // Find baby profile
            const baby = await this.babyModel.findById(id);
            if (!baby) {
                throw new Error('Baby profile not found');
            }

            // Create new pattern entry
            const pattern = {
                timestamp: analysisResult.timestamp,
                type: analysisResult.needType,
                confidence: analysisResult.confidence,
                needType: analysisResult.needType,
                audioRef: analysisResult.id
            };

            // Update pattern history with size limit
            baby.patternHistory.patterns.unshift(pattern);
            if (baby.patternHistory.patterns.length > this.MAX_PATTERN_HISTORY) {
                baby.patternHistory.patterns = baby.patternHistory.patterns.slice(0, this.MAX_PATTERN_HISTORY);
            }

            // Update learning progress and timestamps
            baby.patternHistory.lastUpdate = new Date();
            baby.patternHistory.learningProgress = Math.min(
                (baby.patternHistory.patterns.length / 100) * 10,
                100
            );
            baby.lastAnalysis = analysisResult.timestamp;

            // Update ML model with new pattern data
            await this.mlService.updateModel(
                [analysisResult.features],
                [analysisResult.needType as NeedType]
            );

            // Save changes
            await baby.save();
            this.logger.log('Pattern history updated successfully', { babyId: id });

        } catch (error) {
            this.logger.error('Failed to update pattern history', { error, babyId: id });
            throw error;
        }
    }

    /**
     * Retrieves baby profile with security checks
     * @param id Baby profile ID
     * @param userId Requesting user ID
     * @returns Baby document
     */
    async findById(id: string, userId: string): Promise<BabyDocument> {
        this.logger.debug('Retrieving baby profile', { babyId: id, userId });

        const baby = await this.babyModel.findOne({ _id: id, userId, isActive: true });
        if (!baby) {
            throw new Error('Baby profile not found or access denied');
        }

        return baby;
    }

    /**
     * Updates baby monitoring preferences
     * @param id Baby profile ID
     * @param preferences Updated preferences
     * @returns Updated baby document
     */
    async updatePreferences(
        id: string,
        preferences: Partial<Baby['preferences']>
    ): Promise<BabyDocument> {
        this.logger.debug('Updating monitoring preferences', { babyId: id });

        try {
            const baby = await this.babyModel.findById(id);
            if (!baby) {
                throw new Error('Baby profile not found');
            }

            // Update preferences with validation
            baby.preferences = {
                ...baby.preferences,
                ...preferences,
                sensitivity: preferences.sensitivity || baby.preferences.sensitivity,
                noiseThreshold: Math.max(0, Math.min(1, preferences.noiseThreshold || baby.preferences.noiseThreshold))
            };

            await baby.save();
            this.logger.log('Preferences updated successfully', { babyId: id });

            return baby;
        } catch (error) {
            this.logger.error('Failed to update preferences', { error, babyId: id });
            throw error;
        }
    }

    /**
     * Deactivates baby profile while maintaining data retention policy
     * @param id Baby profile ID
     * @param userId Requesting user ID
     */
    async deactivate(id: string, userId: string): Promise<void> {
        this.logger.debug('Deactivating baby profile', { babyId: id, userId });

        try {
            const result = await this.babyModel.updateOne(
                { _id: id, userId },
                { 
                    isActive: false,
                    retentionDate: new Date(Date.now() + this.RETENTION_PERIOD_MONTHS * 30 * 24 * 60 * 60 * 1000)
                }
            );

            if (result.modifiedCount === 0) {
                throw new Error('Baby profile not found or access denied');
            }

            this.logger.log('Baby profile deactivated successfully', { babyId: id });
        } catch (error) {
            this.logger.error('Failed to deactivate baby profile', { error, babyId: id });
            throw error;
        }
    }

    /**
     * Retrieves pattern analysis statistics
     * @param id Baby profile ID
     * @returns Pattern analysis statistics
     */
    async getPatternStatistics(id: string): Promise<Record<string, any>> {
        this.logger.debug('Retrieving pattern statistics', { babyId: id });

        try {
            const baby = await this.babyModel.findById(id);
            if (!baby) {
                throw new Error('Baby profile not found');
            }

            const patterns = baby.patternHistory.patterns;
            const needTypeCounts = Object.values(NeedType).reduce((acc, type) => {
                acc[type] = patterns.filter(p => p.needType === type).length;
                return acc;
            }, {} as Record<string, number>);

            return {
                totalPatterns: patterns.length,
                needTypeDistribution: needTypeCounts,
                learningProgress: baby.patternHistory.learningProgress,
                lastUpdate: baby.patternHistory.lastUpdate,
                averageConfidence: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
            };
        } catch (error) {
            this.logger.error('Failed to retrieve pattern statistics', { error, babyId: id });
            throw error;
        }
    }
}