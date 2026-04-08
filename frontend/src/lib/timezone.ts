import { format, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Gets the user's browser timezone or defaults to UTC.
 */
export function getUserTimezone(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('user_timezone');
    if (stored) return stored;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * Formats a date as YYYY-MM-DD in a specific timezone.
 */
export function toYmdInEventTz(date: string | number | Date, timeZone: string): string {
  return formatInTimeZone(new Date(date), timeZone, 'yyyy-MM-dd');
}

/**
 * Converts a string date/time in a specific timezone to a UTC Date.
 * e.g. ("2025-06-15T14:00:00", "Africa/Casablanca") -> UTC Date
 */
export function zonedToUtc(dateTimeStr: string, timeZone: string): Date {
  return fromZonedTime(dateTimeStr, timeZone);
}

/**
 * Formats a UTC date into a specific timezone.
 * Supports both standard Intl.DateTimeFormatOptions or a date-fns format string.
 */
export function formatInTZ(
  date: string | number | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions | string = {
    dateStyle: 'medium',
    timeStyle: 'short'
  },
  locale = 'en-GB'
): string {
  const d = typeof date === 'string' ? parseISO(date) : new Date(date);
  
  if (typeof options === 'string') {
    return formatInTimeZone(d, timeZone, options);
  }

  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, options).format(d);
  }
}

/**
 * Convenience wrapper for formatting in the user's local timezone.
 */
export function formatInUserTZ(
  date: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
  locale?: string,
  overrideTz?: string
): string {
  const tz = overrideTz || getUserTimezone();
  return formatInTZ(date, tz, options, locale);
}

/**
 * Returns the "Base Date" for an event's schedule.
 * This is the calendar date of the event's start_date in its own timezone.
 * Resolves the "Day Shift" bug where midnight UTC might be yesterday in local time.
 */
export function getEventBaseDate(startDate: string | number | Date, eventTimeZone: string): Date {
  const d = new Date(startDate);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: eventTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const raw = parts.find((p) => p.type === type)?.value;
    return Number(raw || 0);
  };

  // Create a UTC Date that represents midnight on that calendar day in the target timezone
  // This is a "conceptual" Date object used for subsequent arithmetic.
  return new Date(Date.UTC(read('year'), read('month') - 1, read('day'), 0, 0, 0, 0));
}

/**
 * Calculates a specific day's date based on day number (1-based).
 */
export function getEventDayDate(startDate: string | number | Date, eventTimeZone: string, dayNumber: number): Date {
  const baseDate = getEventBaseDate(startDate, eventTimeZone);
  // Add days in UTC to avoid local timezone jumps
  const dayDate = new Date(baseDate.getTime() + (dayNumber - 1) * 24 * 60 * 60 * 1000);
  return dayDate;
}

/**
 * Formats an ISO string to a display time with timezone label.
 * e.g. "2025-06-15T13:00:00Z" -> "15:00 (Paris, GMT+2)"
 */
export function formatWithTzLabel(
  date: string | number | Date,
  timeZone?: string,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false }
): string {
  const tz = timeZone || getUserTimezone();
  const formattedTime = formatInTZ(date, tz, options);
  
  // Get short timezone name / offset
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { 
      timeZone: tz, 
      timeZoneName: 'short' 
    }).formatToParts(new Date(date));
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return `${formattedTime} (${tzName})`;
  } catch {
    return formattedTime;
  }
}
