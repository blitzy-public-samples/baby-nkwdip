import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  Logger 
} from '@nestjs/common'; // ^9.0.0
import { formatDate } from '../utils/date.util';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

interface ErrorResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
  method: string;
  correlationId: string;
  requestId?: string;
  context?: {
    errorType: string;
    stackTrace?: string;
    securityContext?: {
      isSecurityRelated: boolean;
      severity: string;
      category?: string;
    };
    requestContext: {
      headers: Record<string, string>;
      query?: Record<string, string>;
      params?: Record<string, string>;
    };
  };
}

/**
 * Global HTTP exception filter that provides standardized error handling,
 * security monitoring, and comprehensive error tracking for the Baby Cry Analyzer API
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;
  private readonly sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  private readonly securityErrorPatterns = [
    'unauthorized',
    'forbidden',
    'invalid token',
    'authentication failed',
    'permission denied'
  ];

  constructor() {
    this.logger = new Logger('HttpExceptionFilter');
  }

  /**
   * Catches and processes HTTP exceptions with enhanced security monitoring
   * @param exception The caught HTTP exception
   * @param host The execution context host
   */
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = uuidv4();
    
    // Format error response with security context
    const errorResponse = this.formatError(exception, request, correlationId);
    
    // Log error with security classification
    this.logError(errorResponse, exception);
    
    // Send sanitized response
    response
      .status(errorResponse.statusCode)
      .json(this.sanitizeResponse(errorResponse));
  }

  /**
   * Formats exception into standardized error response with security context
   * @param exception The HTTP exception to format
   * @param request The incoming request
   * @param correlationId The generated correlation ID
   */
  private formatError(
    exception: HttpException, 
    request: Request, 
    correlationId: string
  ): ErrorResponse {
    const status = exception.getStatus();
    const response = exception.getResponse() as string | object;
    const message = typeof response === 'string' ? response : (response as any).message;
    
    const errorResponse: ErrorResponse = {
      statusCode: status,
      message: message,
      timestamp: formatDate(new Date(), 'yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX'),
      path: request.url,
      method: request.method,
      correlationId: correlationId,
      requestId: request.headers['x-request-id'] as string,
      context: {
        errorType: exception.name,
        stackTrace: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
        securityContext: this.getSecurityContext(exception, message),
        requestContext: {
          headers: this.sanitizeHeaders(request.headers),
          query: request.query as Record<string, string>,
          params: request.params
        }
      }
    };

    return errorResponse;
  }

  /**
   * Determines security context and severity of the error
   * @param exception The HTTP exception
   * @param message The error message
   */
  private getSecurityContext(exception: HttpException, message: string): {
    isSecurityRelated: boolean;
    severity: string;
    category?: string;
  } {
    const isSecurityRelated = this.securityErrorPatterns.some(pattern => 
      message.toLowerCase().includes(pattern)
    );
    
    const status = exception.getStatus();
    let severity = 'low';
    let category;

    if (status === 401 || status === 403) {
      severity = 'high';
      category = 'authentication';
    } else if (status === 429) {
      severity = 'medium';
      category = 'rate-limit';
    } else if (isSecurityRelated) {
      severity = 'medium';
      category = 'security';
    }

    return {
      isSecurityRelated,
      severity,
      category
    };
  }

  /**
   * Logs error details with security correlation
   * @param errorResponse The formatted error response
   * @param exception The original exception
   */
  private logError(errorResponse: ErrorResponse, exception: HttpException): void {
    const logContext = {
      correlationId: errorResponse.correlationId,
      requestId: errorResponse.requestId,
      path: errorResponse.path,
      statusCode: errorResponse.statusCode,
      securityContext: errorResponse.context?.securityContext
    };

    if (errorResponse.context?.securityContext?.severity === 'high') {
      this.logger.error(
        `Security Alert: ${errorResponse.message}`,
        exception.stack,
        logContext
      );
    } else {
      this.logger.warn(
        `API Error: ${errorResponse.message}`,
        logContext
      );
    }
  }

  /**
   * Sanitizes headers to remove sensitive information
   * @param headers The request headers
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    this.sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  /**
   * Sanitizes error response for client consumption
   * @param errorResponse The full error response
   */
  private sanitizeResponse(errorResponse: ErrorResponse): Partial<ErrorResponse> {
    const { context, ...safeResponse } = errorResponse;
    
    // Only include non-sensitive context information
    if (context) {
      safeResponse.context = {
        errorType: context.errorType,
        securityContext: context.securityContext?.isSecurityRelated ? {
          severity: context.securityContext.severity
        } : undefined
      };
    }

    return safeResponse;
  }
}