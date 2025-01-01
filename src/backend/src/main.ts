import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import * as rateLimit from 'express-rate-limit';
import * as newrelic from 'newrelic';

import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap and configure the NestJS application with production-ready settings
 */
async function bootstrap(): Promise<void> {
  // Initialize NewRelic monitoring in production
  if (appConfig.environment === 'production') {
    newrelic.instrument();
  }

  // Create NestJS application with security settings
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    cors: false // CORS configured separately for more control
  });

  // Configure security middleware
  app.use(helmet({
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
  }));

  // Enable response compression
  app.use(compression());

  // Configure CORS with region-specific settings
  app.enableCors({
    origin: appConfig.cors.origins,
    methods: appConfig.cors.methods,
    allowedHeaders: appConfig.cors.allowedHeaders,
    exposedHeaders: appConfig.cors.exposedHeaders,
    credentials: appConfig.cors.credentials,
    maxAge: appConfig.cors.maxAge
  });

  // Configure rate limiting
  app.use(rateLimit({
    windowMs: appConfig.rateLimit.windowMs,
    max: appConfig.rateLimit.max,
    standardHeaders: appConfig.rateLimit.standardHeaders,
    legacyHeaders: appConfig.rateLimit.legacyHeaders,
    message: 'Too many requests from this IP, please try again later'
  }));

  // Set global API prefix and versioning
  app.setGlobalPrefix(appConfig.apiPrefix);

  // Configure global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true
    }
  }));

  // Configure global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Configure Swagger documentation
  setupSwagger(app);

  // Configure graceful shutdown
  app.enableShutdownHooks();

  // Start server with clustering in production
  await app.listen(appConfig.port, appConfig.host);
  Logger.log(
    `Application is running on: ${appConfig.host}:${appConfig.port}`,
    'Bootstrap'
  );
}

/**
 * Configure Swagger documentation with security schemes
 * @param app NestJS application instance
 */
function setupSwagger(app: any): void {
  const config = new DocumentBuilder()
    .setTitle('Baby Cry Analyzer API')
    .setDescription('API documentation for Baby Cry Analyzer system')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-KEY',
        in: 'header',
        description: 'API key for external service access'
      },
      'api-key'
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('analysis', 'Cry analysis endpoints')
    .addTag('babies', 'Baby profile management endpoints')
    .addTag('users', 'User management endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha'
    }
  });
}

// Bootstrap the application
bootstrap().catch(err => {
  Logger.error('Failed to start application', err, 'Bootstrap');
  process.exit(1);
});