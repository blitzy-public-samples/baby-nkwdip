// @package tensorflow ^2.9.0

import { NeedType } from '../../analysis/interfaces/analysis.interface';

/**
 * Configuration interface for ML model metadata, parameters, and versioning information.
 * Ensures consistent model tracking and deployment across the system.
 */
export interface IModelConfig {
    /** Unique identifier for the model instance */
    modelId: string;

    /** Semantic version of the model */
    version: string;

    /** Neural network architecture description */
    architecture: string;

    /** Model-specific configuration parameters */
    hyperparameters: Record<string, any>;

    /** Last model training completion date */
    lastTrainingDate: Date;

    /** Version of the training dataset used */
    datasetVersion: string;

    /** Minimum confidence threshold for predictions (0-1) */
    minimumConfidence: number;
}

/**
 * Configuration interface for model training parameters and settings.
 * Defines the core parameters used during the training process.
 */
export interface IModelTrainingConfig {
    /** Number of samples per training iteration */
    batchSize: number;

    /** Number of complete passes through the training dataset */
    epochs: number;

    /** Step size for gradient descent optimization */
    learningRate: number;

    /** Fraction of training data used for validation (0-1) */
    validationSplit: number;
}

/**
 * Interface for tracking comprehensive model performance metrics.
 * Supports the >90% classification accuracy requirement through detailed monitoring.
 */
export interface IModelMetrics {
    /** Overall classification accuracy (0-1) */
    accuracy: number;

    /** Precision score for classification (0-1) */
    precision: number;

    /** Recall score for classification (0-1) */
    recall: number;

    /** Harmonic mean of precision and recall (0-1) */
    f1Score: number;

    /** Matrix of predicted vs actual need types */
    confusionMatrix: Record<NeedType, Record<NeedType, number>>;

    /** Area under the ROC curve (0-1) */
    areaUnderCurve: number;

    /** Cross-entropy loss value */
    crossEntropyLoss: number;
}

/**
 * Interface for model prediction results with additional metadata.
 * Provides comprehensive information about each prediction for monitoring and improvement.
 */
export interface IModelPrediction {
    /** Classified need type from the model */
    needType: NeedType;

    /** Prediction confidence score (0-1) */
    confidence: number;

    /** Extracted features used for prediction */
    features: Record<string, number>;

    /** Timestamp of the prediction */
    timestamp: Date;

    /** Version of the model used for prediction */
    modelVersion: string;
}