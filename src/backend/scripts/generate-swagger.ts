import { NestFactory } from '@nestjs/core'; // v9.0.0
import { SwaggerModule } from '@nestjs/swagger'; // v9.0.0
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';
import { createSwaggerConfig, getSwaggerOptions } from '../src/config/swagger.config';
import type { AppConfig } from '../src/config/app.config';

// Output path for generated OpenAPI specification
const OUTPUT_PATH = resolve(__dirname, '../openapi.json');

// Documentation metadata
const SWAGGER_TITLE = 'Baby Cry Analyzer API Documentation';
const SWAGGER_DESCRIPTION = 'Comprehensive API documentation for the Baby Cry Analyzer system';
const SWAGGER_VERSION = '1.0.0';

/**
 * Generates comprehensive Swagger/OpenAPI documentation with security schemes and examples
 */
async function generateSwaggerDoc(): Promise<void> {
  try {
    // Create temporary NestJS application instance
    const app = await NestFactory.create(AppModule, {
      logger: ['error'], // Minimize logging during generation
    });

    // Initialize enhanced Swagger configuration with security schemes
    const config = createSwaggerConfig();

    // Configure JWT authentication
    config.addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT'
    );

    // Configure OAuth2 authentication
    config.addOAuth2(
      {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: process.env.AUTH0_DOMAIN + '/authorize',
            tokenUrl: process.env.AUTH0_DOMAIN + '/oauth/token',
            scopes: {
              'read:profile': 'Read user profile',
              'write:profile': 'Update user profile',
              'read:analysis': 'Access analysis results',
              'write:analysis': 'Submit audio for analysis',
            },
          },
        },
      },
      'OAuth2'
    );

    // Configure API key authentication
    config.addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY',
        description: 'API key for service authentication',
      },
      'ApiKey'
    );

    // Configure rate limiting documentation
    config.addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-RateLimit-Limit',
        description: 'Maximum requests per window',
      },
      'RateLimit'
    );

    // Configure CORS policy documentation
    config.addSecurity('CORS', {
      type: 'apiKey',
      in: 'header',
      name: 'Origin',
      description: 'Allowed origins for CORS',
    });

    // Add error response standards
    config.addTag('Errors', {
      name: 'Error Handling',
      description: 'Standard error responses and handling',
    });

    // Create OpenAPI document
    const document = SwaggerModule.createDocument(app, config);

    // Add request/response examples
    addExamples(document);

    // Generate JSON specification
    writeSpecToFile(document);

    // Close temporary application
    await app.close();

    console.log(`OpenAPI specification generated successfully at: ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

/**
 * Writes the generated OpenAPI specification to a file
 * @param specification OpenAPI specification object
 */
function writeSpecToFile(specification: Record<string, any>): void {
  try {
    // Convert to formatted JSON string
    const jsonSpec = JSON.stringify(specification, null, 2);

    // Write to file
    writeFileSync(OUTPUT_PATH, jsonSpec);

  } catch (error) {
    console.error('Failed to write specification to file:', error);
    throw error;
  }
}

/**
 * Adds comprehensive examples to OpenAPI specification
 * @param document OpenAPI document to enhance
 */
function addExamples(document: Record<string, any>): void {
  // Add authentication examples
  document.components.examples = {
    ...document.components.examples,
    LoginRequest: {
      value: {
        email: 'user@example.com',
        password: 'SecureP@ssw0rd',
      },
    },
    LoginResponse: {
      value: {
        accessToken: 'eyJhbGciOiJIUzI1NiIs...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
        expiresIn: 3600,
      },
    },
    ValidationError: {
      value: {
        statusCode: 400,
        message: ['email must be a valid email address'],
        error: 'Bad Request',
      },
    },
    UnauthorizedError: {
      value: {
        statusCode: 401,
        message: 'Unauthorized access',
        error: 'Unauthorized',
      },
    },
    RateLimitError: {
      value: {
        statusCode: 429,
        message: 'Too many requests',
        error: 'Too Many Requests',
      },
    },
  };

  // Add security scheme examples
  document.components.securitySchemes = {
    ...document.components.securitySchemes,
    JWT: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT authorization header using the Bearer scheme',
    },
    OAuth2: {
      type: 'oauth2',
      flows: {
        implicit: {
          authorizationUrl: process.env.AUTH0_DOMAIN + '/authorize',
          scopes: {
            'read:profile': 'Read user profile',
            'write:profile': 'Update user profile',
          },
        },
      },
    },
  };
}

// Execute documentation generation
generateSwaggerDoc().catch(console.error);