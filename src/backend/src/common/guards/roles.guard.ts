import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role, RoleAware } from '../decorators/roles.decorator';

/**
 * Guard that implements secure role-based access control for the Baby Cry Analyzer application.
 * Provides comprehensive validation of user roles against required roles with enhanced security,
 * type safety, performance monitoring, and audit logging capabilities.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Validates if the current user has the required roles to access a route.
   * Implements strict type checking, comprehensive error handling, and audit logging.
   * 
   * @param context - Execution context containing request and handler information
   * @returns Promise resolving to boolean indicating if access is allowed
   * @throws UnauthorizedException if user authentication or role validation fails
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Get required roles from route metadata using reflector
      const requiredRoles = this.reflector.getAllAndOverwrite<Role[]>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()]
      );

      // If no roles are required, allow access
      if (!requiredRoles || requiredRoles.length === 0) {
        this.logAuditEvent('no_roles_required', context);
        return true;
      }

      // Get request object with type safety
      const request = context.switchToHttp().getRequest();
      
      // Validate user object exists and has correct structure
      if (!request.user) {
        this.logAuditEvent('missing_user', context);
        return false;
      }

      // Type guard to ensure user implements RoleAware interface
      const isRoleAware = (user: any): user is RoleAware => {
        return Array.isArray(user.roles) && 
               user.roles.every((role: any) => 
                 typeof role === 'string' && 
                 ['Parent', 'Caregiver', 'Expert', 'Admin'].includes(role)
               );
      };

      if (!isRoleAware(request.user)) {
        this.logAuditEvent('invalid_user_roles', context);
        return false;
      }

      // Start performance measurement
      const startTime = process.hrtime();

      // Check if user has any of the required roles
      const hasRole = requiredRoles.some(role => 
        request.user.roles.includes(role)
      );

      // Record performance metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      this.logPerformanceMetric(duration, context);

      // Log audit event with result
      this.logAuditEvent(
        hasRole ? 'access_granted' : 'access_denied',
        context,
        {
          requiredRoles,
          userRoles: request.user.roles
        }
      );

      return hasRole;
    } catch (error) {
      // Log error and deny access
      this.logAuditEvent('error', context, { error: error.message });
      return false;
    }
  }

  /**
   * Logs role validation events for audit purposes
   * @param eventType - Type of audit event
   * @param context - Execution context
   * @param details - Additional event details
   */
  private logAuditEvent(
    eventType: string,
    context: ExecutionContext,
    details?: Record<string, any>
  ): void {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler().name;
    const timestamp = new Date().toISOString();

    console.log(JSON.stringify({
      type: 'role_validation',
      eventType,
      timestamp,
      handler,
      path: request.path,
      method: request.method,
      userId: request.user?.id,
      ...details
    }));
  }

  /**
   * Records performance metrics for role validation
   * @param duration - Duration of role check in milliseconds
   * @param context - Execution context
   */
  private logPerformanceMetric(
    duration: number,
    context: ExecutionContext
  ): void {
    const handler = context.getHandler().name;
    console.log(JSON.stringify({
      type: 'performance',
      operation: 'role_validation',
      handler,
      duration,
      timestamp: new Date().toISOString()
    }));
  }
}