// @typescript-eslint/eslint-plugin version: ^5.48.0
// @typescript-eslint/parser version: ^5.48.0
// eslint-plugin-react version: ^7.32.0
// eslint-plugin-react-native version: ^4.0.0
// eslint-config-prettier version: ^8.6.0
// eslint-plugin-import version: ^2.26.0
// eslint-plugin-security version: ^1.7.0

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    },
    project: './tsconfig.json',
    tsconfigRootDir: '.'
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'plugin:security/recommended',
    'prettier'
  ],
  plugins: [
    '@typescript-eslint',
    'react',
    'react-native',
    'import',
    'security'
  ],
  env: {
    'react-native/react-native': true,
    'jest': true,
    'node': true
  },
  settings: {
    react: {
      version: 'detect'
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/strict-null-checks': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',

    // React specific rules
    'react/prop-types': 'off', // Using TypeScript for prop validation

    // React Native specific rules
    'react-native/no-inline-styles': 'error',
    'react-native/no-raw-text': 'error',
    'react-native/no-single-element-style-arrays': 'error',
    'react-native/no-unused-styles': 'error',
    'react-native/split-platform-components': 'error',

    // Import ordering rules
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'newlines-between': 'always',
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true
      }
    }],

    // Security rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',

    // General code quality rules
    'no-console': 'warn',
    'eqeqeq': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error'
  },
  overrides: [
    {
      // Relaxed rules for test files
      files: ['*.test.ts', '*.test.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'security/detect-object-injection': 'off'
      }
    }
  ]
};