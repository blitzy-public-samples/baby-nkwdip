import { Module } from '@nestjs/common'; // v9.0.0
import { MongooseModule } from '@nestjs/mongoose'; // v9.0.0
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { MLModule } from '../ml/ml.module';
import { Analysis, AnalysisSchema } from './schemas/analysis.schema';

/**
 * AnalysisModule configures and provides the core analysis functionality for the Baby Cry Analyzer system.
 * Integrates audio processing, ML services, and database operations to achieve:
 * - >90% cry classification accuracy through optimized ML integration
 * - <2 weeks pattern learning speed via enhanced MongoDB schema configuration
 * - Real-time audio processing with background noise filtering
 * 
 * Key components:
 * - AnalysisController: Handles HTTP/WebSocket endpoints for analysis operations
 * - AnalysisService: Core service for audio analysis and ML integration
 * - MLModule: Machine learning capabilities for pattern recognition
 * - MongoDB: Optimized schema for analysis data persistence
 */
@Module({
    imports: [
        // Configure MongoDB connection with performance optimizations
        MongooseModule.forFeature([
            {
                name: Analysis.name,
                schema: AnalysisSchema,
                collection: 'analyses'
            }
        ], {
            connectionName: 'analysis',
            connectionOptions: {
                // Enable read/write concern for data consistency
                readConcern: { level: 'majority' },
                writeConcern: { w: 'majority' },
                // Optimize query performance
                maxPoolSize: 100,
                minPoolSize: 10,
                // Enable retryable writes for reliability
                retryWrites: true,
                // Set reasonable timeouts
                connectTimeoutMS: 30000,
                socketTimeoutMS: 45000
            }
        }),
        
        // Import ML module for pattern recognition
        MLModule
    ],
    
    controllers: [
        // Register analysis controller for HTTP/WebSocket endpoints
        AnalysisController
    ],
    
    providers: [
        // Register analysis service with dependency injection
        AnalysisService
    ],
    
    exports: [
        // Export analysis service for use in other modules
        AnalysisService
    ]
})
export class AnalysisModule {}