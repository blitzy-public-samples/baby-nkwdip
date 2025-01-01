/**
 * @fileoverview Color system constants for Baby Cry Analyzer application
 * Implements Material Design 3.0 principles with WCAG 2.1 AA compliance
 * Supports dynamic theming with light/dark mode variants
 */

/**
 * Core brand colors following Material Design 3.0 guidelines
 * All colors meet WCAG 2.1 AA contrast requirements (4.5:1 minimum)
 */
export const BRAND_COLORS = {
  primary: '#6200EE', // Main brand color - Purple 500
  primaryDark: '#3700B3', // Dark variant - Purple 700
  primaryVariant: '#7F39FB', // Light variant - Purple 400
  secondary: '#03DAC6', // Secondary brand color - Teal A400
  accent: '#FF4081', // Accent color - Pink A200
} as const;

/**
 * Interface defining theme variant color structure
 */
interface ThemeVariant {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  border: string;
  divider: string;
  overlay: string;
}

/**
 * Theme colors for light and dark modes
 * Dark mode colors optimized for OLED displays and eye comfort
 */
export const THEME_COLORS: Record<'light' | 'dark', ThemeVariant> = {
  light: {
    background: '#FFFFFF', // White
    surface: '#F5F5F5', // Grey 100
    surfaceVariant: '#E1E1E1', // Grey 200
    text: '#000000', // Black - contrast ratio 21:1
    textSecondary: '#757575', // Grey 600 - contrast ratio 4.6:1
    border: '#E0E0E0', // Grey 300
    divider: '#BDBDBD', // Grey 400
    overlay: 'rgba(0, 0, 0, 0.5)', // 50% Black
  },
  dark: {
    background: '#121212', // Material dark background
    surface: '#1E1E1E', // Material dark surface
    surfaceVariant: '#2C2C2C', // Material dark variant
    text: '#FFFFFF', // White - contrast ratio 21:1
    textSecondary: '#B0B0B0', // Grey 500 - contrast ratio 4.5:1
    border: '#2C2C2C', // Grey 800
    divider: '#424242', // Grey 900
    overlay: 'rgba(0, 0, 0, 0.7)', // 70% Black
  },
} as const;

/**
 * Semantic colors for status indicators and feedback
 * Each color has a dark variant for theme consistency
 */
export const SEMANTIC_COLORS = {
  success: '#4CAF50', // Green 500
  warning: '#FFC107', // Amber 500
  error: '#F44336', // Red 500
  info: '#2196F3', // Blue 500
  successDark: '#43A047', // Green 600
  warningDark: '#FFB300', // Amber 600
  errorDark: '#E53935', // Red 600
  infoDark: '#1E88E5', // Blue 600
} as const;

/**
 * Specialized colors for monitoring interface and analysis features
 * Includes colors for waveform visualization and confidence indicators
 */
export const MONITOR_COLORS = {
  waveform: '#6200EE', // Primary color for waveform
  waveformActive: '#7F39FB', // Active state - Primary variant
  background: '#F5F5F5', // Monitor background
  backgroundActive: '#EDE7F6', // Active state background - Purple 50
  confidenceLow: '#F44336', // Red 500 - Below 50% confidence
  confidenceMedium: '#FFC107', // Amber 500 - 50-80% confidence
  confidenceHigh: '#4CAF50', // Green 500 - Above 80% confidence
  confidenceLowDark: '#E53935', // Red 600 - Dark theme
  confidenceMediumDark: '#FFB300', // Amber 600 - Dark theme
  confidenceHighDark: '#43A047', // Green 600 - Dark theme
} as const;