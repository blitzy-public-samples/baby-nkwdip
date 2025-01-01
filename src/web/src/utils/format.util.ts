/**
 * @fileoverview Utility functions for formatting data in the Baby Cry Analyzer application
 * @version 1.0.0
 */

import numeral from 'numeral'; // ^2.0.6
import { AudioAnalysisResult } from '../types/audio.types';
import { CryType } from '../types/baby.types';
import { formatDate } from './date.util';

// Constants for formatting
const PERCENTAGE_CACHE_SIZE = 100;
const DURATION_CACHE_SIZE = 50;
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const BINARY_UNIT_SIZE = 1024;

// Memoization caches
const percentageCache = new Map<string, string>();
const durationCache = new Map<number, string>();
const fileSizeCache = new Map<number, string>();

/**
 * Formats a number as a percentage with specified decimal places
 * @param value - Number to format as percentage (0-1)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string with % symbol
 * @throws Error if value is invalid
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  try {
    // Validate input
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Invalid percentage value');
    }

    // Generate cache key
    const cacheKey = `${value}-${decimals}`;
    if (percentageCache.has(cacheKey)) {
      return percentageCache.get(cacheKey)!;
    }

    // Convert to percentage and format
    const percentage = value * 100;
    const formatted = numeral(percentage).format(`0.${'0'.repeat(decimals)}`) + '%';

    // Cache result if cache isn't too large
    if (percentageCache.size < PERCENTAGE_CACHE_SIZE) {
      percentageCache.set(cacheKey, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Percentage formatting error:', error);
    return '0%';
  }
};

/**
 * Formats milliseconds into human-readable duration
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string
 */
export const formatDuration = (milliseconds: number): string => {
  try {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error('Invalid duration value');
    }

    // Check cache
    if (durationCache.has(milliseconds)) {
      return durationCache.get(milliseconds)!;
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    let formatted = '';
    if (hours > 0) {
      formatted += `${hours}h `;
    }
    if (minutes % 60 > 0 || hours > 0) {
      formatted += `${minutes % 60}m `;
    }
    if (seconds % 60 > 0 || (!hours && !minutes)) {
      formatted += `${seconds % 60}s`;
    }

    // Cache result if cache isn't too large
    if (durationCache.size < DURATION_CACHE_SIZE) {
      durationCache.set(milliseconds, formatted.trim());
    }

    return formatted.trim();
  } catch (error) {
    console.error('Duration formatting error:', error);
    return '0s';
  }
};

/**
 * Formats an analysis result for display
 * @param result - Audio analysis result object
 * @returns Formatted analysis result object
 */
export const formatAnalysisResult = (result: AudioAnalysisResult): {
  type: string;
  confidence: string;
  timestamp: string;
} => {
  try {
    // Validate input
    if (!result || typeof result.needType !== 'string' || !Number.isFinite(result.confidence)) {
      throw new Error('Invalid analysis result');
    }

    // Format need type
    const type = result.needType.charAt(0).toUpperCase() + result.needType.slice(1);

    // Format confidence
    const confidence = formatPercentage(result.confidence, 1);

    // Format timestamp
    const timestamp = formatDate(new Date(result.timestamp), 'HH:mm:ss');

    return {
      type,
      confidence,
      timestamp
    };
  } catch (error) {
    console.error('Analysis result formatting error:', error);
    return {
      type: 'Unknown',
      confidence: '0%',
      timestamp: formatDate(new Date(), 'HH:mm:ss')
    };
  }
};

/**
 * Formats file size in bytes to human-readable format
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export const formatFileSize = (bytes: number): string => {
  try {
    // Validate input
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new Error('Invalid file size');
    }

    // Check cache
    if (fileSizeCache.has(bytes)) {
      return fileSizeCache.get(bytes)!;
    }

    // Handle zero bytes
    if (bytes === 0) return '0 B';

    // Calculate size and unit
    const exp = Math.min(
      Math.floor(Math.log(bytes) / Math.log(BINARY_UNIT_SIZE)),
      FILE_SIZE_UNITS.length - 1
    );
    const size = bytes / Math.pow(BINARY_UNIT_SIZE, exp);
    const unit = FILE_SIZE_UNITS[exp];

    // Format with appropriate precision
    const formatted = numeral(size).format(size >= 10 ? '0,0' : '0,0.0') + ' ' + unit;

    // Cache result
    if (fileSizeCache.size < PERCENTAGE_CACHE_SIZE) {
      fileSizeCache.set(bytes, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('File size formatting error:', error);
    return '0 B';
  }
};