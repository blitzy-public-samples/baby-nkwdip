import { Types } from 'mongoose'; // ^6.0.0

/**
 * Sensitivity level for cry detection and analysis
 */
export type SensitivityLevel = 'low' | 'medium' | 'high';

/**
 * Classification types for baby cries
 */
export type CryType = 'hunger' | 'tired' | 'pain' | 'discomfort' | 'attention' | 'unknown';

/**
 * Distribution of cry patterns across different times of day
 */
export type TimeDistribution = Record<'morning' | 'afternoon' | 'evening' | 'night', number>;

/**
 * Trends analysis for different cry patterns
 */
export type PatternTrends = Record<CryType, { increasing: boolean; percentage: number }>;

/**
 * Interface for tracking pattern progression over time
 */
export interface PatternProgression {
  date: Date;
  patterns: Record<CryType, number>;
  improvement: number;
}

/**
 * Statistics for user responses to cry detections
 */
export interface UserResponseStats {
  averageResponseTime: number;
  responseRate: number;
  feedbackAccuracy: number;
}

/**
 * Detailed audio features extracted from cry analysis
 */
export interface AudioFeatures {
  frequency: number;
  amplitude: number;
  pitch: number;
  intensity: number;
  harmonics: number[];
  spectralCentroid: number;
  mfcc: number[];
  zeroCrossingRate: number;
}

/**
 * Environmental conditions during cry analysis
 */
export interface EnvironmentalFactors {
  noiseLevel: number;
  backgroundNoise: boolean;
  signalQuality: number;
  interferenceLevel: number;
}

/**
 * Comprehensive cry pattern analysis results
 */
export interface CryPattern {
  id: string;
  type: CryType;
  confidence: number;
  timestamp: Date;
  duration: number;
  features: AudioFeatures;
  environmentalFactors: EnvironmentalFactors;
  responseTime: number | null;
  userFeedback: boolean | null;
}

/**
 * Historical pattern analysis data
 */
export interface PatternHistory {
  patterns: CryPattern[];
  lastUpdated: Date;
  totalPatterns: number;
  confidenceAverage: number;
  timeDistribution: TimeDistribution;
  patternTrends: PatternTrends;
}

/**
 * Baby monitoring and notification preferences
 */
export interface BabyPreferences {
  monitoringEnabled: boolean;
  notificationsEnabled: boolean;
  backgroundMonitoring: boolean;
  sensitivity: SensitivityLevel;
  noiseThreshold: number;
  nightMode: boolean;
  recordingDuration: number;
  autoAnalysis: boolean;
}

/**
 * Core baby profile interface with complete data structure
 */
export interface Baby {
  id: string;
  name: string;
  birthDate: Date;
  userId: string;
  preferences: BabyPreferences;
  isActive: boolean;
  lastAnalysis: Date | null;
  patternHistory: PatternHistory | null;
  createdAt: Date;
  updatedAt: Date;
  retentionEndDate: Date;
}

/**
 * Comprehensive analytics data for baby cry analysis
 */
export interface BabyAnalytics {
  totalCries: number;
  patternDistribution: Record<CryType, number>;
  averageConfidence: number;
  timeOfDayDistribution: Record<string, number>;
  responseTime: number;
  accuracyRate: number;
  patternProgression: PatternProgression[];
  userResponses: UserResponseStats;
}