/**
 * @fileoverview Service for managing cry analysis history with retention policies and analytics
 * @version 1.0.0
 */

import dayjs from 'dayjs'; // ^1.11.0
import { ApiService } from './api.service';
import { 
  Baby, 
  PatternHistory, 
  CryPattern, 
  BabyAnalytics, 
  TimeDistribution,
  CryType,
  PatternProgression,
  UserResponseStats
} from '../types/baby.types';
import { AudioAnalysisResult, AudioFeatures } from '../types/audio.types';

// Constants for history management
const RETENTION_PERIOD_DAYS = 90;
const MAX_HISTORY_ITEMS = 1000;
const CLEANUP_BATCH_SIZE = 100;
const CACHE_TTL_MINUTES = 15;

// Types for history service
interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface PaginationOptions {
  page: number;
  limit: number;
}

interface AnalyticsOptions {
  timeframe?: DateRange;
  includeEnvironmentalFactors?: boolean;
  confidenceThreshold?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Service class for managing cry analysis history with retention policies and analytics
 */
export class HistoryService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly retentionPeriodDays: number = RETENTION_PERIOD_DAYS;
  private readonly maxHistoryItems: number = MAX_HISTORY_ITEMS;

  constructor(private apiService: ApiService) {}

  /**
   * Retrieves cry analysis history within retention period with pagination
   */
  public async getHistory(
    babyId: string,
    dateRange?: DateRange,
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<PatternHistory> {
    this.validateDateRange(dateRange);
    const cacheKey = this.generateCacheKey('history', babyId, dateRange, pagination);
    const cachedData = this.getFromCache<PatternHistory>(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      const patterns = await this.fetchHistoryFromApi(babyId, dateRange, pagination);
      const formattedHistory: PatternHistory = {
        patterns: this.formatPatterns(patterns),
        lastUpdated: new Date(),
        totalPatterns: patterns.length,
        confidenceAverage: this.calculateConfidenceAverage(patterns),
        timeDistribution: this.calculateTimeDistribution(patterns),
        patternTrends: this.calculatePatternTrends(patterns)
      };

      this.setCache(cacheKey, formattedHistory);
      return formattedHistory;
    } catch (error) {
      console.error('Error fetching history:', error);
      throw new Error('Failed to retrieve cry analysis history');
    }
  }

  /**
   * Generates comprehensive analytics and insights from cry history
   */
  public async getAnalytics(
    babyId: string,
    options: AnalyticsOptions = {}
  ): Promise<BabyAnalytics> {
    const cacheKey = this.generateCacheKey('analytics', babyId, options);
    const cachedAnalytics = this.getFromCache<BabyAnalytics>(cacheKey);

    if (cachedAnalytics) {
      return cachedAnalytics;
    }

    try {
      const history = await this.getHistory(babyId, options.timeframe);
      const analytics: BabyAnalytics = {
        totalCries: history.patterns.length,
        patternDistribution: this.calculatePatternDistribution(history.patterns, options.confidenceThreshold),
        averageConfidence: history.confidenceAverage,
        timeOfDayDistribution: this.calculateDetailedTimeDistribution(history.patterns),
        responseTime: this.calculateAverageResponseTime(history.patterns),
        accuracyRate: this.calculateAccuracyRate(history.patterns),
        patternProgression: this.calculatePatternProgression(history.patterns),
        userResponses: this.calculateUserResponseStats(history.patterns)
      };

      this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error generating analytics:', error);
      throw new Error('Failed to generate cry analysis analytics');
    }
  }

  /**
   * Removes history entries older than retention period with batch processing
   */
  public async cleanupHistory(babyId: string): Promise<void> {
    try {
      const cutoffDate = dayjs().subtract(this.retentionPeriodDays, 'day').toDate();
      let deletedCount = 0;
      let continueDeletion = true;

      while (continueDeletion) {
        const recordsToDelete = await this.findExpiredRecords(babyId, cutoffDate, CLEANUP_BATCH_SIZE);
        
        if (recordsToDelete.length === 0) {
          break;
        }

        await this.apiService.deleteHistoryRecords(babyId, recordsToDelete.map(r => r.id));
        deletedCount += recordsToDelete.length;
        continueDeletion = recordsToDelete.length === CLEANUP_BATCH_SIZE;
      }

      this.clearCache(babyId);
      console.log(`Cleaned up ${deletedCount} expired history records for baby ${babyId}`);
    } catch (error) {
      console.error('Error during history cleanup:', error);
      throw new Error('Failed to cleanup cry analysis history');
    }
  }

  // Private helper methods
  private validateDateRange(dateRange?: DateRange): void {
    if (!dateRange) return;

    const minDate = dayjs().subtract(this.retentionPeriodDays, 'day').toDate();
    if (dateRange.startDate < minDate) {
      throw new Error(`Date range cannot exceed retention period of ${this.retentionPeriodDays} days`);
    }
  }

  private generateCacheKey(...args: any[]): string {
    return args.map(arg => JSON.stringify(arg)).join('-');
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MINUTES * 60 * 1000) {
      return cached.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clearCache(babyId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(babyId)) {
        this.cache.delete(key);
      }
    }
  }

  private async findExpiredRecords(
    babyId: string,
    cutoffDate: Date,
    limit: number
  ): Promise<CryPattern[]> {
    const history = await this.getHistory(babyId);
    return history.patterns.filter(p => p.timestamp < cutoffDate).slice(0, limit);
  }

  private calculatePatternDistribution(
    patterns: CryPattern[],
    confidenceThreshold: number = 0.7
  ): Record<CryType, number> {
    const distribution: Record<CryType, number> = {} as Record<CryType, number>;
    const validPatterns = patterns.filter(p => p.confidence >= confidenceThreshold);

    validPatterns.forEach(pattern => {
      distribution[pattern.type] = (distribution[pattern.type] || 0) + 1;
    });

    return distribution;
  }

  private calculateDetailedTimeDistribution(patterns: CryPattern[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    patterns.forEach(pattern => {
      const hour = dayjs(pattern.timestamp).format('HH');
      distribution[hour] = (distribution[hour] || 0) + 1;
    });
    return distribution;
  }

  private calculatePatternProgression(patterns: CryPattern[]): PatternProgression[] {
    const progression: PatternProgression[] = [];
    const groupedByDate = this.groupPatternsByDate(patterns);

    for (const [date, datePatterns] of groupedByDate) {
      progression.push({
        date: new Date(date),
        patterns: this.calculatePatternDistribution(datePatterns),
        improvement: this.calculateImprovementRate(datePatterns)
      });
    }

    return progression;
  }

  private calculateUserResponseStats(patterns: CryPattern[]): UserResponseStats {
    const responseTimes = patterns
      .filter(p => p.responseTime !== null)
      .map(p => p.responseTime as number);

    return {
      averageResponseTime: responseTimes.length ? 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      responseRate: patterns.filter(p => p.responseTime !== null).length / patterns.length,
      feedbackAccuracy: patterns.filter(p => p.userFeedback === true).length / 
        patterns.filter(p => p.userFeedback !== null).length
    };
  }

  private groupPatternsByDate(patterns: CryPattern[]): Map<string, CryPattern[]> {
    const grouped = new Map<string, CryPattern[]>();
    patterns.forEach(pattern => {
      const date = dayjs(pattern.timestamp).format('YYYY-MM-DD');
      const datePatterns = grouped.get(date) || [];
      datePatterns.push(pattern);
      grouped.set(date, datePatterns);
    });
    return grouped;
  }

  private calculateImprovementRate(patterns: CryPattern[]): number {
    if (patterns.length < 2) return 0;
    const sortedPatterns = [...patterns].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    const firstHalf = sortedPatterns.slice(0, Math.floor(patterns.length / 2));
    const secondHalf = sortedPatterns.slice(Math.floor(patterns.length / 2));
    
    const firstHalfAvgConfidence = this.calculateConfidenceAverage(firstHalf);
    const secondHalfAvgConfidence = this.calculateConfidenceAverage(secondHalf);
    
    return ((secondHalfAvgConfidence - firstHalfAvgConfidence) / firstHalfAvgConfidence) * 100;
  }

  private calculateConfidenceAverage(patterns: CryPattern[]): number {
    return patterns.length ? 
      patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length : 
      0;
  }

  private formatPatterns(patterns: CryPattern[]): CryPattern[] {
    return patterns.map(pattern => ({
      ...pattern,
      timestamp: new Date(pattern.timestamp)
    }));
  }
}