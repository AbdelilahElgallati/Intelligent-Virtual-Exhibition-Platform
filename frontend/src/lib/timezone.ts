import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Ensures a date string is treated as UTC if it lacks a timezone offset.
 */
function toUTCDate(date: string | number | Date): Date {
  if (!date) return new Date(NaN); // Results in Invalid Date
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(date) && !date.includes('Z') && !date.includes('+')) {
    return new Date(date + 'Z');
  }
  return new Date(date);
}

/**
 * Formats a date (UTC string, number, or Date) into a specific timezone.
 * Returns a string (e.g., "10:30 AM" or "Mar 24, 2026").
 */
export function formatInTZ(
  date: string | number | Date,
  timeZone: string,
  formatStr: string = 'MMM d, yyyy h:mm a'
): string {
  if (!date) return '';
  try {
    const d = toUTCDate(date);
    if (isNaN(d.getTime())) return '';
    return formatInTimeZone(d, timeZone, formatStr);
  } catch (error) {
    console.error('Timezone formatting error:', error);
    const d = toUTCDate(date);
    if (isNaN(d.getTime())) return '';
    // Fallback to local time if timezone is invalid
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(d);
  }
}

/**
 * Converts a localized date/time string (e.g., "2026-03-24T00:00:00") in a 
 * specific timezone into a UTC Date object.
 */
export function zonedToUtc(dateStr: string, timeZone: string): Date {
  return fromZonedTime(dateStr, timeZone);
}

/**
 * Gets the current time in a specific timezone, formatted as ISO.
 */
export function getNowInTZ(timeZone: string): Date {
  return toZonedTime(new Date(), timeZone);
}

/**
 * Gets the today's date string (YYYY-MM-DD) in a specific timezone.
 */
export function getTodayInTZ(timeZone: string): string {
  return formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd');
}

/**
 * Formats a short time string from a UTC date.
 */
export function formatTimeInTZ(date: string | number | Date, timeZone: string): string {
  return formatInTZ(date, timeZone, 'h:mm a');
}

/**
 * Returns the current user's local timezone (e.g. "Africa/Casablanca", "Europe/London")
 * using the native browser Intl API.
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    return 'UTC';
  }
}

