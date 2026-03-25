
// Standalone debugger for eventLifecycle.ts logic

function getUserTimezone() { return "Africa/Casablanca"; }

function isValidDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function hasExplicitTime(value) {
    return /[T\s]\d{1,2}:\d{2}/.test(value);
}

function parseDate(value, boundary = 'start') {
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

function parseTimeToMinutes(value) {
    if (!value) return null;
    const [h, m] = value.split(':').map((p) => Number(p));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function parseScheduleDays(event) {
    if (Array.isArray(event.schedule_days) && event.schedule_days.length > 0) {
        return event.schedule_days;
    }

    if (!event.event_timeline || typeof event.event_timeline !== 'string') {
        return [];
    }

    try {
        const parsed = JSON.parse(event.event_timeline);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getEventTimezone(event) {
    return event.event_timezone || getUserTimezone();
}

function getDatePartsInTimezone(value, timeZone) {
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
    const read = (type) => {
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

function zonedDateTimeToUtc(year, month, day, hour, minute, timeZone) {
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

function addDaysToYmd(year, month, day, offset) {
    const d = new Date(Date.UTC(year, month - 1, day + offset));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function resolveDayYmd(dayLabel, fallback, timeZone) {
    return fallback;
}

function buildScheduleWindows(event) {
    const days = parseScheduleDays(event);
    if (days.length === 0) return [];

    const tz = getEventTimezone(event);
    const eventStart = parseDate(event.start_date) || new Date();
    const eventStartLocal = getDatePartsInTimezone(eventStart, tz);
    
    console.log("Event Start (UTC):", eventStart.toISOString());
    console.log("Event Start (Local " + tz + "):", JSON.stringify(eventStartLocal));

    const baseYmd = {
        year: eventStartLocal.year,
        month: eventStartLocal.month,
        day: eventStartLocal.day,
    };

    const windows = [];

    days.forEach((day, dayIndex) => {
        const dayOffset = (day.day_number || dayIndex + 1) - 1;
        const fallbackYmd = addDaysToYmd(baseYmd.year, baseYmd.month, baseYmd.day, dayOffset);
        const dayYmd = resolveDayYmd(day.date_label, fallbackYmd, tz);

        (day.slots || []).forEach((slot) => {
            const startMinutes = parseTimeToMinutes(slot.start_time);
            const endMinutes = parseTimeToMinutes(slot.end_time);

            if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;

            const start = zonedDateTimeToUtc(
                dayYmd.year,
                dayYmd.month,
                dayYmd.day,
                Math.floor(startMinutes / 60),
                startMinutes % 60,
                tz,
            );
            const end = zonedDateTimeToUtc(
                dayYmd.year,
                dayYmd.month,
                dayYmd.day,
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

function getEventLifecycle(event, now = new Date()) {
    const explicitState = String(event.state || '').toLowerCase();
    const windows = buildScheduleWindows(event);
    
    console.log("Built windows:", windows.map(w => ({ start: w.start.toISOString(), end: w.end.toISOString() })));

    if (windows.length > 0) {
        const first = windows[0];
        const last = windows[windows.length - 1];
        const active = windows.find((w) => now >= w.start && now <= w.end) || null;

        if (explicitState === 'closed') return { status: 'ended' };
        if (now < first.start) return { status: 'upcoming' };
        if (now > last.end) return { status: 'ended' };
        if (active) return { status: 'live' };
        return { status: 'upcoming' };
    }

    return { status: 'other' };
}

// TEST CASE
const ev = {
    title: "test",
    state: "live",
    start_date: "2026-03-24T23:00:00Z",
    end_date: "2026-03-25T22:59:59Z",
    event_timeline: JSON.stringify([
        { day_number: 1, slots: [{ start_time: "01:50", end_time: "23:50" }] }
    ]),
    event_timezone: "Africa/Casablanca"
};

const now = new Date("2026-03-25T01:23:16Z"); // 02:23 Casablanca
console.log("Testing with Now (UTC):", now.toISOString());

const res = getEventLifecycle(ev, now);
console.log("RESULT:", res.status);
