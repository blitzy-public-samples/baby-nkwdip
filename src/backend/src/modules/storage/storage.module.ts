import { Module } from '@nestjs/common'; // v9.0.0
import { ConfigModule } from '@nestjs/config'; // v9.0.0
import { S3StorageService } from './storage.service';
import { s3Config } from '../../config/s3.config';

/**
 * StorageModule provides secure S3-based file storage capabilities with encryption
 * and multi-region support for the Baby Cry Analyzer application.
 * 
 * Features:
 * - AES-256 encryption for audio data
 * - Multi-region deployment support
 * - Automated key rotation
 * - Access monitoring and logging
 * - Retention policies enforcement
 * - Secure file operations with integrity checks
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [() => s3Config],
      validate: (config) => {
        // Validate required S3 configuration
        if (!config.bucketName || !config.region) {
          throw new Error('Invalid S3 configuration: Missing required fields');
        }

        // Validate encryption settings
        if (!config.encryption?.enabled || !config.encryption?.kmsKeyId) {
          throw new Error('Invalid S3 configuration: Encryption must be enabled with KMS');
        }

        // Validate CORS and lifecycle policies
        if (!config.cors?.enabled || !config.lifecycle?.enabled) {
          throw new Error('Invalid S3 configuration: CORS and lifecycle policies must be enabled');
        }

        return config;
      },
      validationOptions: {
        allowUnknown: true,
        abortEarly: true
      }
    })
  ],
  providers: [
    {
      provide: S3StorageService,
      useFactory: () => {
        // Initialize S3StorageService with validated config
        const storageService = new S3StorageService(s3Config);

        // Add monitoring hooks
        storageService.onModuleInit().catch(error => {
          throw new Error(`Failed to initialize storage service: ${error.message}`);
        });

        return storageService;
      }
    }
  ],
  exports: [S3StorageService]
})
export class StorageModule {}