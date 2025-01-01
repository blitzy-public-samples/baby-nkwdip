/**
 * Redis Configuration Module for Baby Cry Analyzer Backend
 * Configures Redis caching service using Amazon ElastiCache with cluster mode support
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { createHash } from 'crypto';
import { RedisConfig } from '../interfaces/config.interface';

// Load environment variables
config();

// Constants for Redis configuration
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_HOST = '127.0.0.1';
const DEFAULT_CACHE_TTL = 3600; // 1 hour in seconds
const MIN_CACHE_TTL = 60; // Minimum 1 minute
const MAX_CACHE_TTL = 86400; // Maximum 24 hours
const DEFAULT_MEMORY_POLICY = 'volatile-lru';
const CLUSTER_MODE_ENABLED = process.env.REDIS_CLUSTER_MODE === 'true';

/**
 * Validates Redis configuration parameters
 * @param config Redis configuration object
 * @throws Error if configuration is invalid
 */
const validateRedisConfig = (config: RedisConfig): boolean => {
  if (!config.host || !config.port || !config.password) {
    throw new Error('Missing required Redis configuration parameters');
  }

  if (config.port < 1024 || config.port > 65535) {
    throw new Error('Redis port must be between 1024 and 65535');
  }

  if (config.ttl < MIN_CACHE_TTL || config.ttl > MAX_CACHE_TTL) {
    throw new Error(`Cache TTL must be between ${MIN_CACHE_TTL} and ${MAX_CACHE_TTL} seconds`);
  }

  const validMemoryPolicies = ['volatile-lru', 'allkeys-lru', 'volatile-ttl', 'noeviction'];
  if (!validMemoryPolicies.includes(config.memoryPolicy)) {
    throw new Error('Invalid Redis memory policy');
  }

  return true;
};

/**
 * Configures Redis cluster mode settings for ElastiCache
 * @param config Base Redis configuration
 * @returns Enhanced cluster configuration
 */
const configureClusterMode = (config: RedisConfig): Record<string, any> => {
  if (!CLUSTER_MODE_ENABLED) {
    return {};
  }

  return {
    clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
    enableReadyCheck: true,
    scaleReads: 'slave',
    redisOptions: {
      tls: process.env.NODE_ENV === 'production',
      password: config.password,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3
    },
    natMap: process.env.REDIS_NAT_MAP ? JSON.parse(process.env.REDIS_NAT_MAP) : undefined
  };
};

/**
 * Retrieves and validates Redis configuration from environment
 * @returns Validated Redis configuration object
 */
const getRedisConfig = (): RedisConfig => {
  const config: RedisConfig = {
    host: process.env.REDIS_HOST || DEFAULT_REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || DEFAULT_REDIS_PORT.toString(), 10),
    password: process.env.REDIS_PASSWORD || createHash('sha256').update(Date.now().toString()).digest('hex'),
    ttl: parseInt(process.env.REDIS_CACHE_TTL || DEFAULT_CACHE_TTL.toString(), 10),
    clusterMode: CLUSTER_MODE_ENABLED,
    memoryPolicy: process.env.REDIS_MEMORY_POLICY || DEFAULT_MEMORY_POLICY
  };

  validateRedisConfig(config);
  return config;
};

// Export the validated Redis configuration instance
export const redisConfig = getRedisConfig();

// Export utility functions for external use
export {
  getRedisConfig,
  configureClusterMode,
  validateRedisConfig
};

/**
 * Default Redis configuration for r6g.large ElastiCache instance
 */
export const defaultElastiCacheConfig = {
  family: 'r6g',
  nodeType: 'cache.r6g.large',
  numCacheNodes: CLUSTER_MODE_ENABLED ? 3 : 1,
  autoMinorVersionUpgrade: true,
  engineVersion: '7.0',
  port: DEFAULT_REDIS_PORT,
  securityGroupIds: process.env.REDIS_SECURITY_GROUP_IDS?.split(',') || [],
  preferredMaintenanceWindow: 'sun:05:00-sun:09:00',
  snapshotRetentionLimit: 7,
  transitEncryptionEnabled: true,
  atRestEncryptionEnabled: true
};