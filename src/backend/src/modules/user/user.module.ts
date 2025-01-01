import { Module } from '@nestjs/common'; // v9.0.0
import { MongooseModule } from '@nestjs/mongoose'; // v9.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // v4.0.0
import { CacheModule } from '@nestjs/cache-manager'; // v1.0.0
import { SecurityModule } from '@nestjs/security'; // v1.0.0

import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, UserSchema } from './schemas/user.schema';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';

/**
 * Module configuring user management functionality with secure MongoDB integration,
 * rate limiting, caching, and proper dependency injection for the Baby Cry Analyzer application.
 */
@Module({
  imports: [
    // Configure MongoDB feature with secure schema and indexing
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
        collection: 'users'
      }
    ]),

    // Configure rate limiting to prevent brute force attacks
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
      ignoreUserAgents: [/^health-check/]
    }),

    // Configure caching for performance optimization
    CacheModule.register({
      ttl: 3600, // 1 hour cache duration
      max: 100, // Maximum number of items in cache
      isGlobal: false
    }),

    // Configure security features
    SecurityModule.register({
      encryption: {
        algorithm: 'aes-256-gcm',
        secretKey: process.env.ENCRYPTION_KEY
      }
    })
  ],
  controllers: [UserController],
  providers: [
    UserService,
    RolesGuard,
    LoggingInterceptor,
    {
      provide: 'APP_GUARD',
      useClass: RolesGuard
    }
  ],
  exports: [
    UserService,
    MongooseModule // Export for use in other modules that need User model
  ]
})
export class UserModule {}