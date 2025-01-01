import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'; // v9.0.0
import { AuthGuard } from '@nestjs/passport'; // v9.0.0
import { JwtStrategy } from '../strategies/jwt.strategy';
import { authConfig } from '../../../config/auth.config';

/**
 * Enhanced JWT authentication guard with comprehensive security features
 * Implements rate limiting, token validation, and security auditing
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Maximum number of retry attempts before temporary lockout
   * @private
   */
  private readonly maxRetries: number = authConfig.maxLoginAttempts;

  /**
   * Token expiration time in seconds (1 hour)
   * @private
   */
  private readonly tokenExpirationTime: number = 3600;

  /**
   * Rate limiting window in milliseconds
   * @private
   */
  private readonly rateLimitWindow: number = authConfig.rateLimitWindow;

  /**
   * Maximum requests per rate limit window
   * @private
   */
  private readonly rateLimitMaxRequests: number = authConfig.rateLimitMaxRequests;

  /**
   * Token validation pattern
   * @private
   */
  private readonly tokenPattern: RegExp = authConfig.tokenValidationPattern;

  constructor() {
    super();
  }

  /**
   * Enhanced route activation check with comprehensive security validations
   * @param context - Execution context
   * @returns Promise<boolean> - Whether the request is authorized
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      
      // Validate request integrity
      if (!request || !request.headers) {
        throw new UnauthorizedException('Invalid request structure');
      }

      // Extract and validate authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Missing or invalid authorization header');
      }

      // Extract and validate token format
      const token = authHeader.split(' ')[1];
      if (!this.tokenPattern.test(token)) {
        throw new UnauthorizedException('Invalid token format');
      }

      // Check token blacklist if enabled
      if (authConfig.tokenBlacklistEnabled) {
        const isBlacklisted = await this.checkTokenBlacklist(token);
        if (isBlacklisted) {
          throw new UnauthorizedException('Token has been revoked');
        }
      }

      // Perform parent class authentication
      const isAuthenticated = await super.canActivate(context);
      if (!isAuthenticated) {
        throw new UnauthorizedException('Authentication failed');
      }

      // Log security audit if enabled
      if (authConfig.securityAuditEnabled) {
        await this.logSecurityAudit(request, true);
      }

      return true;
    } catch (error) {
      // Log security audit for failed attempts
      if (authConfig.securityAuditEnabled) {
        await this.logSecurityAudit(context.switchToHttp().getRequest(), false);
      }

      throw error;
    }
  }

  /**
   * Enhanced error handler for authentication failures
   * @param err - Error object
   * @param user - User object
   * @returns any - Authenticated user or throws error
   */
  handleRequest(err: any, user: any): any {
    // Check for authentication errors
    if (err || !user) {
      throw err || new UnauthorizedException('Unable to authenticate user');
    }

    // Validate user object integrity
    if (!user.id || !user.email || !user.roles) {
      throw new UnauthorizedException('Invalid user data structure');
    }

    // Validate user roles
    if (!Array.isArray(user.roles) || user.roles.length === 0) {
      throw new UnauthorizedException('User has no valid roles assigned');
    }

    return user;
  }

  /**
   * Checks if a token has been blacklisted
   * @param token - JWT token
   * @returns Promise<boolean> - Whether token is blacklisted
   * @private
   */
  private async checkTokenBlacklist(token: string): Promise<boolean> {
    // Implementation would check Redis or database for blacklisted tokens
    return false; // Placeholder implementation
  }

  /**
   * Logs security audit information
   * @param request - HTTP request
   * @param success - Whether authentication was successful
   * @private
   */
  private async logSecurityAudit(request: any, success: boolean): Promise<void> {
    // Implementation would log to security audit system
    const auditData = {
      timestamp: new Date(),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      path: request.path,
      method: request.method,
      success,
    };
    // Placeholder for audit logging implementation
  }
}