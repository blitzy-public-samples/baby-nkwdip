import { format, isValid, parseISO, differenceInDays, addMonths, subMonths } from 'date-fns'; // ^2.30.0

// Type definitions
type DateInput = Date | string | null | undefined;
type DateGroupItem = { timestamp: string | Date };
type DateRange = { startDate: Date; endDate: Date; isValid: boolean };

// Constants
const RETENTION_MONTHS = 24;
const DATE_CACHE_SIZE = 100;
const VALID_DATE_RANGE = {
  min: new Date('1900-01-01'),
  max: new Date('2100-12-31'),
};

// Memoization cache for date formatting
const formatCache = new Map<string, string>();
let cacheHits = 0;

/**
 * Type-safe date formatting utility with locale support and performance optimization
 * @param date - Input date to format
 * @param formatString - Date format pattern
 * @param locale - Optional locale for formatting
 * @returns Formatted date string or empty string for invalid input
 */
export const formatDate = (
  date: DateInput,
  formatString: string,
  locale?: Locale
): string => {
  try {
    if (!date) return '';

    // Generate cache key
    const cacheKey = `${date}-${formatString}-${locale?.code || 'default'}`;

    // Check cache first
    if (formatCache.has(cacheKey)) {
      cacheHits++;
      return formatCache.get(cacheKey)!;
    }

    // Parse string dates
    const dateObj = typeof date === 'string' ? parseISO(date) : date;

    if (!isValid(dateObj)) return '';

    // Format date
    const formatted = format(dateObj, formatString, { locale });

    // Cache result if cache isn't too large
    if (formatCache.size < DATE_CACHE_SIZE) {
      formatCache.set(cacheKey, formatted);
    }

    return formatted;
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

/**
 * Enhanced date validation with comprehensive type checking
 * @param value - Value to validate as date
 * @returns Boolean indicating if value is a valid date
 */
export const isValidDate = (value: any): boolean => {
  try {
    if (!value) return false;

    // Handle Date objects
    if (value instanceof Date) {
      return isValid(value) && 
             value >= VALID_DATE_RANGE.min && 
             value <= VALID_DATE_RANGE.max;
    }

    // Handle ISO strings
    if (typeof value === 'string') {
      const parsed = parseISO(value);
      return isValid(parsed) && 
             parsed >= VALID_DATE_RANGE.min && 
             parsed <= VALID_DATE_RANGE.max;
    }

    return false;
  } catch (error) {
    console.error('Date validation error:', error);
    return false;
  }
};

/**
 * Calculates date ranges with timezone handling
 * @param months - Number of months to include in range
 * @param timezone - Optional timezone identifier
 * @returns Object containing start and end dates with validation status
 */
export const getDateRange = (months: number, timezone?: string): DateRange => {
  try {
    if (months <= 0) {
      throw new Error('Months must be positive');
    }

    const now = new Date();
    const startDate = subMonths(now, months);
    const endDate = now;

    // Validate range
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return { startDate: now, endDate: now, isValid: false };
    }

    return {
      startDate,
      endDate,
      isValid: true
    };
  } catch (error) {
    console.error('Date range calculation error:', error);
    return {
      startDate: new Date(),
      endDate: new Date(),
      isValid: false
    };
  }
};

/**
 * Groups items by date with custom key formatting and performance optimization
 * @param items - Array of items with timestamps
 * @param groupingFormat - Optional format for group keys
 * @returns Map of items grouped by formatted date
 */
export const groupByDate = <T extends DateGroupItem>(
  items: T[],
  groupingFormat: string = 'yyyy-MM-dd'
): Map<string, T[]> => {
  try {
    if (!Array.isArray(items)) {
      throw new Error('Items must be an array');
    }

    // Sort items by timestamp
    const sortedItems = [...items].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });

    // Group items
    return sortedItems.reduce((groups, item) => {
      const dateKey = formatDate(item.timestamp, groupingFormat);
      if (!dateKey) return groups;

      const group = groups.get(dateKey) || [];
      group.push(item);
      groups.set(dateKey, group);
      return groups;
    }, new Map<string, T[]>());
  } catch (error) {
    console.error('Date grouping error:', error);
    return new Map<string, T[]>();
  }
};

/**
 * Validates date against retention policy with timezone consideration
 * @param date - Date to validate
 * @param timezone - Optional timezone identifier
 * @returns Boolean indicating if date is within retention period
 */
export const isWithinRetentionPeriod = (
  date: Date | string,
  timezone?: string
): boolean => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    if (!isValidDate(dateObj)) return false;

    const now = new Date();
    const retentionStart = subMonths(now, RETENTION_MONTHS);

    const daysDifference = differenceInDays(now, dateObj);
    return daysDifference <= RETENTION_MONTHS * 30 && daysDifference >= 0;
  } catch (error) {
    console.error('Retention period validation error:', error);
    return false;
  }
};