/**
 * AWS S3 configuration for Baby Cry Analyzer application
 * Manages secure audio file and ML model storage with encryption and retention policies
 * @version 1.0.0
 */

import { config } from '@nestjs/config'; // v9.0.0
import { ConfigService } from '@nestjs/config'; // v9.0.0
import { S3Config } from '../interfaces/config.interface';

// Global constants for S3 configuration
export const DEFAULT_REGION = 'us-east-1';
export const BUCKET_PREFIX = 'baby-cry-analyzer-';
export const ALLOWED_REGIONS = ['us-east-1', 'us-west-2', 'eu-central-1'];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['audio/wav', 'audio/mp3', 'audio/m4a'];

/**
 * Retrieves and validates S3 configuration with security and retention policies
 * @returns {S3Config} Complete S3 configuration object
 * @throws {Error} If required configuration is missing or invalid
 */
export function getS3Config(): S3Config {
  const configService = new ConfigService();
  const environment = configService.get<string>('NODE_ENV') || 'development';

  // Validate and get AWS credentials
  const accessKeyId = configService.get<string>('AWS_ACCESS_KEY_ID');
  const secretAccessKey = configService.get<string>('AWS_SECRET_ACCESS_KEY');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are required');
  }

  // Validate and get region
  const region = configService.get<string>('AWS_REGION') || DEFAULT_REGION;
  if (!ALLOWED_REGIONS.includes(region)) {
    throw new Error(`Invalid AWS region. Allowed regions: ${ALLOWED_REGIONS.join(', ')}`);
  }

  // Generate environment-specific bucket name
  const bucketName = `${BUCKET_PREFIX}${environment}`;

  // Complete S3 configuration object
  const s3Config: S3Config & {
    encryption: any;
    lifecycle: any;
    cors: any;
    limits: any;
  } = {
    bucketName,
    region,
    accessKeyId,
    secretAccessKey,

    // Server-side encryption configuration using AES-256
    encryption: {
      enabled: true,
      algorithm: 'AES256',
      kmsKeyId: configService.get<string>('AWS_KMS_KEY_ID'),
      enforceEncryption: true,
    },

    // Lifecycle rules for data retention
    lifecycle: {
      enabled: true,
      rules: [
        {
          // Standard audio files retention (90 days)
          prefix: 'audio/',
          enabled: true,
          expiration: {
            days: 90,
          },
          transitions: [
            {
              days: 30,
              storageClass: 'STANDARD_IA',
            },
          ],
        },
        {
          // ML models retention (keep latest 3 versions)
          prefix: 'models/',
          enabled: true,
          noncurrentVersionExpiration: {
            noncurrentDays: 90,
          },
          noncurrentVersionTransitions: [
            {
              noncurrentDays: 30,
              storageClass: 'STANDARD_IA',
            },
          ],
        },
      ],
    },

    // CORS configuration for secure access
    cors: {
      enabled: true,
      rules: [
        {
          allowedMethods: ['GET', 'PUT', 'POST'],
          allowedOrigins: configService.get<string[]>('CORS_ORIGINS', []),
          allowedHeaders: ['*'],
          maxAgeSeconds: 3600,
        },
      ],
    },

    // Upload limits and file type restrictions
    limits: {
      maxFileSize: MAX_FILE_SIZE,
      allowedFileTypes: ALLOWED_FILE_TYPES,
      maxConcurrentUploads: 5,
      multipartUploadThreshold: 5 * 1024 * 1024, // 5MB
      multipartUploadSize: 5 * 1024 * 1024, // 5MB
    },
  };

  return s3Config;
}

// Export default configuration
export const s3Config = getS3Config();