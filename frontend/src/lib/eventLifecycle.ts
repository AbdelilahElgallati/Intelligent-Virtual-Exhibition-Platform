import { Event, EventScheduleDay, EventScheduleSlot } from '@/types/event';
import { getUserTimezone } from './timezone';

export type EventLifecycleStatus = 'upcoming' | 'live' | 'ended';

export interface EventLifecycleSnapshot {
    status: EventLifecycleStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    nextSlotStart: Date | null;
    activeSlotLabel: string | null;
    source: 'schedule' | 'dates';
    hasScheduleSlots: boolean;
    scheduleSlotCount: number;
    withinScheduleWindow: boolean;
    /** True only in gaps between scheduled slots (after a slot has started); not before the first slot. */
    betweenSlots: boolean;
}

interface SlotWindow {
    start: Date;
    end: Date;
    label: string;
}

interface TimezoneParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function hasExplicitTime(value: string): boolean {
    return /[T\s]\d{1,2}:\d{2}/.test(value);
}

function parseDate(value: unknown, boundary: 'start' | 'end' = 'start'): Date | null {
    if (!value) return null;
    const raw = String(value);
    const d = new Date(raw);
    if (!isValidDate(d)) return null;

    if (!hasExplicitTime(raw)) {
        if (boundary === 'end') {
            d.setHours(23, 59, 59, 999);
        } else {
            d.setHours(0, 0, 0, 0);
        }
    }

    return isValidDate(d) ? d : null;
}

function parseTimeToMinutes(value?: string): number | null {
    if (!value) return null;
    const [h, m] = value.split(':').map((p) => Number(p));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function parseScheduleDays(event: Event): EventScheduleDay[] {
    if (Array.isArray(event.schedule_days) && event.schedule_days.length > 0) {
        return event.schedule_days;
    }

    if (Array.isArray(event.event_timeline)) {
        return event.event_timeline;
    }

    if (!event.event_timeline || typeof event.event_timeline !== 'string') {
        return [];
    }

    try {
        const parsed = JSON.parse(event.event_timeline);
        return Array.isArray(parsed) ? (parsed as EventScheduleDay[]) : [];
    } catch {
        return [];
    }
}

function getEventTimezone(event: Event): string {
    return event.event_timezone || getUserTimezone();
}

function getDatePartsInTimezone(value: Date, timeZone: string): TimezoneParts {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(value);
    const read = (type: Intl.DateTimeFormatPartTypes): number => {
        const raw = parts.find((p) => p.type === type)?.value;
        return Number(raw || 0);
    };

    return {
        year: read('year'),
        month: read('month'),
        day: read('day'),
        hour: read('hour'),
        minute: read('minute'),
        second: read('second'),
    };
}

function zonedDateTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    timeZone: string,
): Date {
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    let guess = targetUtc;

    for (let i = 0; i < 4; i += 1) {
        const asTz = getDatePartsInTimezone(new Date(guess), timeZone);
        const asUtc = Date.UTC(asTz.year, asTz.month - 1, asTz.day, asTz.hour, asTz.minute, asTz.second, 0);
        const delta = targetUtc - asUtc;
        if (delta === 0) break;
        guess += delta;
    }

    return new Date(guess);
}

function addDaysToYmd(
    year: number,
    month: number,
    day: number,
    offset: number,
): { year: number; month: number; day: number } {
    const d = new Date(Date.UTC(year, month - 1, day + offset));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function resolveDayYmd(
    dayLabel: string | undefined,
    fallback: { year: number; month: number; day: number },
    timeZone: string,
): { year: number; month: number; day: number } {
    // day.date_label is display-only and may be stale when timezone/date inputs changed.
    // Lifecycle logic must rely on canonical start_date + day_number.
    void dayLabel;
    void timeZone;
    return fallback;
}

function buildScheduleWindows(event: Event): SlotWindow[] {
    const days = parseScheduleDays(event);
    if (days.length === 0) return [];

    const tz = getEventTimezone(event);
    const eventStart = parseDate(event.start_date) || new Date();
    const eventStartLocal = getDatePartsInTimezone(eventStart, tz);
    const baseYmd = {
        year: eventStartLocal.year,
        month: eventStartLocal.month,
        day: eventStartLocal.day,
    };

    const windows: SlotWindow[] = [];

    days.forEach((day, dayIndex) => {
        const dayOffset = (day.day_number || dayIndex + 1) - 1;
        const fallbackYmd = addDaysToYmd(baseYmd.year, baseYmd.month, baseYmd.day, dayOffset);
        const dayYmd = resolveDayYmd(day.date_label, fallbackYmd, tz);

        (day.slots || []).forEach((slot: EventScheduleSlot) => {
            const startMinutes = parseTimeToMinutes(slot.start_time);
            const endMinutes = parseTimeToMinutes(slot.end_time);

            if (startMinutes === null || endMinutes === null) return;
            if (startMinutes === endMinutes) return;

            const endDayYmd = endMinutes <= startMinutes
                ? addDaysToYmd(dayYmd.year, dayYmd.month, dayYmd.day, 1)
                : dayYmd;

            const start = zonedDateTimeToUtc(
                dayYmd.year,
                dayYmd.month,
                dayYmd.day,
                Math.floor(startMinutes / 60),
                startMinutes % 60,
                tz,
            );
            const end = zonedDateTimeToUtc(
                endDayYmd.year,
                endDayYmd.month,
                endDayYmd.day,
                Math.floor(endMinutes / 60),
                endMinutes % 60,
                tz,
            );

            if (end <= start) return;

            windows.push({
                start,
                end,
                label: slot.label || 'Session',
            });
        });
    });

    return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function getEventLifecycle(event: Event, now: Date = new Date()): EventLifecycleSnapshot {
    const explicitState = String(event.state || '').toLowerCase();
    const windows = buildScheduleWindows(event);
    const startDate = parseDate(event.start_date, 'start');
    const endDate = parseDate(event.end_date, 'end');

    // If an event is explicitly 'closed', i.e. it is ALWAYS ended.
    if (explicitState === 'closed') {
        const first = windows[0];
        const last = windows[windows.length - 1];
        const displayStart = first ? first.start : startDate;
        const displayEnd = last ? last.end : endDate;
        return {
            status: 'ended',
            startsAt: displayStart,
            endsAt: displayEnd,
            nextSlotStart: null,
            activeSlotLabel: null,
            source: windows.length > 0 ? 'schedule' : 'dates',
            hasScheduleSlots: windows.length > 0,
            scheduleSlotCount: windows.length,
            withinScheduleWindow: false,
            betweenSlots: false,
        };
    }

    if (windows.length > 0) {
        const first = windows[0];
        const last = windows[windows.length - 1];
        const active = windows.find((w) => now >= w.start && now <= w.end) || null;

        // Determine if we are past the point where the event should be considered 'ended'.
        // We trust the explicit 'endDate' if it is later than the last scheduled slot.
        const effectiveEnd = (endDate && endDate > last.end) ? endDate : last.end;

        if (now < first.start) {
            // Before first slot: always "upcoming" (not "in progress"). Do not set withinScheduleWindow
            // for gaps before the first session — that is reserved for true between-slot gaps.
            if (startDate && now >= startDate) {
                return {
                    status: 'upcoming',
                    startsAt: first.start,
                    endsAt: effectiveEnd,
                    nextSlotStart: first.start,
                    activeSlotLabel: null,
                    source: 'schedule',
                    hasScheduleSlots: true,
                    scheduleSlotCount: windows.length,
                    withinScheduleWindow: false,
                    betweenSlots: false,
                };
            }
            return {
                status: 'upcoming',
                startsAt: first.start,
                endsAt: effectiveEnd,
                nextSlotStart: first.start,
                activeSlotLabel: null,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: false,
                betweenSlots: false,
            };
        }

        if (now > effectiveEnd) {
            return {
                status: 'ended',
                startsAt: first.start,
                endsAt: effectiveEnd,
                nextSlotStart: null,
                activeSlotLabel: null,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: false,
                betweenSlots: false,
            };
        }

        if (active) {
            return {
                status: 'live',
                startsAt: first.start,
                endsAt: effectiveEnd,
                nextSlotStart: null,
                activeSlotLabel: active.label,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: true,
                betweenSlots: false,
            };
        }

        // Gap between two slots (first slot has started; not before first slot).
        const next = windows.find((w) => w.start > now) || null;
        return {
            status: 'upcoming',
            startsAt: first.start,
            endsAt: effectiveEnd,
            nextSlotStart: next ? next.start : null,
            activeSlotLabel: null,
            source: 'schedule',
            hasScheduleSlots: true,
            scheduleSlotCount: windows.length,
            withinScheduleWindow: true,
            betweenSlots: true,
        };
    }


    if (startDate && now < startDate) {
        return {
            status: 'upcoming',
            startsAt: startDate,
            endsAt: endDate,
            nextSlotStart: startDate,
            activeSlotLabel: null,
            source: 'dates',
            hasScheduleSlots: false,
            scheduleSlotCount: 0,
            withinScheduleWindow: false,
            betweenSlots: false,
        };
    }

    if (endDate && now > endDate) {
        return {
            status: 'ended',
            startsAt: startDate,
            endsAt: endDate,
            nextSlotStart: null,
            activeSlotLabel: null,
            source: 'dates',
            hasScheduleSlots: false,
            scheduleSlotCount: 0,
            withinScheduleWindow: false,
            betweenSlots: false,
        };
    }

    return {
        status: 'live',
        startsAt: startDate,
        endsAt: endDate,
        nextSlotStart: null,
        activeSlotLabel: null,
        source: 'dates',
        hasScheduleSlots: false,
        scheduleSlotCount: 0,
        withinScheduleWindow: false,
        betweenSlots: false,
    };
}

export function formatTimeToStart(target: Date | null, now: Date = new Date()): string {
    if (!target) return 'No upcoming slot';
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return 'Starting now';

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `Starts in ${days}d ${hours}h`;
    if (hours > 0) return `Starts in ${hours}h ${minutes}m`;
    return `Starts in ${minutes}m`;
}
