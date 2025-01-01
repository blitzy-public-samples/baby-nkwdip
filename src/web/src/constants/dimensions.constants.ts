/**
 * @fileoverview Defines standardized dimensions, spacing, and layout measurements
 * following Material Design 3.0 specifications and WCAG 2.1 AA accessibility requirements.
 * @version 1.0.0
 */

/**
 * Base unit for Material Design spacing system (in pixels)
 * Used as the foundation for calculating consistent spacing throughout the application
 */
const SPACING_BASE = 8;

/**
 * Minimum touch target size (in pixels) as per WCAG 2.1 AA guidelines
 * Ensures interactive elements are large enough for reliable touch interaction
 */
const TOUCH_TARGET_MIN = 44;

/**
 * Standardized spacing values following Material Design 3.0 spacing system
 * Used for margins, padding, and layout spacing throughout the application
 */
export const SPACING: Record<string, number> = {
  xs: SPACING_BASE / 2, // 4px - Compact spacing for tight layouts
  sm: SPACING_BASE,     // 8px - Standard small spacing
  md: SPACING_BASE * 2, // 16px - Medium spacing for general layout
  lg: SPACING_BASE * 3, // 24px - Large spacing for section separation
  xl: SPACING_BASE * 4, // 32px - Extra large spacing for major sections
} as const;

/**
 * Border radius values adhering to Material Design 3.0 shape system
 * Provides consistent component shape throughout the application
 */
export const BORDER_RADIUS: Record<string, number> = {
  sm: 4,    // Subtle rounding for small elements
  md: 8,    // Standard rounding for most components
  lg: 16,   // Prominent rounding for featured elements
  full: 9999, // Full rounding for circular elements
} as const;

/**
 * Touch target sizes ensuring WCAG 2.1 AA compliance
 * Minimum size of 44x44 pixels for all interactive elements
 */
export const TOUCH_TARGET: Record<string, number> = {
  min: TOUCH_TARGET_MIN, // 44px - WCAG 2.1 AA minimum requirement
  recommended: 48,       // 48px - Material Design recommended size
} as const;

/**
 * Standardized icon sizes following Material Design icon system
 * Ensures consistent icon presentation across the application
 */
export const ICON_SIZE: Record<string, number> = {
  sm: 16, // Small icons for dense layouts
  md: 24, // Standard icon size
  lg: 32, // Large icons for emphasis
} as const;

/**
 * Standard component heights ensuring touch accessibility
 * and visual consistency across the application
 */
export const COMPONENT_HEIGHT: Record<string, number> = {
  sm: 32,              // Small height for dense layouts
  md: TOUCH_TARGET_MIN, // Standard height meeting accessibility requirements
  lg: 56,              // Large height for prominent components
} as const;