/**
 * @fileoverview Entry point for the Baby Cry Analyzer React Native web application
 * Initializes core application with error handling and performance monitoring
 * @version 1.0.0
 */

import { AppRegistry, LogBox } from 'react-native'; // ^0.71.0
import * as Sentry from '@sentry/react-native'; // ^5.0.0
import App from './src/App';

// Global constants
const APP_NAME = 'BabyCryAnalyzer';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;

/**
 * Configures global error handling and monitoring
 */
const configureErrorHandling = () => {
  // Initialize Sentry for error tracking
  if (!IS_DEVELOPMENT && SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.2,
      enabled: !IS_DEVELOPMENT,
      debug: IS_DEVELOPMENT,
      integrations: [
        new Sentry.ReactNativeTracing({
          routingInstrumentation: Sentry.routingInstrumentation,
          tracingOrigins: ['localhost', /^\//, /^https:\/\//],
        }),
      ],
    });
  }

  // Set up global error event listeners
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    Sentry.captureException(event.reason);
  });

  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    Sentry.captureException(event.error);
  });
};

/**
 * Configures performance monitoring and tracking
 */
const configurePerformanceMonitoring = () => {
  // Initialize performance monitoring
  if (!IS_DEVELOPMENT) {
    Sentry.startTransaction({
      name: 'app-initialization',
      op: 'initialization',
    });
  }

  // Set up performance marks
  performance.mark('app-init-start');

  // Monitor long tasks
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.duration > 50) { // 50ms threshold
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `Long task detected: ${entry.duration}ms`,
          level: 'warning',
        });
      }
    });
  });

  observer.observe({ entryTypes: ['longtask'] });
};

/**
 * Configures development-specific settings and tools
 */
const configureDevelopmentSettings = () => {
  if (IS_DEVELOPMENT) {
    // Configure LogBox
    LogBox.ignoreLogs([
      'Require cycle:',
      'Non-serializable values were found in the navigation state',
    ]);

    // Enable React DevTools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function () {};
    }
  }
};

/**
 * Main application initialization function
 */
const initializeApp = () => {
  try {
    // Configure error handling and monitoring
    configureErrorHandling();

    // Set up performance tracking
    configurePerformanceMonitoring();

    // Configure development settings
    configureDevelopmentSettings();

    // Register the application
    AppRegistry.registerComponent(APP_NAME, () => App);

    // Initialize web-specific configuration
    AppRegistry.runApplication(APP_NAME, {
      rootTag: document.getElementById('root'),
      initialProps: {
        isRTL: false, // Add RTL support if needed
        theme: 'light', // Default theme
      },
    });

    // Mark initialization complete
    performance.mark('app-init-end');
    performance.measure('app-initialization', 'app-init-start', 'app-init-end');

  } catch (error) {
    console.error('Application initialization failed:', error);
    Sentry.captureException(error);
  }
};

// Initialize the application
initializeApp();