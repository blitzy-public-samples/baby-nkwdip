// @version metro-react-native-babel-preset@0.75.0
// @version @babel/plugin-proposal-decorators@7.21.0
// @version @babel/plugin-transform-runtime@7.21.0
// @version babel-plugin-transform-remove-console@6.9.4

module.exports = {
  // Core React Native preset for proper code transpilation
  presets: ['module:metro-react-native-babel-preset'],

  // Plugin configurations for TypeScript and optimization support
  plugins: [
    // Enable TypeScript decorators with legacy mode for broader compatibility
    ['@babel/plugin-proposal-decorators', { 
      legacy: true 
    }],
    
    // Runtime transformation support for optimized builds
    ['@babel/plugin-transform-runtime', {
      helpers: true,
      regenerator: true
    }]
  ],

  // Environment-specific configurations
  env: {
    // Production-specific optimizations
    production: {
      plugins: [
        // Remove console statements in production for security and optimization
        'transform-remove-console'
      ]
    }
  }
};