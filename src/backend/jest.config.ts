import type { Config } from '@jest/types'; // @version ^29.0.0
import { compilerOptions } from './tsconfig.json';

// Jest configuration for Baby Cry Analyzer backend service
const config: Config.InitialOptions = {
  // Supported file extensions for test modules
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Root directory for test discovery
  rootDir: '.',

  // Pattern for test file matching
  testRegex: '.*\\.spec\\.ts$',

  // Transform TypeScript files using ts-jest
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },

  // Files to collect coverage from, excluding configuration and helper files
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/*.schema.ts',
    '!**/*.mock.ts',
    '!**/*.constant.ts'
  ],

  // Directory for coverage reports
  coverageDirectory: './coverage',

  // Node environment for tests
  testEnvironment: 'node',

  // Module path aliases mapping from tsconfig
  moduleNameMapper: {
    '@common/(.*)': '<rootDir>/src/common/$1',
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@modules/(.*)': '<rootDir>/src/modules/$1',
    '@interfaces/(.*)': '<rootDir>/src/interfaces/$1',
    '@types/(.*)': '<rootDir>/src/types/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1',
    '@services/(.*)': '<rootDir>/src/services/$1',
    '@controllers/(.*)': '<rootDir>/src/controllers/$1'
  },

  // Minimum coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Enable verbose test output
  verbose: true,

  // Detect and report unhandled async operations
  detectOpenHandles: true,

  // Force exit after test completion
  forceExit: true,

  // Limit parallel test execution to 50% of available CPUs
  maxWorkers: '50%',

  // Test timeout in milliseconds
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocked implementations
  restoreMocks: true
};

export default config;