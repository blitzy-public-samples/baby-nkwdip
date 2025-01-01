import i18next from 'i18next'; // ^22.0.0
import { initReactI18next } from 'react-i18next'; // ^12.0.0
import LanguageDetector from 'i18next-browser-languagedetector'; // ^7.0.0
import HttpBackend from 'i18next-http-backend'; // ^2.0.0

// Import language resources
import * as en from './en.json';
import * as es from './es.json';
import * as zh from './zh.json';

// Constants
export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh'] as const;
const DEFAULT_NAMESPACE = 'common';
const FALLBACK_LANGUAGE = 'en';
const PRELOAD_NAMESPACES = ['common', 'auth', 'aria'];
const RTL_LANGUAGES = ['ar', 'he'];

// Type definitions
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
type LanguageResources = {
  [key in SupportedLanguage]: typeof en;
};

// Language resources configuration
const resources: LanguageResources = {
  en,
  es,
  zh
};

// Initialize i18next configuration
const initI18n = async (): Promise<typeof i18next> => {
  await i18next
    .use(initReactI18next)
    .use(LanguageDetector)
    .use(HttpBackend)
    .init({
      // Core configuration
      resources,
      fallbackLng: FALLBACK_LANGUAGE,
      defaultNS: DEFAULT_NAMESPACE,
      ns: PRELOAD_NAMESPACES,
      
      // Language detection configuration
      detection: {
        order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
        lookupQuerystring: 'lang',
        lookupCookie: 'i18next',
        lookupLocalStorage: 'i18nextLng',
        caches: ['localStorage', 'cookie'],
      },

      // Interpolation configuration
      interpolation: {
        escapeValue: false, // React handles escaping
        format: (value, format, lng) => {
          if (format === 'uppercase') return value.toUpperCase();
          if (format === 'lowercase') return value.toLowerCase();
          return value;
        },
      },

      // Accessibility configuration
      react: {
        useSuspense: false,
        bindI18n: 'languageChanged loaded',
        bindI18nStore: 'added removed',
        transSupportBasicHtmlNodes: true,
        transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'span'],
      },

      // Performance configuration
      load: 'languageOnly',
      preload: SUPPORTED_LANGUAGES,
      
      // Backend configuration for lazy loading
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
        addPath: '/locales/add/{{lng}}/{{ns}}',
        allowMultiLoading: false,
        crossDomain: false,
      },

      // Debug configuration (disabled in production)
      debug: process.env.NODE_ENV === 'development',
      
      // Missing key handling
      saveMissing: process.env.NODE_ENV === 'development',
      missingKeyHandler: (lng, ns, key) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Missing translation key: ${key} for language: ${lng} in namespace: ${ns}`);
        }
      },
    });

  // Add ARIA label support
  i18next.services.formatter?.add('aria', (value, lng, options) => {
    return `${value} (${options?.role || 'button'})`;
  });

  // Add RTL support
  i18next.services.formatter?.add('direction', (_, lng) => {
    return RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr';
  });

  // Add date/time formatting
  i18next.services.formatter?.add('date', (value, lng, options) => {
    return new Intl.DateTimeFormat(lng, options).format(value);
  });

  return i18next;
};

// Export configured i18next instance
export const i18n = initI18n();

// Helper functions
export const getLanguageDirection = (language: string): 'rtl' | 'ltr' => {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
};

export const isValidLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

// Type exports for TypeScript support
export type { SupportedLanguage };

export default i18n;