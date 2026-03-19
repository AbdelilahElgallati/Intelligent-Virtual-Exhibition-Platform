import { Event, EventScheduleDay, EventScheduleSlot } from '@/types/event';

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
}

interface SlotWindow {
    start: Date;
    end: Date;
    label: string;
}

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function hasExplicitTime(value: string): boolean {
    // Detect common time patterns to avoid overriding explicit timestamps.
    return /[T\s]\d{1,2}:\d{2}/.test(value);
}

function parseDate(value: unknown, boundary: 'start' | 'end' = 'start'): Date | null {
    if (!value) return null;
    const raw = String(value);
    const d = new Date(raw);
    if (!isValidDate(d)) return null;

    // For date-only values like 2026-03-19, interpret end as end-of-day
    // so an event remains active for the full final day.
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

function dateOnlyFrom(base: Date): Date {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
}

function addDays(base: Date, count: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + count);
    return d;
}

function buildDateFromDayLabel(dayLabel: string | undefined, fallback: Date): Date {
    if (!dayLabel) return fallback;

    const parsed = parseDate(dayLabel);
    if (!parsed) return fallback;

    return dateOnlyFrom(parsed);
}

function buildSlotDate(baseDate: Date, time?: string): Date | null {
    const minutes = parseTimeToMinutes(time);
    if (minutes === null) return null;

    const d = new Date(baseDate);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
}

function buildScheduleWindows(event: Event): SlotWindow[] {
    const days = parseScheduleDays(event);
    if (days.length === 0) return [];

    const eventStart = parseDate(event.start_date) || new Date();
    const eventBaseDate = dateOnlyFrom(eventStart);

    const windows: SlotWindow[] = [];

    days.forEach((day, dayIndex) => {
        const dayOffset = (day.day_number || dayIndex + 1) - 1;
        const fallbackDate = addDays(eventBaseDate, dayOffset);
        const dayDate = buildDateFromDayLabel(day.date_label, fallbackDate);

        (day.slots || []).forEach((slot: EventScheduleSlot) => {
            const start = buildSlotDate(dayDate, slot.start_time);
            const end = buildSlotDate(dayDate, slot.end_time);

            if (!start || !end || end <= start) return;

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
    const explicitState = String((event as any)?.state || '').toLowerCase();
    const windows = buildScheduleWindows(event);

    if (windows.length > 0) {
        const first = windows[0];
        const last = windows[windows.length - 1];
        const active = windows.find((w) => now >= w.start && now <= w.end) || null;

        if (explicitState === 'live') {
            return {
                status: 'live',
                startsAt: first.start,
                endsAt: last.end,
                nextSlotStart: null,
                activeSlotLabel: active ? active.label : null,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: !!active,
            };
        }

        if (explicitState === 'closed') {
            return {
                status: 'ended',
                startsAt: first.start,
                endsAt: last.end,
                nextSlotStart: null,
                activeSlotLabel: null,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: false,
            };
        }

        if (now < first.start) {
            return {
                status: 'upcoming',
                startsAt: first.start,
                endsAt: last.end,
                nextSlotStart: first.start,
                activeSlotLabel: null,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: false,
            };
        }

        if (now > last.end) {
            return {
                status: 'ended',
                startsAt: first.start,
                endsAt: last.end,
                nextSlotStart: null,
                activeSlotLabel: null,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: false,
            };
        }

        if (active) {
            return {
                status: 'live',
                startsAt: first.start,
                endsAt: last.end,
                nextSlotStart: null,
                activeSlotLabel: active.label,
                source: 'schedule',
                hasScheduleSlots: true,
                scheduleSlotCount: windows.length,
                withinScheduleWindow: true,
            };
        }

        const next = windows.find((w) => w.start > now) || null;
        return {
            status: 'upcoming',
            startsAt: first.start,
            endsAt: last.end,
            nextSlotStart: next ? next.start : null,
            activeSlotLabel: null,
            source: 'schedule',
            hasScheduleSlots: true,
            scheduleSlotCount: windows.length,
            withinScheduleWindow: true,
        };
    }

    const startDate = parseDate(event.start_date, 'start');
    const endDate = parseDate(event.end_date, 'end');

    if (explicitState === 'live') {
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
        };
    }

    if (explicitState === 'closed') {
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
