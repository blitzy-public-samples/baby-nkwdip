/**
 * Core application configuration module for Baby Cry Analyzer backend
 * Manages application settings, security configurations, and environment-specific settings
 * @version 1.0.0
 */

import { config } from 'dotenv'; // ^16.0.0
import { AppConfig } from '../interfaces/config.interface';
import { Environment } from '../interfaces/environment.interface';

// Load environment variables
config();

// Default configuration constants
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const API_PREFIX = '/api/v1';
const DEFAULT_RATE_LIMIT_WINDOW = 900000; // 15 minutes in milliseconds
const DEFAULT_RATE_LIMIT_MAX = 100;
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000'];

/**
 * Validates the application configuration settings
 * @param config - Application configuration object to validate
 * @throws Error if configuration is invalid
 */
const validateConfig = (config: AppConfig): boolean => {
  // Validate port number
  if (config.port && (isNaN(config.port) || config.port < 1 || config.port > 65535)) {
    throw new Error('Invalid port number. Must be between 1 and 65535');
  }

  // Validate environment
  if (!['development', 'staging', 'production'].includes(config.environment)) {
    throw new Error('Invalid environment. Must be development, staging, or production');
  }

  // Validate host
  if (!config.host || typeof config.host !== 'string') {
    throw new Error('Invalid host configuration');
  }

  // Validate rate limiting
  if (config.rateLimit) {
    if (config.rateLimit.windowMs < 0 || config.rateLimit.max < 1) {
      throw new Error('Invalid rate limiting configuration');
    }
  }

  // Validate security settings
  if (!config.security || !config.security.encryptionKey) {
    throw new Error('Missing required security configuration');
  }

  // Validate CORS settings
  if (!Array.isArray(config.cors.origins)) {
    throw new Error('Invalid CORS configuration');
  }

  return true;
};

/**
 * Retrieves and validates application configuration from environment variables
 * @returns Validated AppConfig object
 */
export const getAppConfig = (): AppConfig => {
  const env = process.env as Environment;

  const config: AppConfig = {
    port: parseInt(env.PORT as string, 10) || DEFAULT_PORT,
    host: env.HOST || DEFAULT_HOST,
    apiPrefix: API_PREFIX,
    environment: (env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
    
    // Rate limiting configuration
    rateLimit: {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW as string, 10) || DEFAULT_RATE_LIMIT_WINDOW,
      max: parseInt(env.RATE_LIMIT_MAX as string, 10) || DEFAULT_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Security configuration
    security: {
      encryptionKey: env.ENCRYPTION_KEY,
      trustProxy: env.NODE_ENV === 'production',
      helmet: {
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: true,
        dnsPrefetchControl: true,
        frameguard: true,
        hidePoweredBy: true,
        hsts: true,
        ieNoOpen: true,
        noSniff: true,
        originAgentCluster: true,
        permittedCrossDomainPolicies: true,
        referrerPolicy: true,
        xssFilter: true,
      },
    },

    // CORS configuration
    cors: {
      origins: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : DEFAULT_CORS_ORIGINS,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
      credentials: true,
      maxAge: 86400, // 24 hours
    },
  };

  // Validate the configuration
  validateConfig(config);

  return config;
};

/**
 * Exported application configuration instance
 * @const {AppConfig}
 */
export const appConfig = getAppConfig();