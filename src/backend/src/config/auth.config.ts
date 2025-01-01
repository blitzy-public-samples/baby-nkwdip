/**
 * @fileoverview Authentication configuration module for the Baby Cry Analyzer backend
 * Provides strongly-typed authentication settings with comprehensive security features
 * @version 1.0.0
 */

import { config } from 'dotenv'; // ^16.0.0
import { AuthConfig } from '../interfaces/config.interface';
import { Environment } from '../interfaces/environment.interface';

// Initialize environment variables
config();

/**
 * Minimum required length for JWT secret
 */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Default rate limiting window in milliseconds (15 minutes)
 */
const DEFAULT_RATE_LIMIT_WINDOW = 15 * 60 * 1000;

/**
 * Default maximum requests per rate limit window
 */
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Validates JWT configuration for security compliance
 * @param secret - JWT secret to validate
 * @param expiresIn - Token expiration time
 * @returns boolean indicating if configuration is secure
 */
const validateJWTConfig = (secret: string, expiresIn: string): boolean => {
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT secret must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }

  const expirationPattern = /^[1-9]\d*[hdm]$/; // Format: number followed by h(hours), d(days), or m(minutes)
  if (!expirationPattern.test(expiresIn)) {
    throw new Error('Invalid JWT expiration format. Use format: number followed by h, d, or m');
  }

  return true;
};

/**
 * Validates Auth0 configuration
 * @param domain - Auth0 domain
 * @param clientId - Auth0 client ID
 * @param clientSecret - Auth0 client secret
 * @returns boolean indicating if configuration is valid
 */
const validateAuth0Config = (
  domain: string,
  clientId: string,
  clientSecret: string
): boolean => {
  if (!domain || !domain.includes('.auth0.com')) {
    throw new Error('Invalid Auth0 domain format');
  }

  if (!clientId || clientId.length < 32) {
    throw new Error('Invalid Auth0 client ID');
  }

  if (!clientSecret || clientSecret.length < 32) {
    throw new Error('Invalid Auth0 client secret');
  }

  return true;
};

/**
 * Validates rate limiting configuration
 * @param window - Rate limit window in milliseconds
 * @param maxRequests - Maximum requests per window
 * @returns boolean indicating if configuration is valid
 */
const validateRateLimitConfig = (window: number, maxRequests: number): boolean => {
  if (window < 1000 || window > 3600000) {
    throw new Error('Rate limit window must be between 1 second and 1 hour');
  }

  if (maxRequests < 1 || maxRequests > 1000) {
    throw new Error('Maximum requests must be between 1 and 1000');
  }

  return true;
};

/**
 * Retrieves and validates authentication configuration
 * @returns Validated AuthConfig object
 * @throws Error if configuration is invalid or insecure
 */
const getAuthConfig = (): AuthConfig => {
  const env = process.env as Environment;

  // Validate JWT configuration
  validateJWTConfig(env.JWT_SECRET, env.JWT_EXPIRATION);

  // Validate Auth0 configuration
  validateAuth0Config(
    env.AUTH0_DOMAIN,
    env.AUTH0_CLIENT_ID,
    env.AUTH0_CLIENT_SECRET
  );

  // Parse and validate rate limiting configuration
  const rateLimitWindow = parseInt(env.RATE_LIMIT_WINDOW || String(DEFAULT_RATE_LIMIT_WINDOW), 10);
  const rateLimitMaxRequests = parseInt(
    env.RATE_LIMIT_MAX_REQUESTS || String(DEFAULT_RATE_LIMIT_MAX_REQUESTS),
    10
  );
  validateRateLimitConfig(rateLimitWindow, rateLimitMaxRequests);

  const authConfig: AuthConfig = {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRATION,
    refreshTokenExpiresIn: env.REFRESH_TOKEN_EXPIRATION || '7d',
    auth0Domain: env.AUTH0_DOMAIN,
    auth0ClientId: env.AUTH0_CLIENT_ID,
    auth0ClientSecret: env.AUTH0_CLIENT_SECRET,
    tokenValidationPattern: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
    maxLoginAttempts: 5,
    rateLimitWindow,
    rateLimitMaxRequests,
    tokenBlacklistEnabled: true,
    securityAuditEnabled: true
  };

  return authConfig;
};

/**
 * Validated authentication configuration instance
 * @constant
 */
export const authConfig = getAuthConfig();

/**
 * Export individual configuration values for selective imports
 */
export const {
  jwtSecret,
  jwtExpiresIn,
  refreshTokenExpiresIn,
  auth0Domain,
  auth0ClientId,
  auth0ClientSecret,
  rateLimitWindow,
  rateLimitMaxRequests,
  tokenBlacklistEnabled,
  securityAuditEnabled
} = authConfig;