/**
 * @fileoverview Typography constants for Baby Cry Analyzer application
 * Implements Material Design 3.0 typography standards with WCAG 2.1 AA compliance
 * Supports multiple languages: English, Spanish, and Mandarin
 */

/**
 * Font family definitions with multi-language support and fallbacks
 * Primary font: Roboto (Material Design recommended)
 * Fallback chain ensures consistent rendering across platforms
 */
export const FONT_FAMILY = {
  REGULAR: "'Roboto-Regular', 'System'",
  MEDIUM: "'Roboto-Medium', 'System'",
  BOLD: "'Roboto-Bold', 'System'",
  FALLBACK: "'-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Arial', 'sans-serif'"
} as const;

/**
 * Font size scale following Material Design type scale
 * Base size (REGULAR) is 16px for optimal readability
 * Scale factor of 1.2 maintains harmonious size progression
 * All sizes support dynamic scaling for accessibility
 */
export const FONT_SIZE = {
  TINY: 12, // Secondary information, footnotes
  SMALL: 14, // Supporting text, captions
  REGULAR: 16, // Body text, primary content
  MEDIUM: 18, // Subheadings, important content
  LARGE: 20, // Section headers
  XLARGE: 24, // Major headings
  XXLARGE: 32, // Hero text, primary headlines
  SCALE_FACTOR: 1.2 // For responsive scaling calculations
} as const;

/**
 * Font weight definitions with platform-specific optimizations
 * Following Material Design weight guidelines for optimal contrast
 * Platform-specific adjustments ensure consistent visual weight
 */
export const FONT_WEIGHT = {
  REGULAR: '400',
  MEDIUM: '500',
  BOLD: '700',
  PLATFORM_SPECIFIC: {
    ios: {
      REGULAR: '400',
      MEDIUM: '600', // Adjusted for iOS rendering
      BOLD: '700'
    },
    android: {
      REGULAR: '400',
      MEDIUM: '500',
      BOLD: '700'
    }
  }
} as const;

/**
 * Line height multipliers for optimal readability
 * Values calibrated for different content densities and languages
 * Multilingual support with adjusted values for specific scripts
 */
export const LINE_HEIGHT = {
  TIGHT: 1.2, // Headings, compact displays
  REGULAR: 1.5, // Body text, general content
  LOOSE: 1.8, // Enhanced readability for dense content
  MULTILINGUAL: {
    en: 1.5, // English
    es: 1.6, // Spanish (slightly increased for accents)
    zh: 1.7  // Mandarin (adjusted for character complexity)
  }
} as const;

/**
 * Letter spacing adjustments for optimal legibility
 * Values in pixels, negative values for tighter spacing
 * Language-specific adjustments for different writing systems
 */
export const LETTER_SPACING = {
  TIGHT: -0.5, // Headlines, display text
  REGULAR: 0, // Body text, general content
  WIDE: 0.5, // All-caps text, emphasis
  LANGUAGE_SPECIFIC: {
    en: 0, // English (baseline)
    es: 0.2, // Spanish (adjusted for diacritics)
    zh: 0.3 // Mandarin (adjusted for character density)
  }
} as const;