/**
 * Interface defining the structure of JWT token payloads for authentication and authorization.
 * Implements security standards and type safety for all JWT operations in the Baby Cry Analyzer application.
 * 
 * @interface JwtPayload
 * @property {string} sub - Subject identifier (user ID)
 * @property {string} email - User's email address
 * @property {string[]} roles - Array of user roles for authorization (Parent, Caregiver, Expert, Admin)
 * @property {number} iat - Issued at timestamp (Unix timestamp in seconds)
 * @property {number} exp - Expiration timestamp (Unix timestamp in seconds)
 */
export interface JwtPayload {
  /**
   * Subject identifier (user ID) - Unique identifier for the authenticated user
   */
  sub: string;

  /**
   * User's email address - Used for user identification and communication
   */
  email: string;

  /**
   * Array of user roles for role-based access control
   * Possible values: 'Parent', 'Caregiver', 'Expert', 'Admin'
   */
  roles: string[];

  /**
   * Token issued at timestamp (Unix timestamp in seconds)
   * Used for token freshness validation
   */
  iat: number;

  /**
   * Token expiration timestamp (Unix timestamp in seconds)
   * Set to 1 hour from issuance as per token management specifications
   */
  exp: number;
}