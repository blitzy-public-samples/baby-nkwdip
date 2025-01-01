import { Module } from '@nestjs/common'; // v9.0.0
import { JwtModule } from '@nestjs/jwt'; // v9.0.0
import { PassportModule } from '@nestjs/passport'; // v9.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // v4.0.0
import { CacheModule } from '@nestjs/cache-manager'; // v1.0.0
import { ConfigModule, ConfigService } from '@nestjs/config'; // v9.0.0

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

/**
 * Authentication module that configures comprehensive security features
 * for the Baby Cry Analyzer application including JWT authentication,
 * rate limiting, token management, and security monitoring.
 */
@Module({
  imports: [
    // Import UserModule for user management functionality
    UserModule,

    // Configure Passport with JWT as default strategy
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
      property: 'user'
    }),

    // Configure JWT with secure options
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'baby-cry-analyzer',
          audience: 'bca-api'
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: 'baby-cry-analyzer',
          audience: 'bca-api'
        }
      }),
      inject: [ConfigService]
    }),

    // Configure rate limiting to prevent brute force attacks
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10, // Maximum requests per window
      ignoreUserAgents: [/health-check/],
      errorMessage: 'Too many requests, please try again later.'
    }),

    // Configure caching for token blacklist and rate limiting
    CacheModule.register({
      ttl: 24 * 60 * 60, // 24 hours cache duration
      max: 10000, // Maximum number of items in cache
      isGlobal: false
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: 'SECURITY_CONFIG',
      useValue: {
        tokenValidation: {
          issuer: 'baby-cry-analyzer',
          audience: 'bca-api',
          clockTolerance: 30, // 30 seconds clock skew tolerance
          maxAge: '1h'
        },
        rateLimit: {
          loginAttempts: 5,
          lockoutDuration: 15 * 60, // 15 minutes
          monitorWindow: 60 * 60 // 1 hour
        },
        encryption: {
          algorithm: 'HS256',
          keyRotationInterval: '30d'
        }
      }
    }
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule
  ]
})
export class AuthModule {
  constructor() {
    // Validate security configuration on module initialization
    this.validateSecurityConfig();
  }

  /**
   * Validates critical security configuration parameters
   * @throws Error if security configuration is invalid
   */
  private validateSecurityConfig(): void {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }

    const requiredEnvVars = [
      'JWT_SECRET',
      'JWT_EXPIRATION',
      'AUTH0_DOMAIN',
      'AUTH0_CLIENT_ID',
      'AUTH0_CLIENT_SECRET'
    ];

    const missingVars = requiredEnvVars.filter(
      varName => !process.env[varName]
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`
      );
    }
  }
}