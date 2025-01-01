/**
 * @fileoverview Core environment interface that defines strongly-typed environment variables 
 * used throughout the Baby Cry Analyzer backend application.
 * @version 1.0.0
 */

// @types/node ^18.0.0
import { ProcessEnv } from '@types/node';

/**
 * Comprehensive interface defining all strongly-typed environment variables
 * used throughout the application with strict validation requirements.
 * 
 * @interface Environment
 * @extends ProcessEnv
 */
export interface Environment extends ProcessEnv {
  /**
   * Application environment mode
   * @type {'development' | 'production' | 'test'}
   */
  NODE_ENV: 'development' | 'production' | 'test';

  /**
   * Server port number
   * @type {number}
   */
  PORT: number;

  /**
   * Server host address
   * @type {string}
   */
  HOST: string;

  /**
   * API version string
   * @type {string}
   */
  API_VERSION: string;

  /**
   * MongoDB connection URL
   * @type {string}
   */
  DATABASE_URL: string;

  /**
   * MongoDB database name
   * @type {string}
   */
  DATABASE_NAME: string;

  /**
   * Redis cache server hostname
   * @type {string}
   */
  REDIS_HOST: string;

  /**
   * Redis cache server port
   * @type {number}
   */
  REDIS_PORT: number;

  /**
   * Redis authentication password
   * @type {string}
   */
  REDIS_PASSWORD: string;

  /**
   * AWS region for services
   * @type {string}
   */
  AWS_REGION: string;

  /**
   * AWS access key ID for authentication
   * @type {string}
   */
  AWS_ACCESS_KEY_ID: string;

  /**
   * AWS secret access key for authentication
   * @type {string}
   */
  AWS_SECRET_ACCESS_KEY: string;

  /**
   * S3 bucket name for audio storage
   * @type {string}
   */
  S3_BUCKET_NAME: string;

  /**
   * JWT signing secret
   * @type {string}
   */
  JWT_SECRET: string;

  /**
   * JWT token expiration time
   * @type {string}
   */
  JWT_EXPIRATION: string;

  /**
   * Auth0 domain for authentication
   * @type {string}
   */
  AUTH0_DOMAIN: string;

  /**
   * Auth0 client ID
   * @type {string}
   */
  AUTH0_CLIENT_ID: string;

  /**
   * Auth0 client secret
   * @type {string}
   */
  AUTH0_CLIENT_SECRET: string;

  /**
   * Firebase project ID for push notifications
   * @type {string}
   */
  FIREBASE_PROJECT_ID: string;

  /**
   * Firebase private key for authentication
   * @type {string}
   */
  FIREBASE_PRIVATE_KEY: string;

  /**
   * Firebase client email for authentication
   * @type {string}
   */
  FIREBASE_CLIENT_EMAIL: string;

  /**
   * Application logging level
   * @type {'debug' | 'info' | 'warn' | 'error'}
   */
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  /**
   * CORS allowed origin
   * @type {string}
   */
  CORS_ORIGIN: string;

  /**
   * Maximum file size for audio uploads in bytes
   * @type {number}
   */
  MAX_FILE_SIZE: number;

  /**
   * Number of days to retain audio files
   * @type {number}
   */
  AUDIO_RETENTION_DAYS: number;
}