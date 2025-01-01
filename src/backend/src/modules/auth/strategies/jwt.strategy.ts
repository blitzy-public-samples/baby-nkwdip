/**
 * JWT Strategy implementation for secure authentication in Baby Cry Analyzer
 * Provides comprehensive token validation, user verification, and security auditing
 * @version 1.0.0
 */

import { Injectable, UnauthorizedException } from '@nestjs/common'; // v9.0.0
import { PassportStrategy } from '@nestjs/passport'; // v9.0.0
import { Strategy, ExtractJwt } from 'passport-jwt'; // v4.0.0
import { JwtPayload } from '../../../interfaces/jwt-payload.interface';
import { authConfig } from '../../../config/auth.config';
import { UserService } from '../../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Time buffer in seconds to prevent token use near expiration
   * @private
   */
  private readonly EXPIRATION_BUFFER = 30;

  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: authConfig.jwtSecret,
      ignoreExpiration: false,
      passReqToCallback: false
    });
  }

  /**
   * Validates JWT payload and performs comprehensive security checks
   * @param payload - JWT payload containing user information
   * @returns Promise resolving to validated user or throwing UnauthorizedException
   * @throws UnauthorizedException for invalid/expired tokens or unauthorized users
   */
  async validate(payload: JwtPayload): Promise<any> {
    try {
      // Validate payload structure
      if (!payload || !payload.sub || !payload.email || !payload.roles) {
        throw new UnauthorizedException('Invalid token structure');
      }

      // Check token freshness with buffer time
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp - currentTime <= this.EXPIRATION_BUFFER) {
        throw new UnauthorizedException('Token is about to expire');
      }

      // Verify user exists and is active
      const user = await this.userService.findByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Validate user account status
      const isValidStatus = await this.userService.validateUserStatus(user.id);
      if (!isValidStatus) {
        throw new UnauthorizedException('Account is inactive or suspended');
      }

      // Verify user roles match token roles
      const hasValidRoles = payload.roles.every(role => user.roles.includes(role));
      if (!hasValidRoles) {
        throw new UnauthorizedException('Invalid role assignment');
      }

      // Return validated user object with security-relevant fields
      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
        iat: payload.iat,
        exp: payload.exp
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }
}