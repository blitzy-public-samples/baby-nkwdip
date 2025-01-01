import { SetMetadata } from '@nestjs/common';

/**
 * Constant key used for storing and retrieving roles metadata in NestJS decorators and guards.
 * This key is used consistently across the authorization system to maintain type safety.
 */
export const ROLES_KEY = 'roles';

/**
 * Valid role types supported by the Baby Cry Analyzer system.
 * These align with the authorization matrix defined in the technical specifications.
 */
export type Role = 'Parent' | 'Caregiver' | 'Expert' | 'Admin';

/**
 * Custom decorator for implementing role-based access control on route handlers.
 * Integrates with NestJS guard system to enforce authorization requirements.
 * 
 * @param roles - Array of roles that are allowed to access the decorated route handler
 * @returns Decorator function that applies roles metadata
 * 
 * @example
 * ```typescript
 * @Roles('Parent', 'Admin')
 * @Get('baby-profile')
 * getBabyProfile() {
 *   // Only Parents and Admins can access this endpoint
 * }
 * ```
 */
export const Roles = (...roles: Role[]) => {
  // Validate that all provided roles are valid according to the Role type
  roles.forEach(role => {
    if (!['Parent', 'Caregiver', 'Expert', 'Admin'].includes(role)) {
      throw new Error(`Invalid role: ${role}. Role must be one of: Parent, Caregiver, Expert, Admin`);
    }
  });

  // Create and return the metadata decorator
  return SetMetadata(ROLES_KEY, roles);
};

/**
 * Type guard to check if a string is a valid Role
 * Useful for runtime validation of role values
 * 
 * @param role - String to check if it's a valid role
 * @returns Boolean indicating if the string is a valid role
 */
export function isValidRole(role: string): role is Role {
  return ['Parent', 'Caregiver', 'Expert', 'Admin'].includes(role);
}

/**
 * Interface for objects that contain role information
 * Useful for type checking in guards and services
 */
export interface RoleAware {
  roles: Role[];
}

/**
 * Helper function to check if a user has required roles
 * 
 * @param userRoles - Array of roles the user has
 * @param requiredRoles - Array of roles required for access
 * @returns Boolean indicating if user has required roles
 */
export function hasRequiredRoles(userRoles: Role[], requiredRoles: Role[]): boolean {
  return requiredRoles.some(role => userRoles.includes(role));
}