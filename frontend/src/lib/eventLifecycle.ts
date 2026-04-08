import { Event, EventScheduleDay, EventScheduleSlot } from '@/types/event';
import { getUserTimezone } from './timezone';

/**
 * Access State: Strictly controls the gating logic (permission to enter/interact)
 */
export type EventAccessState = 
    | 'CLOSED_BEFORE_EVENT' 
    | 'OPEN_SLOT_ACTIVE' 
    | 'CLOSED_BETWEEN_SLOTS' 
    | 'CLOSED_AFTER_EVENT';

/**
 * Display State: Controls labels, badges, and colors in the UI
 */
export type EventDisplayState = 
    | 'UPCOMING' 
    | 'LIVE' 
    | 'IN_PROGRESS' 
    | 'ENDED';

export interface EventLifecycleSnapshot {
    accessState: EventAccessState;
    displayState: EventDisplayState;
    
    // Core flags
    isInActiveSlot: boolean;
    isBetweenSlots: boolean;
    
    // Slot Metadata
    currentSlot: SlotWindow | null;
    nextSlot: SlotWindow | null;
    
    // Timeline Metadata
    startsAt: Date | null;
    endsAt: Date | null;
    hasScheduleSlots: boolean;
}

export interface SlotWindow {
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

/**
 * Bypasses local JS Date pitfalls by extracting calendar parts directly in the event's timezone.
 */
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

/**
 * Reconstructs a UTC Date from calendar parts in a specific timezone.
 */
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

function parseTimeToMinutes(value?: string): number | null {
    if (!value) return null;
    const [h, m] = value.split(':').map((p) => Number(p));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function parseScheduleDays(event: Event): EventScheduleDay[] {
    if (Array.isArray(event.schedule_days) && event.schedule_days.length > 0) return event.schedule_days;
    if (Array.isArray(event.event_timeline)) return event.event_timeline;
    if (typeof event.event_timeline === 'string') {
        try {
            const parsed = JSON.parse(event.event_timeline);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }
    return [];
}

/**
 * Builds a normalized list of all slot windows in UTC.
 */
function buildScheduleWindows(event: Event): SlotWindow[] {
    const days = parseScheduleDays(event);
    if (days.length === 0) return [];

    const tz = event.event_timezone || getUserTimezone();
    const eventStart = new Date(event.start_date || new Date());
    const eventStartLocal = getDatePartsInTimezone(eventStart, tz);

    const windows: SlotWindow[] = [];

    days.forEach((day, dayIndex) => {
        const dayOffset = (day.day_number || dayIndex + 1) - 1;
        const dayDate = new Date(Date.UTC(eventStartLocal.year, eventStartLocal.month - 1, eventStartLocal.day + dayOffset));
        const dayYmd = { year: dayDate.getUTCFullYear(), month: dayDate.getUTCMonth() + 1, day: dayDate.getUTCDate() };

        (day.slots || []).forEach((slot: EventScheduleSlot) => {
            const startMinutes = parseTimeToMinutes(slot.start_time);
            const endMinutes = parseTimeToMinutes(slot.end_time);
            if (startMinutes === null || endMinutes === null) return;

            const start = zonedDateTimeToUtc(dayYmd.year, dayYmd.month, dayYmd.day, Math.floor(startMinutes / 60), startMinutes % 60, tz);
            const isOvernight = endMinutes <= startMinutes;
            const endDay = isOvernight ? dayYmd.day + 1 : dayYmd.day;
            const end = zonedDateTimeToUtc(dayYmd.year, dayYmd.month, endDay, Math.floor(endMinutes / 60), endMinutes % 60, tz);

            windows.push({ start, end, label: slot.label || 'Session' });
        });
    });

    return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * CORE ARCHITECTURAL FIX:
 * Computes both AccessState and DisplayState independently based on current UTC time.
 */
export function getEventLifecycle(event: Event, now: Date = new Date()): EventLifecycleSnapshot {
    const windows = buildScheduleWindows(event);
    const startDate = event.start_date ? new Date(event.start_date) : null;
    const endDate = event.end_date ? new Date(event.end_date) : null;
    const explicitState = String(event.state || '').toLowerCase();

    const firstSlot = windows[0] || null;
    const lastSlot = windows[windows.length - 1] || null;
    const hasSlots = windows.length > 0;

    const startsAt = firstSlot ? firstSlot.start : startDate;
    const endsAt = lastSlot ? lastSlot.end : endDate;

    // 1. Explicitly Closed
    if (explicitState === 'closed') {
        return {
            accessState: 'CLOSED_AFTER_EVENT',
            displayState: 'ENDED',
            isInActiveSlot: false,
            isBetweenSlots: false,
            currentSlot: null,
            nextSlot: null,
            startsAt, endsAt, hasScheduleSlots: hasSlots
        };
    }

    // 2. Timeline Based Logic
    if (hasSlots) {
        const active = windows.find((w) => now >= w.start && now <= w.end) || null;
        const next = windows.find((w) => w.start > now) || null;
        
        if (now < firstSlot.start) {
            return {
                accessState: 'CLOSED_BEFORE_EVENT',
                displayState: 'UPCOMING',
                isInActiveSlot: false,
                isBetweenSlots: false,
                currentSlot: null,
                nextSlot: firstSlot,
                startsAt, endsAt, hasScheduleSlots: true
            };
        }

        if (active) {
            return {
                accessState: 'OPEN_SLOT_ACTIVE',
                displayState: 'LIVE',
                isInActiveSlot: true,
                isBetweenSlots: false,
                currentSlot: active,
                nextSlot: next,
                startsAt, endsAt, hasScheduleSlots: true
            };
        }

        if (next) {
            return {
                accessState: 'CLOSED_BETWEEN_SLOTS',
                displayState: 'IN_PROGRESS',
                isInActiveSlot: false,
                isBetweenSlots: true,
                currentSlot: null,
                nextSlot: next,
                startsAt, endsAt, hasScheduleSlots: true
            };
        }

        return {
            accessState: 'CLOSED_AFTER_EVENT',
            displayState: 'ENDED',
            isInActiveSlot: false,
            isBetweenSlots: false,
            currentSlot: null,
            nextSlot: null,
            startsAt, endsAt, hasScheduleSlots: true
        };
    }

    // 3. Date-only Fallback
    if (startDate && now < startDate) {
        return {
            accessState: 'CLOSED_BEFORE_EVENT',
            displayState: 'UPCOMING',
            isInActiveSlot: false,
            isBetweenSlots: false,
            currentSlot: null,
            nextSlot: null,
            startsAt, endsAt, hasScheduleSlots: false
        };
    }

    if (endDate && now > endDate) {
        return {
            accessState: 'CLOSED_AFTER_EVENT',
            displayState: 'ENDED',
            isInActiveSlot: false,
            isBetweenSlots: false,
            currentSlot: null,
            nextSlot: null,
            startsAt, endsAt, hasScheduleSlots: false
        };
    }

    return {
        accessState: 'OPEN_SLOT_ACTIVE',
        displayState: 'LIVE',
        isInActiveSlot: true,
        isBetweenSlots: false,
        currentSlot: null,
        nextSlot: null,
        startsAt, endsAt, hasScheduleSlots: false
    };
}

export function formatTimeToStart(target: Date | null, now: Date = new Date()): string {
    if (!target) return '';
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
