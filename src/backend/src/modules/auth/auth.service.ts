import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'; // v9.0.0
import { JwtService } from '@nestjs/jwt'; // v9.0.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // v2.4.1
import { UserService } from '../user/user.service';
import * as crypto from 'crypto';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

interface TokenPayload {
  sub: string;
  email: string;
  roles: string[];
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '1h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly RATE_LIMIT_POINTS = 5;
  private readonly RATE_LIMIT_DURATION = 60; // 60 seconds
  private readonly rateLimiter: RateLimiterRedis;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService
  ) {
    // Initialize rate limiter with Redis
    this.rateLimiter = new RateLimiterRedis({
      points: this.RATE_LIMIT_POINTS,
      duration: this.RATE_LIMIT_DURATION,
      blockDuration: 60 * 15, // 15 minutes block
      storeClient: null, // Redis client to be injected
      keyPrefix: 'auth_rl'
    });
  }

  /**
   * Authenticates user and generates JWT tokens
   * @param loginDto - Login credentials
   * @returns Promise<AuthTokens> - Access and refresh tokens
   */
  async login(loginDto: { email: string; password: string }): Promise<AuthTokens> {
    try {
      // Apply rate limiting
      await this.rateLimiter.consume(loginDto.email);

      // Validate credentials
      const user = await this.userService.validateCredentials(
        loginDto.email,
        loginDto.password
      );

      // Generate tokens
      return this.generateTokens(user);
    } catch (error) {
      if (error.name === 'RateLimiterError') {
        throw new UnauthorizedException('Too many login attempts. Please try again later.');
      }
      throw error;
    }
  }

  /**
   * Registers new user with secure token generation
   * @param registerDto - Registration data
   * @returns Promise<AuthTokens> - Initial authentication tokens
   */
  async register(registerDto: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthTokens> {
    try {
      // Create new user
      const user = await this.userService.create({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        roles: ['user']
      });

      // Generate initial tokens
      return this.generateTokens(user);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refreshes authentication tokens
   * @param refreshToken - Current refresh token
   * @returns Promise<AuthTokens> - New token pair
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const payload = await this.verifyToken(refreshToken, 'refresh');

      // Get user data
      const user = await this.userService.findByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new token pair
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Generates new access and refresh tokens
   * @param user - User document
   * @returns AuthTokens - Token pair with expiry
   */
  private generateTokens(user: any): AuthTokens {
    const tokenPayload: Omit<TokenPayload, 'type'> = {
      sub: user._id,
      email: user.email,
      roles: user.roles
    };

    // Generate access token
    const accessToken = this.jwtService.sign(
      { ...tokenPayload, type: 'access' },
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        secret: process.env.JWT_ACCESS_SECRET
      }
    );

    // Generate refresh token with encryption
    const refreshToken = this.jwtService.sign(
      { ...tokenPayload, type: 'refresh' },
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        secret: process.env.JWT_REFRESH_SECRET
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpiryInSeconds(this.ACCESS_TOKEN_EXPIRY),
      refreshExpiresIn: this.getExpiryInSeconds(this.REFRESH_TOKEN_EXPIRY)
    };
  }

  /**
   * Verifies and decodes JWT token
   * @param token - JWT token to verify
   * @param type - Token type (access/refresh)
   * @returns TokenPayload - Decoded token payload
   */
  private async verifyToken(
    token: string,
    type: 'access' | 'refresh'
  ): Promise<TokenPayload> {
    try {
      const secret = type === 'access' 
        ? process.env.JWT_ACCESS_SECRET 
        : process.env.JWT_REFRESH_SECRET;

      const payload = await this.jwtService.verifyAsync(token, { secret });

      if (payload.type !== type) {
        throw new Error('Invalid token type');
      }

      return payload as TokenPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Converts time string to seconds
   * @param time - Time string (e.g., '1h', '7d')
   * @returns number - Time in seconds
   */
  private getExpiryInSeconds(time: string): number {
    const unit = time.slice(-1);
    const value = parseInt(time.slice(0, -1));

    switch (unit) {
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return value;
    }
  }
}