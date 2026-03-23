'use client';

import type { ReactNode } from 'react';
import { Event, EventScheduleDay, EventScheduleSlot } from '@/types/event';
import { Calendar, Clock, Dot, Flame, Mic2, Sparkles } from 'lucide-react';

interface ScheduleTabProps {
    event: Event | null;
}

/**
 * Attempts to parse event_timeline as JSON into EventScheduleDay[] format
 */
function parseEventTimeline(timeline: string | undefined): EventScheduleDay[] | null {
    if (!timeline) return null;
    try {
        const parsed = JSON.parse(timeline);
        if (Array.isArray(parsed)) {
            return parsed as EventScheduleDay[];
        }
        return null;
    } catch {
        // Not valid JSON, return null to display as free-text
        return null;
    }
}

/**
 * Formats time string from "HH:MM" to a more readable format
 */
function formatTime(time: string): string {
    if (!time) return '';
    // Already in HH:MM format, return as is
    return time;
}

function getDurationLabel(startTime?: string, endTime?: string): string | null {
    const s = toMinutes(startTime);
    const e = toMinutes(endTime);
    if (s === null || e === null || e <= s) return null;

    const total = e - s;
    const h = Math.floor(total / 60);
    const m = total % 60;

    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function toMinutes(time: string | undefined): number | null {
    if (!time) return null;
    const [h, m] = time.split(':').map((p) => Number(p));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function addDays(base: Date, days: number): Date {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
}

function buildDateForTime(baseDate: Date, time: string | undefined): Date | null {
    const minutes = toMinutes(time);
    if (minutes === null) return null;

    const d = new Date(baseDate);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return d;
}

function getSlotKind(slot: EventScheduleSlot): 'conference' | 'talk' | 'activity' {
    if (slot.is_conference || slot.conference_id) return 'conference';
    const label = (slot.label || '').toLowerCase();
    if (label.includes('keynote') || label.includes('speaker') || label.includes('talk')) {
        return 'talk';
    }
    return 'activity';
}

type SlotStatus = 'live' | 'upcoming' | 'past';

function getSlotStatus(startAt: Date | null, endAt: Date | null, now: Date): SlotStatus {
    if (!startAt || !endAt) return 'upcoming';
    if (now >= startAt && now < endAt) return 'live';
    if (now < startAt) return 'upcoming';
    return 'past';
}

function formatDateLabel(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(date);
}

interface TimelineSlot {
    dayNumber: number;
    dayLabel: string;
    slot: EventScheduleSlot;
    kind: 'conference' | 'talk' | 'activity';
    startAt: Date | null;
    endAt: Date | null;
    status: SlotStatus;
}

function buildTimelineSlots(event: Event, days: EventScheduleDay[]): TimelineSlot[] {
    const now = new Date();
    const eventStart = event.start_date ? new Date(event.start_date) : null;
    const canUseEventDate = eventStart && !Number.isNaN(eventStart.getTime());
    const eventTimeZone = event.event_timezone || 'UTC';

    const getDatePartsInTimezone = (value: Date, timeZone: string) => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(value);
        const read = (type: Intl.DateTimeFormatPartTypes): number => {
            const raw = parts.find((p) => p.type === type)?.value;
            return Number(raw || 0);
        };
        return { year: read('year'), month: read('month'), day: read('day') };
    };

    return days.flatMap((day, dayIndex) => {
        const dayOffset = (day.day_number || dayIndex + 1) - 1;
        const baseDate = (() => {
            if (!canUseEventDate) return new Date(now);
            const ymd = getDatePartsInTimezone(eventStart as Date, eventTimeZone);
            return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + dayOffset, 12, 0, 0, 0));
        })();
        const resolvedDayLabel = new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            timeZone: eventTimeZone,
        }).format(baseDate);

        return (day.slots || []).map((slot) => {
            const startAt = buildDateForTime(baseDate, slot.start_time);
            const endAt = buildDateForTime(baseDate, slot.end_time);

            return {
                dayNumber: day.day_number || dayIndex + 1,
                dayLabel: resolvedDayLabel,
                slot,
                kind: getSlotKind(slot),
                startAt,
                endAt,
                status: getSlotStatus(startAt, endAt, now),
            };
        });
    });
}

function compareTimelineSlots(a: TimelineSlot, b: TimelineSlot): number {
    const dayDiff = a.dayNumber - b.dayNumber;
    if (dayDiff !== 0) return dayDiff;
    const aMin = toMinutes(a.slot.start_time) ?? Number.MAX_SAFE_INTEGER;
    const bMin = toMinutes(b.slot.start_time) ?? Number.MAX_SAFE_INTEGER;
    return aMin - bMin;
}

export function ScheduleTab({ event }: ScheduleTabProps) {
    if (!event) {
        return (
            <div className="bg-white rounded-xl shadow p-12 text-center">
                <p className="text-gray-500">Loading event details...</p>
            </div>
        );
    }

    // Try to get structured schedule_days first
    let days: EventScheduleDay[] | null = event.schedule_days ?? null;

    // Fallback: try parsing event_timeline if it's JSON
    if (!days && event.event_timeline) {
        days = parseEventTimeline(event.event_timeline);
    }

    // If we have structured schedule data
    if (days && days.length > 0) {
        const timelineSlots = buildTimelineSlots(event, days).sort(compareTimelineSlots);
        const liveNow = timelineSlots.find((item) => item.status === 'live') || null;
        const nextUp = timelineSlots.find((item) => item.status === 'upcoming') || null;

        return (
            <div className="max-w-6xl mx-auto py-8 space-y-8 relative">
                <div className="absolute -z-10 inset-x-0 top-12 h-72 rounded-[2rem] bg-gradient-to-b from-cyan-100/60 via-sky-50/40 to-transparent blur-2xl" />

                <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-sky-900 to-cyan-800 p-6 md:p-8 text-white shadow-xl">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                                <Sparkles className="h-3.5 w-3.5" />
                                Visitor Timeline
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold mt-3">Event Activity Schedule</h2>
                            <p className="text-white/80 mt-2 text-sm md:text-base">
                                Follow each activity by timeline and track what is happening live.
                            </p>
                        </div>
                        <div className="rounded-xl bg-black/20 border border-white/20 px-4 py-3 min-w-[220px]">
                            <p className="text-xs uppercase tracking-wide text-white/70">Schedule Days</p>
                            <p className="text-2xl font-bold mt-1">{days.length}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatusCard
                        title="Happening Now"
                        icon={<Flame className="h-4 w-4" />}
                        tone={liveNow ? 'live' : 'neutral'}
                        item={liveNow}
                        emptyText="No session is currently live."
                    />
                    <StatusCard
                        title="Next Up"
                        icon={<Calendar className="h-4 w-4" />}
                        tone={nextUp ? 'upcoming' : 'neutral'}
                        item={nextUp}
                        emptyText="No upcoming activity available."
                    />
                </div>

                {days.map((day, dayIndex) => {
                    const dayNumber = day.day_number || dayIndex + 1;
                    const dayItems = timelineSlots.filter((item) => item.dayNumber === dayNumber);
                    const dayLabel = dayItems[0]?.dayLabel || '';
                    const liveCount = dayItems.filter((item) => item.status === 'live').length;
                    const upcomingCount = dayItems.filter((item) => item.status === 'upcoming').length;

                    return (
                        <div
                            key={dayNumber}
                            className="bg-white/95 backdrop-blur rounded-3xl border border-slate-200 shadow-sm p-6 md:p-7"
                        >
                            <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-cyan-100 to-sky-100 rounded-xl border border-cyan-200/70">
                                        <span className="text-cyan-700 font-bold text-lg">{dayNumber}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-slate-900">
                                            Day {dayNumber}
                                        </h3>
                                        {dayLabel && <p className="text-sm text-slate-500">{dayLabel}</p>}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                        {day.slots?.length || 0} sessions
                                    </span>
                                    {liveCount > 0 && (
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                            {liveCount} live
                                        </span>
                                    )}
                                    {upcomingCount > 0 && (
                                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700">
                                            {upcomingCount} upcoming
                                        </span>
                                    )}
                                </div>
                            </div>

                            {(!day.slots || day.slots.length === 0) ? (
                                <p className="text-slate-500 italic text-center py-4">
                                    No sessions scheduled for this day yet.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {day.slots.map((slot, slotIndex) => {
                                        const timelineItem = timelineSlots.find(
                                            (item) =>
                                                item.dayNumber === dayNumber &&
                                                item.slot.start_time === slot.start_time &&
                                                item.slot.label === slot.label
                                        );

                                        return (
                                            <SessionSlot
                                                key={`${slotIndex}-${slot.start_time}-${slot.label}`}
                                                slot={slot}
                                                status={timelineItem?.status || 'upcoming'}
                                                kind={timelineItem?.kind || getSlotKind(slot)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // Fallback: display event_timeline as free-text if available
    if (event.event_timeline && typeof event.event_timeline === 'string') {
        return (
            <div className="max-w-6xl mx-auto py-8 space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Event Schedule</h2>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                    <div className="prose prose-gray max-w-none">
                        <pre className="whitespace-pre-wrap text-gray-700 font-sans text-base leading-relaxed">
                            {event.event_timeline}
                        </pre>
                    </div>
                </div>
            </div>
        );
    }

    // No schedule data available
    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="bg-white rounded-xl shadow p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No schedule available
                </h3>
                <p className="text-gray-500">
                    The event schedule has not been published yet. Check back later for updates.
                </p>
            </div>
        </div>
    );
}

function SessionSlot({
    slot,
    status,
    kind,
}: {
    slot: EventScheduleSlot;
    status: SlotStatus;
    kind: 'conference' | 'talk' | 'activity';
}) {
    const statusStyle =
        status === 'live'
            ? {
                  dot: 'bg-red-500',
                  line: 'bg-red-200',
                  card: 'border-red-300 bg-gradient-to-r from-red-50 to-rose-50',
                  badge: 'bg-red-100 text-red-700',
                  text: 'Live now',
              }
            : status === 'past'
              ? {
                    dot: 'bg-slate-400',
                    line: 'bg-slate-200',
                    card: 'border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/80',
                    badge: 'bg-slate-200 text-slate-700',
                    text: 'Completed',
                }
              : {
                    dot: 'bg-cyan-500',
                    line: 'bg-cyan-200',
                    card: 'border-cyan-300 bg-gradient-to-r from-cyan-50 to-sky-50/80',
                    badge: 'bg-cyan-100 text-cyan-700',
                    text: 'Upcoming',
                };

    const kindLabel =
        kind === 'conference' ? 'Conference' : kind === 'talk' ? 'Talk' : 'Activity';
    const duration = getDurationLabel(slot.start_time, slot.end_time);

    return (
        <div className="flex gap-5 md:gap-6">
            <div className="flex-shrink-0 w-28 md:w-32 text-right pt-1">
                <div className="inline-flex items-center justify-end gap-1.5 text-sm font-semibold text-cyan-700">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(slot.start_time)}</span>
                </div>
                {slot.end_time && (
                    <div className="text-xs text-slate-400 mt-1">
                        to {formatTime(slot.end_time)}
                    </div>
                )}
                {duration && (
                    <div className="text-[11px] mt-1 text-slate-500 font-medium">{duration}</div>
                )}
            </div>

            <div className="flex flex-col items-center">
                <div className={`w-3.5 h-3.5 rounded-full border-[3px] border-white shadow-sm ${statusStyle.dot}`}></div>
                <div className={`w-0.5 flex-1 min-h-[88px] ${statusStyle.line}`}></div>
            </div>

            <div className="flex-1 pb-5">
                <div className={`rounded-2xl p-4 md:p-5 border transition-all hover:shadow-md ${statusStyle.card}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle.badge}`}>
                            {statusStyle.text}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-white/80 border border-slate-200 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                            <Dot className="h-4 w-4 -mx-1" />
                            {kindLabel}
                        </span>
                    </div>

                    <h4 className="font-semibold text-slate-900 text-lg leading-snug">
                        {slot.label || 'Untitled Session'}
                    </h4>

                    <div className="mt-2 text-xs text-slate-500 font-medium">
                        {formatTime(slot.start_time)}
                        {slot.end_time ? ` - ${formatTime(slot.end_time)}` : ''}
                    </div>

                    {(slot.speaker_name || slot.assigned_enterprise_name) && (
                        <p className="mt-3 text-sm text-slate-600 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 border border-slate-200">
                            <Mic2 className="h-4 w-4 text-slate-500" />
                            {slot.speaker_name || slot.assigned_enterprise_name}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusCard({
    title,
    icon,
    tone,
    item,
    emptyText,
}: {
    title: string;
    icon: ReactNode;
    tone: 'live' | 'upcoming' | 'neutral';
    item: TimelineSlot | null;
    emptyText: string;
}) {
    const toneClass =
        tone === 'live'
            ? 'border-red-200 bg-gradient-to-r from-red-50 to-rose-50'
            : tone === 'upcoming'
              ? 'border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50'
              : 'border-slate-200 bg-slate-50';

    return (
        <div className={`rounded-2xl border p-4 md:p-5 ${toneClass}`}>
            <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 inline-flex items-center gap-2">
                {icon}
                {title}
            </p>
            {item ? (
                <>
                    <p className="mt-2 font-semibold text-slate-900 text-base">{item.slot.label || 'Untitled Session'}</p>
                    <p className="mt-1 text-sm text-slate-600">
                        Day {item.dayNumber} {item.dayLabel ? `• ${item.dayLabel}` : ''} • {formatTime(item.slot.start_time)}
                        {item.slot.end_time ? ` - ${formatTime(item.slot.end_time)}` : ''}
                    </p>
                </>
            ) : (
                <p className="mt-2 text-sm text-slate-600">{emptyText}</p>
            )}
        </div>
    );
}
