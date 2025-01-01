import { Module } from '@nestjs/common'; // v9.0.0
import { MongooseModule } from '@nestjs/mongoose'; // v9.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // v4.0.0
import { ConfigModule } from '@nestjs/config'; // v2.0.0
import { HelmetModule } from '@nestjs/helmet'; // v6.0.0

import { AnalysisModule } from './modules/analysis/analysis.module';
import { AuthModule } from './modules/auth/auth.module';
import { BabyModule } from './modules/baby/baby.module';
import { appConfig } from './config/app.config';

/**
 * Root module that configures and bootstraps the Baby Cry Analyzer backend application.
 * Implements comprehensive security, monitoring, and performance optimizations.
 */
@Module({
  imports: [
    // Global configuration with environment variable support
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [() => appConfig]
    }),

    // MongoDB connection with optimized settings
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.DATABASE_URL,
        dbName: process.env.DATABASE_NAME,
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 100,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        retryWrites: true,
        retryAttempts: 3,
        writeConcern: {
          w: 'majority',
          j: true
        },
        readConcern: { level: 'majority' },
        readPreference: 'primaryPreferred'
      })
    }),

    // Rate limiting for DDoS protection
    ThrottlerModule.forRoot({
      ttl: appConfig.rateLimit.windowMs / 1000, // Convert ms to seconds
      limit: appConfig.rateLimit.max,
      ignoreUserAgents: [/health-check/]
    }),

    // Security headers configuration
    HelmetModule.forRoot({
      contentSecurityPolicy: appConfig.security.helmet.contentSecurityPolicy,
      crossOriginEmbedderPolicy: appConfig.security.helmet.crossOriginEmbedderPolicy,
      crossOriginOpenerPolicy: appConfig.security.helmet.crossOriginOpenerPolicy,
      crossOriginResourcePolicy: appConfig.security.helmet.crossOriginResourcePolicy,
      dnsPrefetchControl: appConfig.security.helmet.dnsPrefetchControl,
      frameguard: appConfig.security.helmet.frameguard,
      hidePoweredBy: appConfig.security.helmet.hidePoweredBy,
      hsts: appConfig.security.helmet.hsts,
      ieNoOpen: appConfig.security.helmet.ieNoOpen,
      noSniff: appConfig.security.helmet.noSniff,
      originAgentCluster: appConfig.security.helmet.originAgentCluster,
      permittedCrossDomainPolicies: appConfig.security.helmet.permittedCrossDomainPolicies,
      referrerPolicy: appConfig.security.helmet.referrerPolicy,
      xssFilter: appConfig.security.helmet.xssFilter
    }),

    // Feature modules
    AnalysisModule,
    AuthModule,
    BabyModule
  ],
  controllers: [],
  providers: [
    // Global exception filter
    {
      provide: 'APP_FILTER',
      useClass: class {
        catch(exception: any) {
          console.error('Global exception:', exception);
          return exception;
        }
      }
    },
    // Global interceptor for logging
    {
      provide: 'APP_INTERCEPTOR',
      useClass: class {
        intercept(context: any, next: any) {
          const request = context.switchToHttp().getRequest();
          const startTime = Date.now();
          
          return next.handle().pipe(tap(() => {
            const duration = Date.now() - startTime;
            console.log(`${request.method} ${request.url} - ${duration}ms`);
          }));
        }
      }
    }
  ]
})
export class AppModule {
  constructor() {
    // Enable graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM signal. Starting graceful shutdown...');
      // Implement cleanup logic here
      process.exit(0);
    });

    // Monitor unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    console.log(`Application bootstrapped in ${process.env.NODE_ENV} mode`);
  }
}