/**
 * @fileoverview Root component of the Baby Cry Analyzer application that initializes
 * core providers and configuration for the application.
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider } from 'styled-components';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from 'react-error-boundary';

import AppNavigator from './navigation/AppNavigator';
import { useTheme } from './hooks/useTheme';
import { store, persistor } from './store/store';
import Loading from './components/common/Loading';

/**
 * Error fallback component for critical errors
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div role="alert" style={{ padding: 20 }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

/**
 * Root application component that initializes core providers and configuration
 */
const App: React.FC = () => {
  const { theme, isDarkMode } = useTheme();

  // Configure app-wide accessibility settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Set theme-based accessibility properties
      document.documentElement.setAttribute(
        'data-theme',
        isDarkMode ? 'dark' : 'light'
      );
      
      // Configure reduced motion preferences
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      
      document.documentElement.setAttribute(
        'data-reduced-motion',
        prefersReducedMotion ? 'true' : 'false'
      );
    }
  }, [isDarkMode]);

  // Handle critical errors
  const handleError = (error: Error) => {
    console.error('Critical application error:', error);
    // Implement error reporting service here
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <Provider store={store}>
        <PersistGate
          loading={<Loading size="large" text="Loading application..." />}
          persistor={persistor}
        >
          <ThemeProvider theme={theme}>
            <SafeAreaProvider>
              <AppNavigator />
            </SafeAreaProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

App.displayName = 'App';

export default App;