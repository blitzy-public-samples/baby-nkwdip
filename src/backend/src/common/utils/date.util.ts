import { 
  format, 
  addDays, 
  subDays, 
  differenceInDays, 
  isValid, 
  parseISO, 
  formatISO 
} from 'date-fns'; // ^2.30.0

/**
 * Memoization decorator for caching function results
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();

  descriptor.value = function(...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
  return descriptor;
}

/**
 * Formats a date into a standardized string representation with locale and timezone support
 * @param date The date to format
 * @param formatString The desired format pattern
 * @param locale Optional locale for internationalization
 * @param timezone Optional timezone for conversion
 * @returns Formatted date string with timezone and locale consideration
 * @throws Error if date is invalid
 */
@memoize
export function formatDate(
  date: Date,
  formatString: string,
  locale?: string,
  timezone?: string
): string {
  if (!isValid(date)) {
    throw new Error('Invalid date provided');
  }

  try {
    const dateToFormat = timezone 
      ? new Date(date.toLocaleString('en-US', { timeZone: timezone }))
      : date;

    return format(dateToFormat, formatString, {
      locale: locale ? require(`date-fns/locale/${locale}`) : undefined
    });
  } catch (error) {
    throw new Error(`Error formatting date: ${error.message}`);
  }
}

/**
 * Calculates age in months from birthdate with timezone consideration
 * @param birthDate The birth date to calculate from
 * @param timezone Optional timezone for calculation
 * @returns Age in months with decimal precision
 * @throws Error if birthDate is invalid or in future
 */
@memoize
export function calculateAge(birthDate: Date, timezone?: string): number {
  if (!isValid(birthDate)) {
    throw new Error('Invalid birth date provided');
  }

  const now = timezone 
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();

  if (birthDate > now) {
    throw new Error('Birth date cannot be in the future');
  }

  const diffDays = differenceInDays(now, birthDate);
  return Number((diffDays / 30.44).toFixed(2)); // Average month length
}

/**
 * Checks if a date falls within the 24-month retention period with timezone awareness
 * @param date The date to check
 * @param timezone Optional timezone for comparison
 * @returns True if within retention period
 * @throws Error if date is invalid
 */
@memoize
export function isWithinRetentionPeriod(date: Date, timezone?: string): boolean {
  if (!isValid(date)) {
    throw new Error('Invalid date provided');
  }

  const now = timezone 
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();

  const retentionStart = subDays(now, 730); // 24 months * 30.44 days
  return date >= retentionStart && date <= now;
}

/**
 * Generates start and end dates for a specified time range with timezone support
 * @param range Predefined range ('day', 'week', 'month', 'year') or number of days
 * @param timezone Optional timezone for range calculation
 * @param inclusive Whether to include the end date in the range
 * @returns Object containing start and end dates with timezone
 * @throws Error if range is invalid
 */
@memoize
export function getDateRange(
  range: string,
  timezone?: string,
  inclusive: boolean = true
): { startDate: Date; endDate: Date; timezone: string } {
  const now = timezone 
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();

  let startDate: Date;
  switch (range.toLowerCase()) {
    case 'day':
      startDate = subDays(now, 1);
      break;
    case 'week':
      startDate = subDays(now, 7);
      break;
    case 'month':
      startDate = subDays(now, 30);
      break;
    case 'year':
      startDate = subDays(now, 365);
      break;
    default:
      const days = parseInt(range);
      if (isNaN(days)) {
        throw new Error('Invalid range provided');
      }
      startDate = subDays(now, days);
  }

  const endDate = inclusive ? now : subDays(now, 1);
  return { startDate, endDate, timezone: timezone || 'UTC' };
}

/**
 * Validates and parses a date string into a Date object with timezone handling
 * @param dateString The date string to validate
 * @param timezone Optional timezone for parsing
 * @param format Optional expected format for validation
 * @returns Parsed Date object or null if invalid
 */
@memoize
export function validateDateString(
  dateString: string,
  timezone?: string,
  format?: string
): Date | null {
  try {
    const sanitizedString = dateString.trim();
    let parsedDate: Date;

    if (format) {
      // Parse with specific format
      parsedDate = parseISO(sanitizedString);
      const formattedBack = formatISO(parsedDate);
      if (formattedBack !== sanitizedString) {
        return null;
      }
    } else {
      // Default ISO parsing
      parsedDate = parseISO(sanitizedString);
    }

    if (!isValid(parsedDate)) {
      return null;
    }

    // Apply timezone if specified
    if (timezone) {
      parsedDate = new Date(parsedDate.toLocaleString('en-US', { timeZone: timezone }));
    }

    return parsedDate;
  } catch (error) {
    return null;
  }
}