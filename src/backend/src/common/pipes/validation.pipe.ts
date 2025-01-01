import { 
  PipeTransform, 
  Injectable, 
  ArgumentMetadata, 
  BadRequestException 
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

// Constants for validation configuration
const VALIDATION_CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_VALIDATION_ERRORS = 10;
const BUILT_IN_TYPES = ['String', 'Boolean', 'Number', 'Array', 'Object', 'Date', 'Buffer'];
const VALIDATION_ERROR_MESSAGE = 'Validation failed - Security violation detected';

interface ValidationOptions {
  whitelist: boolean;
  forbidNonWhitelisted: boolean;
  forbidUnknownValues: boolean;
  validationError: {
    target: boolean;
    value: boolean;
  };
  stopAtFirstError: boolean;
  skipMissingProperties: boolean;
}

/**
 * Enhanced validation pipe with security measures and performance optimization
 * for the Baby Cry Analyzer API
 */
@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  private readonly validationOptions: ValidationOptions;
  private readonly validationCache: Map<string, any>;

  constructor() {
    // Initialize validation cache for performance optimization
    this.validationCache = new Map();

    // Configure secure validation options
    this.validationOptions = {
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error on unknown properties
      forbidUnknownValues: true, // Prevent unknown value types
      validationError: {
        target: false, // Don't expose target object in errors
        value: false // Don't expose validated values in errors
      },
      stopAtFirstError: true, // Optimize performance
      skipMissingProperties: false // Ensure all required properties are present
    };

    // Clean validation cache periodically
    setInterval(() => {
      this.validationCache.clear();
    }, VALIDATION_CACHE_TTL);
  }

  /**
   * Transforms and validates incoming data with enhanced security measures
   * @param value The value to validate
   * @param metadata The argument metadata
   * @returns Promise<any> Validated and transformed value
   * @throws BadRequestException on validation failure
   */
  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    const correlationId = uuidv4();
    
    // Skip validation for null values or missing metatype
    if (value === null || value === undefined) {
      return value;
    }

    const { metatype } = metadata;
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Generate cache key based on value and metatype
    const cacheKey = this.generateCacheKey(value, metatype);
    
    // Check cache for previously validated values
    const cachedResult = this.validationCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Transform plain object to class instance
    const object = plainToClass(metatype, this.sanitizeInput(value));

    // Validate object with enhanced security measures
    const errors = await validate(object, this.validationOptions);

    if (errors.length > 0) {
      // Format validation errors with security context
      const formattedErrors = this.formatValidationErrors(errors);
      
      throw new BadRequestException({
        message: VALIDATION_ERROR_MESSAGE,
        correlationId,
        errors: formattedErrors.slice(0, MAX_VALIDATION_ERRORS),
        context: {
          errorType: 'ValidationError',
          securityContext: {
            isSecurityRelated: true,
            severity: 'medium',
            category: 'input-validation'
          }
        }
      });
    }

    // Cache successful validation result
    this.validationCache.set(cacheKey, object);
    return object;
  }

  /**
   * Determines if the provided metatype requires validation
   * @param metatype The type to check
   * @returns boolean indicating if validation is required
   */
  private toValidate(metatype: Function): boolean {
    if (!metatype) {
      return false;
    }

    const types = [...BUILT_IN_TYPES, ...BUILT_IN_TYPES.map(t => t.toLowerCase())];
    return !types.includes(metatype.name);
  }

  /**
   * Generates a unique cache key for validation results
   * @param value The value to validate
   * @param metatype The type to validate against
   * @returns string Cache key
   */
  private generateCacheKey(value: any, metatype: Function): string {
    const valueHash = JSON.stringify(value);
    return `${metatype.name}_${valueHash}`;
  }

  /**
   * Sanitizes input data to prevent security vulnerabilities
   * @param value The input value to sanitize
   * @returns any Sanitized input value
   */
  private sanitizeInput(value: any): any {
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const sanitized = { ...value };
    
    // Remove potentially dangerous properties
    const dangerousProps = ['constructor', 'prototype', '__proto__'];
    dangerousProps.forEach(prop => {
      delete sanitized[prop];
    });

    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeInput(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Formats validation errors with security considerations
   * @param errors Array of validation errors
   * @returns Array of formatted error objects
   */
  private formatValidationErrors(errors: any[]): any[] {
    return errors.map(error => ({
      property: error.property,
      constraints: error.constraints,
      context: {
        errorType: 'ValidationConstraintViolation',
        securityContext: {
          isSecurityRelated: true,
          severity: 'low'
        }
      }
    }));
  }
}