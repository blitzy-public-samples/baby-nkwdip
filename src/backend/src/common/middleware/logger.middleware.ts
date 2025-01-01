import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { formatDate } from '../utils/date.util';
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { performance } from 'perf_hooks';

// Sensitive fields that should be masked in logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'audioData',
  'authorization',
  'cookie',
  'sessionId',
  'x-api-key',
  'accessToken',
  'refreshToken',
  'apiKey',
  'credentials',
  'pin',
  'securityCode'
];

// Standard log format with comprehensive request details
const LOG_FORMAT = '[%s] %s %s - IP: %s - User: %s - Duration: %dms - Status: %d - Size: %s - UA: %s';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private startTime: number;
  private requestId: string;

  /**
   * Main middleware function for request/response logging
   * Implements comprehensive monitoring with security and performance tracking
   */
  use(req: Request, res: Response, next: NextFunction): void {
    this.startTime = performance.now();
    this.requestId = uuidv4();
    
    // Attach request ID for tracing
    req['requestId'] = this.requestId;

    // Extract key request details
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent') || 'Unknown';
    const userId = (req.user as any)?.id || 'Anonymous';

    // Initial request logging with masked sensitive data
    const requestLog = {
      timestamp: formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      requestId: this.requestId,
      method,
      url,
      ip,
      userId,
      headers: this.maskSensitiveData(req.headers),
      query: this.maskSensitiveData(req.query),
      body: this.maskSensitiveData(req.body)
    };

    console.log(`[REQUEST] ${JSON.stringify(requestLog)}`);

    // Capture response using event listeners
    res.on('finish', () => {
      const duration = Math.round(performance.now() - this.startTime);
      const size = res.get('content-length') || 0;
      const status = res.statusCode;

      // Comprehensive response logging
      const responseLog = {
        timestamp: formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
        requestId: this.requestId,
        duration,
        status,
        size,
        method,
        url,
        ip,
        userId,
        userAgent
      };

      // Performance monitoring thresholds
      if (duration > 1000) {
        console.warn(`[PERFORMANCE] Slow request detected: ${JSON.stringify(responseLog)}`);
      }

      // Security monitoring
      if (status === 401 || status === 403) {
        console.warn(`[SECURITY] Authentication/Authorization failure: ${JSON.stringify(responseLog)}`);
      }

      // Standard response logging
      console.log(
        LOG_FORMAT,
        formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
        method,
        url,
        ip,
        userId,
        duration,
        status,
        size,
        userAgent
      );
    });

    // Error handling
    res.on('error', (error: Error) => {
      console.error(`[ERROR] Request ${this.requestId} failed:`, {
        error: error.message,
        stack: error.stack,
        method,
        url,
        ip,
        userId
      });
    });

    next();
  }

  /**
   * Recursively masks sensitive data in objects while preserving structure
   * @param data Object containing potentially sensitive information
   * @returns Masked copy of the object
   */
  private maskSensitiveData(data: any): any {
    if (!data) return data;

    if (typeof data === 'string') {
      return '[MASKED]';
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskSensitiveData(item));
    }

    if (typeof data === 'object') {
      const maskedData: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_FIELDS.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        )) {
          maskedData[key] = '[MASKED]';
        } else if (typeof value === 'object') {
          maskedData[key] = this.maskSensitiveData(value);
        } else {
          maskedData[key] = value;
        }
      }

      return maskedData;
    }

    return data;
  }
}