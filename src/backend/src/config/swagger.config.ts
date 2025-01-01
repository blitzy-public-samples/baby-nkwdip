/**
 * Swagger/OpenAPI documentation configuration for Baby Cry Analyzer API
 * Provides comprehensive API documentation with enhanced security schemes
 * @version 1.0.0
 */

import { DocumentBuilder, SwaggerModule, SwaggerCustomOptions } from '@nestjs/swagger'; // ^9.0.0
import { AppConfig } from '../interfaces/config.interface';
import { appConfig } from './app.config';

// API Documentation Constants
const API_TITLE = 'Baby Cry Analyzer API';
const API_DESCRIPTION = 'Secure backend API for the Baby Cry Analyzer application providing real-time audio analysis and baby care recommendations';
const API_VERSION = '1.0';
const API_TOS_URL = 'https://babycryanalyzer.com/terms';
const API_CONTACT = {
  name: 'Baby Cry Analyzer Support',
  url: 'https://babycryanalyzer.com/support',
  email: 'support@babycryanalyzer.com'
};
const API_LICENSE = {
  name: 'Proprietary',
  url: 'https://babycryanalyzer.com/license'
};

/**
 * Creates comprehensive Swagger documentation configuration with security schemes
 * @returns Configured Swagger document builder
 */
export const createSwaggerConfig = () => {
  const builder = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setDescription(API_DESCRIPTION)
    .setVersion(API_VERSION)
    .setTermsOfService(API_TOS_URL)
    .setContact(API_CONTACT.name, API_CONTACT.url, API_CONTACT.email)
    .setLicense(API_LICENSE.name, API_LICENSE.url)
    
    // Configure security schemes
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token for authentication',
      },
      'JWT'
    )
    .addOAuth2(
      {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: appConfig.auth.auth0Domain + '/authorize',
            scopes: {
              'read:profile': 'Read user profile',
              'write:profile': 'Update user profile',
              'read:analysis': 'Access analysis results',
              'write:analysis': 'Submit audio for analysis'
            }
          }
        }
      },
      'OAuth2'
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY',
        description: 'API key for service-to-service authentication'
      },
      'ApiKey'
    )

    // Add comprehensive API tags
    .addTag('Analysis', 'Audio analysis and pattern recognition endpoints')
    .addTag('Auth', 'Authentication and authorization endpoints with OAuth2 and JWT')
    .addTag('Baby', 'Secure baby profile management endpoints')
    .addTag('User', 'User management and security endpoints')
    .addTag('Monitor', 'Real-time monitoring and alert endpoints')
    .addTag('History', 'Historical data and analytics endpoints')

    // Configure servers based on environment
    .addServer(
      appConfig.environment === 'production'
        ? 'https://api.babycryanalyzer.com'
        : appConfig.environment === 'staging'
        ? 'https://staging-api.babycryanalyzer.com'
        : `http://${appConfig.host}:${appConfig.port}`
    )

    // Add global parameters
    .addGlobalParameters({
      name: 'X-Correlation-ID',
      in: 'header',
      required: false,
      description: 'Correlation ID for request tracing'
    })
    .addGlobalParameters({
      name: 'Accept-Version',
      in: 'header',
      required: false,
      description: 'API version specification'
    });

  return builder.build();
};

/**
 * Enhanced Swagger UI configuration options
 * @returns SwaggerCustomOptions for UI customization
 */
export const getSwaggerOptions = (): SwaggerCustomOptions => {
  return {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        theme: 'monokai'
      },
      tryItOutEnabled: true,
      requestSnippetsEnabled: true,
      defaultModelsExpandDepth: 3,
      defaultModelExpandDepth: 3,
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Baby Cry Analyzer API Documentation',
    customfavIcon: '/assets/favicon.ico',
    explorer: true,
    validatorUrl: null,
    securityDefinitions: {
      JWT: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      OAuth2: {
        type: 'oauth2',
        description: 'Auth0 authentication'
      },
      ApiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY'
      }
    }
  };
};

/**
 * Export Swagger configuration utilities
 */
export const swaggerConfig = {
  createSwaggerConfig,
  getSwaggerOptions
};