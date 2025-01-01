import { Module } from '@nestjs/common'; // v9.0.0
import { MLService } from './ml.service';
import { FeatureExtractionService } from './services/feature-extraction.service';
import { ModelTrainingService } from './services/model-training.service';
import { PredictionService } from './services/prediction.service';

/**
 * MLModule configures and provides machine learning services for baby cry analysis.
 * Implements pattern learning algorithms, personalized recommendations, and predictive analytics
 * to achieve >90% cry classification accuracy and <2 weeks pattern learning speed.
 * 
 * Key components:
 * - MLService: Main orchestrator for ML operations
 * - FeatureExtractionService: Audio feature extraction and preprocessing
 * - ModelTrainingService: Model training and optimization
 * - PredictionService: Real-time predictions with GPU acceleration
 */
@Module({
    providers: [
        // Core ML service orchestrating all operations
        MLService,
        
        // Feature extraction service for audio processing
        FeatureExtractionService,
        
        // Model training service for continuous learning
        ModelTrainingService,
        
        // Real-time prediction service with GPU optimization
        PredictionService
    ],
    exports: [
        // Export MLService as the main interface for other modules
        MLService
    ]
})
export class MLModule {}