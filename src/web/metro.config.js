/**
 * Metro configuration for Baby Cry Analyzer
 * @version 1.0.0
 * 
 * This configuration handles:
 * - TypeScript and JavaScript compilation
 * - Audio file processing and bundling
 * - Asset management
 * - Module resolution
 * - Build optimization
 */

const path = require('path'); // v18.x built-in
const { getDefaultConfig } = require('metro-config'); // v0.75.0

module.exports = (async () => {
  const {
    resolver: { sourceExts, assetExts },
  } = await getDefaultConfig();

  return {
    resolver: {
      // Source file extensions for TypeScript and JavaScript
      sourceExts: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json'
      ],

      // Asset extensions including audio formats for cry analysis
      assetExts: [
        ...assetExts,
        'png',
        'jpg',
        'jpeg',
        'gif',
        'wav',
        'mp3',
        'svg',
        'ttf',
        'otf'
      ],

      // Supported platforms
      platforms: ['ios', 'android'],

      // Prevent duplicate React Native instances
      blockList: [
        /node_modules\/.*\/node_modules\/react-native\/.*/,
        /node_modules\/react-native\/Libraries\/.*/
      ],

      // Module resolution for core dependencies
      extraNodeModules: {
        'react-native': path.resolve(__dirname, 'node_modules/react-native'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
        '@react-native-community/audio-toolkit': path.resolve(__dirname, 'node_modules/@react-native-community/audio-toolkit')
      }
    },

    transformer: {
      // Babel transformer configuration
      babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),

      // Asset plugins for SVG support
      assetPlugins: ['react-native-svg-transformer'],

      // Enable Babel runtime for modern JavaScript features
      enableBabelRuntime: true,
      enableBabelRCLookup: true,

      // Production minification settings
      minifierConfig: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      }
    },

    // Build optimization settings
    maxWorkers: 4,
    resetCache: false,
    cacheVersion: '1.0.0',

    // Environment configuration
    environmentVariables: {
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  };
})();