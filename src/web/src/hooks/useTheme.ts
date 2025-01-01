/**
 * @fileoverview Custom React hook for theme management in Baby Cry Analyzer application
 * Implements Material Design 3.0 with WCAG 2.1 AA compliance and system theme integration
 * Version: 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { DEFAULT_THEME, DARK_THEME } from '../../constants/theme.constants';
import { setSecureItem, getSecureItem } from '../../utils/storage.util';

// Storage key for theme preference
const THEME_STORAGE_KEY = '@theme_preference';

/**
 * Type definitions for theme state management
 */
type ThemePreference = 'light' | 'dark' | 'system';
type ThemeState = typeof DEFAULT_THEME;

/**
 * Custom hook for managing application theme with system integration and persistence
 * @returns Object containing current theme, dark mode status, and theme toggle function
 */
export function useTheme() {
  // Initialize theme state with default light theme
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME);
  const [preference, setPreference] = useState<ThemePreference>('system');
  
  // Get system color scheme
  const systemColorScheme = useColorScheme();
  
  /**
   * Determines if dark mode is currently active
   * Based on either user preference or system setting
   */
  const isDarkMode = preference === 'system' 
    ? systemColorScheme === 'dark'
    : preference === 'dark';

  /**
   * Updates theme based on dark mode status
   */
  const updateTheme = useCallback((isDark: boolean) => {
    setTheme(isDark ? DARK_THEME : DEFAULT_THEME);
  }, []);

  /**
   * Loads saved theme preference from secure storage
   */
  const loadSavedPreference = useCallback(async () => {
    try {
      const savedPreference = await getSecureItem(THEME_STORAGE_KEY);
      if (savedPreference && ['light', 'dark', 'system'].includes(savedPreference)) {
        setPreference(savedPreference);
        if (savedPreference !== 'system') {
          updateTheme(savedPreference === 'dark');
        }
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
      // Fallback to system preference
      setPreference('system');
    }
  }, [updateTheme]);

  /**
   * Toggles between light and dark themes
   * Persists preference in secure storage
   */
  const toggleTheme = useCallback(async () => {
    try {
      const newPreference: ThemePreference = isDarkMode ? 'light' : 'dark';
      await setSecureItem(THEME_STORAGE_KEY, newPreference);
      setPreference(newPreference);
      updateTheme(!isDarkMode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
      // Still update the theme in memory even if storage fails
      updateTheme(!isDarkMode);
    }
  }, [isDarkMode, updateTheme]);

  /**
   * Reset to system theme preference
   */
  const resetToSystemTheme = useCallback(async () => {
    try {
      await setSecureItem(THEME_STORAGE_KEY, 'system');
      setPreference('system');
      updateTheme(systemColorScheme === 'dark');
    } catch (error) {
      console.error('Failed to reset theme preference:', error);
    }
  }, [systemColorScheme, updateTheme]);

  /**
   * Effect to load saved preference on mount
   */
  useEffect(() => {
    loadSavedPreference();
  }, [loadSavedPreference]);

  /**
   * Effect to handle system theme changes when using system preference
   */
  useEffect(() => {
    if (preference === 'system') {
      updateTheme(systemColorScheme === 'dark');
    }
  }, [systemColorScheme, preference, updateTheme]);

  return {
    theme,
    isDarkMode,
    toggleTheme,
    resetToSystemTheme,
    currentPreference: preference,
  };
}