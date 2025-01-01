import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'; // ^9.0.0
import { Observable } from 'rxjs'; // ^7.0.0
import { tap } from 'rxjs/operators'; // ^7.0.0
import { formatDate } from '../utils/date.util';
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

// Fields that should be masked in logs for security
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'key', 'audioData',
  'authorization', 'apiKey', 'refreshToken', 'sessionId', 'x-api-key'
];

// Standard log format template
const LOG_FORMAT = '[%s] %s %s - %s %s - %dms - CID:%s - User:%s';

// Performance monitoring thresholds (ms)
const PERFORMANCE_THRESHOLDS = {
  WARNING_MS: 1000,
  ERROR_MS: 3000
};

// Maximum size of body to log
const MAX_BODY_LOG_SIZE = 10000;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private startTime: number;
  private correlationId: string;
  private requestSize: number;
  private userContext: string;

  /**
   * Intercepts HTTP requests/responses for comprehensive logging
   * @param context Execution context containing request details
   * @param next Call handler for the intercepted request
   * @returns Observable of the handled request with logging
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.startTime = Date.now();
    this.correlationId = this.generateCorrelationId();
    
    const request = context.switchToHttp().getRequest();
    const { method, url, headers, body } = request;
    
    // Extract user context if available
    this.userContext = headers['x-user-id'] || 'anonymous';
    
    // Calculate request size
    this.requestSize = JSON.stringify(body).length;
    if (this.requestSize > MAX_BODY_LOG_SIZE) {
      console.warn(`Large request body detected (${this.requestSize} bytes) - CID:${this.correlationId}`);
    }

    // Log incoming request
    const maskedHeaders = this.maskSensitiveData(headers, 1);
    const maskedBody = this.maskSensitiveData(body, 3);
    
    console.log(
      LOG_FORMAT,
      formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
      'REQUEST',
      method,
      url,
      this.requestSize > MAX_BODY_LOG_SIZE ? 'LARGE_BODY' : JSON.stringify(maskedBody),
      0,
      this.correlationId,
      this.userContext
    );

    // Process request and log response
    return next.handle().pipe(
      tap({
        next: (response: any) => {
          const duration = Date.now() - this.startTime;
          const maskedResponse = this.maskSensitiveData(response, 3);
          
          // Performance monitoring
          if (duration > PERFORMANCE_THRESHOLDS.ERROR_MS) {
            console.error(`Request exceeded error threshold: ${duration}ms - CID:${this.correlationId}`);
          } else if (duration > PERFORMANCE_THRESHOLDS.WARNING_MS) {
            console.warn(`Request exceeded warning threshold: ${duration}ms - CID:${this.correlationId}`);
          }

          // Log successful response
          console.log(
            LOG_FORMAT,
            formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
            'RESPONSE',
            method,
            url,
            JSON.stringify(maskedResponse),
            duration,
            this.correlationId,
            this.userContext
          );
        },
        error: (error: any) => {
          const duration = Date.now() - this.startTime;
          
          // Log error response
          console.error(
            LOG_FORMAT,
            formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS'),
            'ERROR',
            method,
            url,
            JSON.stringify({
              message: error.message,
              stack: error.stack,
              code: error.code
            }),
            duration,
            this.correlationId,
            this.userContext
          );
        }
      })
    );
  }

  /**
   * Recursively masks sensitive data in objects
   * @param data Object containing potentially sensitive data
   * @param depth Current recursion depth
   * @returns Object with masked sensitive data
   */
  private maskSensitiveData(data: any, depth: number): any {
    if (depth < 0 || !data || typeof data !== 'object') {
      return data;
    }

    const masked = Array.isArray(data) ? [...data] : { ...data };

    for (const key in masked) {
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        masked[key] = '***MASKED***';
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key], depth - 1);
      }
    }

    return masked;
  }

  /**
   * Generates a unique correlation ID for request tracking
   * @returns Unique correlation ID string
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const uuid = uuidv4().split('-')[0];
    return `${timestamp}-${uuid}`;
  }
}

export { LoggingInterceptor };