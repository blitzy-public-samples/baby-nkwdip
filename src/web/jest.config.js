// @ts-check

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  // Use React Native preset as base configuration
  preset: 'react-native',

  // Test environment configuration
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 10000,

  // File patterns for test discovery
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}'
  ],

  // File extensions to consider for module resolution
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Transform configuration for node_modules
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-.*)/)' 
  ],

  // Module name mapping for @ alias
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Setup files for testing environment
  setupFiles: [
    './node_modules/react-native-gesture-handler/jestSetup.js'
  ],
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect'
  ],

  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/assets/**',
    '!src/constants/**'
  ],

  // Coverage thresholds to maintain code quality
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Global test timeout to meet SLA requirements
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.json',
      babelConfig: true,
      diagnostics: false
    }
  },

  // Reporter configuration for test results
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './coverage/junit',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Clear mocks between each test
  clearMocks: true,
  
  // Automatically reset mock state
  resetMocks: true,

  // Indicates whether each individual test should be reported during the run
  notify: true,

  // Automatically restore mocks between every test
  restoreMocks: true,

  // Maximum number of workers used to run tests
  maxWorkers: '50%'
};