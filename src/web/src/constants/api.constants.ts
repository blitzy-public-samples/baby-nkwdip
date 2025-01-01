/**
 * API Constants for Baby Cry Analyzer Web Application
 * Version: 1.0.0
 * 
 * This file contains all API-related constants including endpoints, 
 * configuration values, and HTTP status codes for consistent API communication.
 */

// API Version and Base URL Configuration
export const API_VERSION = 'v1';
export const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// API Configuration Constants
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Version': API_VERSION,
    'X-Client-Version': process.env.REACT_APP_VERSION,
    'X-Platform': 'web'
  },
  CACHE_DURATION: {
    SHORT: 300000,    // 5 minutes
    MEDIUM: 1800000,  // 30 minutes
    LONG: 86400000    // 24 hours
  }
} as const;

// API Endpoints grouped by functionality
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY_EMAIL: '/auth/verify-email',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password'
  },
  ANALYSIS: {
    ANALYZE: '/analysis/analyze',
    HISTORY: '/analysis/history',
    GET_BY_ID: '/analysis/:id',
    DELETE: '/analysis/:id',
    EXPORT: '/analysis/export',
    PATTERNS: '/analysis/patterns',
    STATISTICS: '/analysis/statistics'
  },
  BABY: {
    CREATE: '/baby',
    GET_ALL: '/baby',
    GET_BY_ID: '/baby/:id',
    UPDATE: '/baby/:id',
    DELETE: '/baby/:id',
    MILESTONES: '/baby/:id/milestones',
    GROWTH: '/baby/:id/growth',
    PREFERENCES: '/baby/:id/preferences'
  },
  USER: {
    PROFILE: '/user/profile',
    UPDATE: '/user/profile',
    SETTINGS: '/user/settings',
    NOTIFICATIONS: '/user/notifications',
    DEVICES: '/user/devices',
    EXPERTS: '/user/experts',
    COMMUNITY: '/user/community'
  }
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  SUCCESS: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204
  },
  CLIENT_ERROR: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMIT: 429
  },
  SERVER_ERROR: {
    INTERNAL: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503
  }
} as const;

// Type definitions for API response handling
export type ApiResponse<T = any> = {
  data: T;
  status: number;
  message?: string;
  timestamp: string;
};

export type ApiError = {
  code: number;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
};

// Utility type for endpoint parameters
export type EndpointParams = {
  id?: string | number;
  [key: string]: string | number | undefined;
};

// Export default configuration object
export default {
  version: API_VERSION,
  baseUrl: BASE_URL,
  config: API_CONFIG,
  endpoints: API_ENDPOINTS,
  status: HTTP_STATUS
} as const;