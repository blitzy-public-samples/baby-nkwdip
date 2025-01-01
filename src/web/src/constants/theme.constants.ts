/**
 * @fileoverview Core theme configuration for Baby Cry Analyzer application
 * Implements Material Design 3.0 principles with WCAG 2.1 AA compliance
 * Version: 1.0.0
 */

import {
  BRAND_COLORS,
  THEME_COLORS,
  SEMANTIC_COLORS,
  MONITOR_COLORS,
} from './colors.constants';

/**
 * Typography scale following Material Design type system
 * All values support dynamic text sizing and maintain readability
 */
const typography = {
  fontFamily: {
    primary: 'Roboto, system-ui, sans-serif',
    monospace: 'Roboto Mono, monospace',
  },
  fontSize: {
    h1: '2.5rem', // 40px
    h2: '2rem',   // 32px
    h3: '1.75rem', // 28px
    h4: '1.5rem',  // 24px
    body1: '1rem',  // 16px
    body2: '0.875rem', // 14px
    caption: '0.75rem', // 12px
  },
  fontWeight: {
    light: 300,
    regular: 400,
    medium: 500,
    bold: 700,
  },
  lineHeight: {
    h1: 1.2,
    h2: 1.3,
    h3: 1.4,
    h4: 1.4,
    body1: 1.5,
    body2: 1.5,
    caption: 1.4,
  },
  letterSpacing: {
    h1: '-0.5px',
    h2: '-0.25px',
    h3: '0px',
    h4: '0.25px',
    body1: '0.15px',
    body2: '0.25px',
    caption: '0.4px',
  },
} as const;

/**
 * Spacing system using 8pt grid
 * Maintains consistent rhythm throughout the interface
 */
const spacing = {
  xxs: '4px',
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  xxxl: '64px',
} as const;

/**
 * Elevation system using Material Design principles
 * Provides consistent shadow depths across components
 */
const elevation = {
  none: 'none',
  low: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
  medium: '0px 3px 6px rgba(0, 0, 0, 0.15), 0px 2px 4px rgba(0, 0, 0, 0.12)',
  high: '0px 10px 20px rgba(0, 0, 0, 0.15), 0px 3px 6px rgba(0, 0, 0, 0.10)',
  modal: '0px 15px 35px rgba(0, 0, 0, 0.2), 0px 5px 15px rgba(0, 0, 0, 0.12)',
} as const;

/**
 * Animation system for consistent motion across the application
 * Supports reduced motion preferences
 */
const animation = {
  duration: {
    instant: '0ms',
    fast: '150ms',
    normal: '300ms',
    slow: '450ms',
    deliberate: '600ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)',
  },
  reducedMotion: {
    duration: '0ms',
    easing: 'linear',
  },
} as const;

/**
 * Component-specific styling following Material Design guidelines
 * Ensures consistent component appearance and behavior
 */
const components = {
  button: {
    borderRadius: '4px',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.body1,
    fontWeight: typography.fontWeight.medium,
    transition: `all ${animation.duration.fast} ${animation.easing.standard}`,
  },
  input: {
    borderRadius: '4px',
    borderWidth: '1px',
    padding: spacing.sm,
    fontSize: typography.fontSize.body1,
    lineHeight: typography.lineHeight.body1,
    transition: `border-color ${animation.duration.fast} ${animation.easing.standard}`,
  },
  card: {
    borderRadius: '8px',
    padding: spacing.md,
    transition: `box-shadow ${animation.duration.normal} ${animation.easing.standard}`,
  },
  monitor: {
    waveformHeight: '120px',
    confidenceBarHeight: '8px',
    borderRadius: '12px',
    padding: spacing.md,
  },
} as const;

/**
 * Default light theme configuration
 * Implements Material Design 3.0 with WCAG 2.1 AA compliance
 */
export const DEFAULT_THEME = {
  colors: {
    ...BRAND_COLORS,
    ...THEME_COLORS.light,
    ...SEMANTIC_COLORS,
    monitor: MONITOR_COLORS,
  },
  typography,
  spacing,
  elevation,
  animation,
  components,
} as const;

/**
 * Dark theme configuration
 * Optimized for OLED displays and reduced eye strain
 */
export const DARK_THEME = {
  colors: {
    ...BRAND_COLORS,
    ...THEME_COLORS.dark,
    ...{
      success: SEMANTIC_COLORS.successDark,
      warning: SEMANTIC_COLORS.warningDark,
      error: SEMANTIC_COLORS.errorDark,
      info: SEMANTIC_COLORS.infoDark,
    },
    monitor: {
      ...MONITOR_COLORS,
      confidenceLow: MONITOR_COLORS.confidenceLowDark,
      confidenceMedium: MONITOR_COLORS.confidenceMediumDark,
      confidenceHigh: MONITOR_COLORS.confidenceHighDark,
    },
  },
  typography,
  spacing,
  elevation,
  animation,
  components,
} as const;

/**
 * High contrast theme overrides for enhanced accessibility
 * Meets WCAG 2.1 AAA contrast requirements
 */
export const HIGH_CONTRAST_THEME = {
  colors: {
    ...THEME_COLORS.light,
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#000000',
    textSecondary: '#000000',
    border: '#000000',
    divider: '#000000',
    primary: '#000000',
    secondary: '#000000',
    error: '#CC0000',
    success: '#006600',
    warning: '#CC6600',
    info: '#000066',
  },
} as const;

/**
 * Type definitions for theme configuration
 */
export type Theme = typeof DEFAULT_THEME;
export type ThemeColors = typeof DEFAULT_THEME.colors;