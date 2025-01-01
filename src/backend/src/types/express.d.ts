import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Request } from 'express';
import { Express } from 'express-serve-static-core';

/**
 * Global type declaration extending Express Request interface
 * Adds custom properties for authentication and file handling
 * Version: express@4.18.2
 */
declare global {
  namespace Express {
    /**
     * Extended Express Request interface with custom properties
     * Implements authentication and file upload type safety requirements
     */
    interface Request {
      /**
       * Authenticated user information from JWT token
       * Contains user ID, email, roles, and token metadata
       * Required for all authenticated routes
       */
      user: JwtPayload;

      /**
       * Single file upload information
       * Used for individual cry audio file analysis
       * Optional - present only in single file upload requests
       */
      file?: Express.Multer.File;

      /**
       * Multiple files upload information
       * Used for batch cry audio analysis
       * Optional - present only in multi-file upload requests
       */
      files?: Express.Multer.File[];
    }
  }
}

/**
 * Re-export the extended Request interface for explicit imports
 * Provides type safety for request handling throughout the application
 */
export interface Request extends Express.Request {
  user: JwtPayload;
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}