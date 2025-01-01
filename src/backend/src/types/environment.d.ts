import { ProcessEnv as NodeProcessEnv } from '@types/node'; // ^18.0.0

declare global {
  namespace NodeJS {
    interface ProcessEnv extends NodeProcessEnv {
      /**
       * Application environment
       * @default 'development'
       */
      NODE_ENV: 'development' | 'production' | 'test';

      /**
       * Server port number
       * @default 3000
       */
      PORT: number;

      /**
       * Server host address
       * @default 'localhost'
       */
      HOST: string;

      /**
       * API version string
       * @example 'v1'
       */
      API_VERSION: string;

      /**
       * MongoDB connection URL
       * @example 'mongodb://localhost:27017'
       */
      DATABASE_URL: string;

      /**
       * MongoDB database name
       * @example 'baby_cry_analyzer'
       */
      DATABASE_NAME: string;

      /**
       * Redis cache host address
       * @example 'localhost'
       */
      REDIS_HOST: string;

      /**
       * Redis cache port number
       * @default 6379
       */
      REDIS_PORT: number;

      /**
       * Redis authentication password
       */
      REDIS_PASSWORD: string;

      /**
       * AWS region for services
       * @example 'us-east-1'
       */
      AWS_REGION: string;

      /**
       * AWS access key identifier
       */
      AWS_ACCESS_KEY_ID: string;

      /**
       * AWS secret access key
       */
      AWS_SECRET_ACCESS_KEY: string;

      /**
       * S3 bucket name for audio storage
       * @example 'baby-cry-analyzer-audio'
       */
      S3_BUCKET_NAME: string;

      /**
       * JWT signing secret
       */
      JWT_SECRET: string;

      /**
       * JWT token expiration time
       * @example '24h'
       */
      JWT_EXPIRATION: string;

      /**
       * Auth0 domain
       * @example 'your-tenant.auth0.com'
       */
      AUTH0_DOMAIN: string;

      /**
       * Auth0 client identifier
       */
      AUTH0_CLIENT_ID: string;

      /**
       * Auth0 client secret
       */
      AUTH0_CLIENT_SECRET: string;

      /**
       * Firebase project identifier
       */
      FIREBASE_PROJECT_ID: string;

      /**
       * Firebase private key for service account
       */
      FIREBASE_PRIVATE_KEY: string;

      /**
       * Firebase client email for service account
       */
      FIREBASE_CLIENT_EMAIL: string;

      /**
       * Application logging level
       * @default 'info'
       */
      LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

      /**
       * CORS allowed origin
       * @example 'http://localhost:3000'
       */
      CORS_ORIGIN: string;

      /**
       * Maximum file size for audio uploads in bytes
       * @default 5242880 (5MB)
       */
      MAX_FILE_SIZE: number;

      /**
       * Number of days to retain audio files
       * @default 90
       */
      AUDIO_RETENTION_DAYS: number;
    }
  }
}

// Export ProcessEnv interface for external use
export interface ProcessEnv extends NodeJS.ProcessEnv {}