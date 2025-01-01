/**
 * Advanced database configuration for MongoDB Atlas M40 tier
 * Implements comprehensive connection settings with security, performance optimization,
 * and monitoring capabilities for the Baby Cry Analyzer backend application
 * @version 1.0.0
 */

import { config } from 'dotenv'; // ^16.0.0
import { DatabaseConfig } from '../interfaces/config.interface';
import { Environment } from '../interfaces/environment.interface';

// Initialize environment variables
config();

/**
 * Validates required database environment variables
 * @throws {Error} If required environment variables are missing
 */
const validateEnvironment = (): void => {
  const required = [
    'DATABASE_URL',
    'DATABASE_NAME',
    'DATABASE_SSL_CERT',
    'DATABASE_REPLICA_SET'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Retrieves enhanced database configuration for MongoDB Atlas M40 tier
 * with comprehensive security and performance optimizations
 * @returns {DatabaseConfig} Complete database configuration object
 */
const getDatabaseConfig = (): DatabaseConfig => {
  validateEnvironment();

  return {
    uri: process.env.DATABASE_URL as string,
    name: process.env.DATABASE_NAME as string,
    options: {
      // Connection optimization
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 100, // M40 tier optimal pool size
      minPoolSize: 10,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 20000,
      heartbeatFrequencyMS: 10000,

      // Write concern and consistency
      retryWrites: true,
      w: 'majority',
      journal: true,
      readPreference: 'primaryPreferred',
      readConcern: { level: 'majority' },
      retryReads: true,

      // Security settings
      ssl: true,
      sslValidate: true,
      sslCA: process.env.DATABASE_SSL_CERT,
      authSource: 'admin',
      replicaSet: process.env.DATABASE_REPLICA_SET,

      // Performance optimization
      compressors: ['snappy', 'zlib'],
      zlibCompressionLevel: 6,
      maxStalenessSeconds: 90,
      
      // High availability settings
      directConnection: false,
      loadBalanced: true,
      
      // Monitoring and logging
      monitorCommands: true,
      loggerLevel: 'warn',
      
      // Index management
      autoIndex: true,
      autoCreate: true,

      // Connection pool monitoring
      maxConnecting: 10,
      minHeartbeatFrequencyMS: 500,
      waitQueueTimeoutMS: 15000
    }
  };
};

/**
 * Production-ready database configuration instance
 * Implements MongoDB Atlas M40 tier settings with enhanced security and performance
 */
export const databaseConfig: DatabaseConfig = getDatabaseConfig();

/**
 * Export configuration retrieval function for testing and dynamic reconfiguration
 */
export { getDatabaseConfig };