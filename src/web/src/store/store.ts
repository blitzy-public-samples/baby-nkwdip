/**
 * @fileoverview Advanced Redux store configuration with enhanced security, performance optimization,
 * and real-time processing capabilities for the Baby Cry Analyzer application
 * @version 1.0.0
 * Library versions:
 * - @reduxjs/toolkit@1.9.0
 * - redux-saga@1.2.0
 * - redux-persist@6.0.0
 * - @sentry/react@7.0.0
 */

import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { 
  persistStore, 
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStateSyncMiddleware } from 'redux-state-sync';
import { createReduxEnhancer } from '@sentry/react';
import rootReducer from './reducers/root.reducer';
import rootSaga from './sagas/root.saga';

// Encryption transform for secure state persistence
import { encryptTransform } from 'redux-persist-transform-encrypt';

// Constants for store configuration
const PERSIST_KEY = 'baby-cry-analyzer';
const REDUX_STATE_SYNC_CONFIG = {
  blacklist: ['temp', 'audio.waveform']
};

// Configure encryption transform
const encryptionTransform = encryptTransform({
  secretKey: process.env.REDUX_ENCRYPTION_KEY || 'default-key',
  onError: (error) => {
    console.error('State encryption error:', error);
  }
});

// Configure state migrations
const migrations = {
  0: (state: any) => ({
    ...state,
    _persist: { version: 1 }
  }),
  1: (state: any) => ({
    ...state,
    audio: {
      ...state.audio,
      qualityMetrics: null
    }
  })
};

// Configure persistence
const persistConfig = {
  key: PERSIST_KEY,
  version: 1,
  storage: AsyncStorage,
  transforms: [encryptionTransform],
  whitelist: ['auth', 'baby', 'history'],
  blacklist: ['temp', 'error', 'audio.waveform'],
  migrate: createMigrate(migrations, { debug: process.env.NODE_ENV === 'development' }),
  timeout: 10000,
  debug: process.env.NODE_ENV === 'development',
  serialize: true,
  writeFailHandler: (error: Error) => {
    console.error('State persistence error:', error);
  }
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure Sentry monitoring
const sentryEnhancer = createReduxEnhancer({
  actionTransformer: (action) => ({
    ...action,
    timestamp: Date.now()
  })
});

// Configure saga middleware with monitoring
const sagaMiddleware = createSagaMiddleware({
  onError: (error, { sagaStack }) => {
    console.error('Saga error:', error, sagaStack);
  }
});

/**
 * Configures and creates the Redux store with enhanced features
 */
export const configureAppStore = () => {
  const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
          'audio/updateWaveform'
        ],
        ignoredPaths: ['temp', 'audio.waveform']
      },
      thunk: {
        extraArgument: {
          api: process.env.API_BASE_URL
        }
      },
      immutableCheck: {
        warnAfter: 100
      }
    }).concat(
      sagaMiddleware,
      createStateSyncMiddleware(REDUX_STATE_SYNC_CONFIG)
    ),
    devTools: process.env.NODE_ENV !== 'production',
    enhancers: [sentryEnhancer],
    preloadedState: undefined
  });

  // Run root saga
  sagaMiddleware.run(rootSaga);

  // Enable hot module replacement for reducers
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./reducers/root.reducer', () => {
      store.replaceReducer(persistReducer(persistConfig, rootReducer));
    });
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Create persistor
export const persistor = persistStore(store, null, () => {
  console.log('Rehydration completed');
});

// Export store configuration for testing
export const storeConfig = {
  middleware: [sagaMiddleware],
  enhancers: [sentryEnhancer]
};

// Export store types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export default store
export default store;