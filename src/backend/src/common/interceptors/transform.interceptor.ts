import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'; // ^9.0.0
import { Observable } from 'rxjs'; // ^7.0.0
import { map } from 'rxjs/operators'; // ^7.0.0
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface defining the standardized API response format
 */
interface ResponseFormat<T> {
  success: boolean;
  data: T;
  timestamp: string;
  responseTime: number;
  requestId: string;
  metadata: { [key: string]: any };
}

/**
 * Interceptor that transforms API responses into a standardized format with performance monitoring
 * Implements response standardization and performance tracking requirements from technical specifications
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  private startTime: [number, number];
  private requestId: string;

  /**
   * Intercepts the request/response pipeline to transform responses into standardized format
   * @param context - Execution context containing request details
   * @param next - Call handler for processing the request pipeline
   * @returns Observable of transformed response with standardized format
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseFormat<T>> {
    // Generate unique request ID and record start time
    this.requestId = uuidv4();
    this.startTime = process.hrtime();

    // Extract request metadata
    const request = context.switchToHttp().getRequest();
    const metadata = {
      path: request.path,
      method: request.method,
      userAgent: request.headers['user-agent'],
    };

    return next.handle().pipe(
      map((response: T) => {
        try {
          const transformedResponse = this.transformResponse(response);
          
          // Add request metadata
          transformedResponse.metadata = {
            ...transformedResponse.metadata,
            ...metadata,
          };

          if (!this.validateResponse(transformedResponse)) {
            throw new Error('Invalid response format');
          }

          return transformedResponse;
        } catch (error) {
          // Handle transformation errors while maintaining format
          return {
            success: false,
            data: null,
            timestamp: new Date().toISOString(),
            responseTime: this.calculateResponseTime(),
            requestId: this.requestId,
            metadata: {
              ...metadata,
              error: error.message,
            },
          };
        }
      }),
    );
  }

  /**
   * Transforms raw response into standardized format with performance metrics
   * @param response - Raw response data to transform
   * @returns Standardized response format with metadata
   */
  private transformResponse(response: T): ResponseFormat<T> {
    const responseTime = this.calculateResponseTime();

    // Create standardized response object
    const transformedResponse: ResponseFormat<T> = {
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      responseTime,
      requestId: this.requestId,
      metadata: {},
    };

    // Handle large response optimization
    if (response && typeof response === 'object' && Object.keys(response).length > 100) {
      transformedResponse.metadata.truncated = true;
    }

    return transformedResponse;
  }

  /**
   * Validates the transformed response format
   * @param response - Response object to validate
   * @returns Boolean indicating validation result
   */
  private validateResponse(response: ResponseFormat<T>): boolean {
    return (
      typeof response.success === 'boolean' &&
      response.timestamp &&
      typeof response.responseTime === 'number' &&
      response.responseTime > 0 &&
      typeof response.requestId === 'string' &&
      response.requestId.length > 0 &&
      typeof response.metadata === 'object'
    );
  }

  /**
   * Calculates high-precision response time in milliseconds
   * @returns Response time in milliseconds
   */
  private calculateResponseTime(): number {
    const hrtime = process.hrtime(this.startTime);
    return Math.round((hrtime[0] * 1000 + hrtime[1] / 1000000) * 100) / 100;
  }
}