// @package mongoose ^6.0.0
import { Document } from 'mongoose';

/**
 * Standardized classification types for baby cry analysis results
 */
export enum NeedType {
    HUNGER = 'HUNGER',
    SLEEP = 'SLEEP',
    PAIN = 'PAIN',
    DISCOMFORT = 'DISCOMFORT'
}

/**
 * Comprehensive interface defining extracted audio analysis features
 * with precise numeric typing for signal processing results
 */
export interface IAnalysisFeatures {
    /** Peak amplitude of the audio signal (dB) */
    amplitude: number;
    
    /** Dominant frequency of the cry (Hz) */
    frequency: number;
    
    /** Total duration of the cry (seconds) */
    duration: number;
    
    /** Identified cry pattern signature */
    pattern: string;
    
    /** Ambient noise level measurement (dB) */
    noiseLevel: number;
    
    /** Signal-to-noise ratio (dB) */
    signalToNoise: number;
    
    /** Array of harmonic frequencies detected (Hz) */
    harmonics: number[];
    
    /** Frequency band energy distribution mapping */
    energyDistribution: Record<string, number>;
}

/**
 * Complete interface for cry analysis results including metadata
 * and processing information with strict typing
 */
export interface IAnalysisResult {
    /** Unique identifier for the analysis result */
    id: string;
    
    /** Reference to the baby profile */
    babyId: string;
    
    /** Classified need type from analysis */
    needType: NeedType;
    
    /** Confidence score of the classification (0-100) */
    confidence: number;
    
    /** Extracted audio features from the analysis */
    features: IAnalysisFeatures;
    
    /** Timestamp of the analysis */
    timestamp: Date;
    
    /** Environmental context during recording */
    environmentalFactors: Record<string, any>;
    
    /** Version of the ML model used for analysis */
    modelVersion: string;
    
    /** Time taken to process the audio (ms) */
    processingDuration: number;
}

/**
 * MongoDB document interface combining Document type and analysis result
 * structure for database operations
 */
export interface IAnalysisDocument extends Document, IAnalysisResult {}