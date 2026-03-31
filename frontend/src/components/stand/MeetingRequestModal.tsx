import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
    X,
    Calendar,
    Clock,
    Info,
    AlertTriangle,
    CheckCircle2,
    Ban,
    CircleDot,
    Hourglass,
    Timer,
    Video,
    Loader2,
    ArrowRight,
    MessageSquare,
} from 'lucide-react';
import { EventScheduleDay } from '@/types/event';
import { Meeting } from '@/types/meeting';
import { fromZonedTime } from 'date-fns-tz';
import { formatInTZ, getUserTimezone, toYmdInEventTz } from '@/lib/timezone';

interface MeetingRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    standId: string;
    standAliasIds?: string[];
    standName: string;
    eventId: string;
    eventAliasIds?: string[];
    /** Optional event boundaries — when provided the pickers are constrained */
    eventStartDate?: string;
    eventEndDate?: string;
    scheduleDays?: EventScheduleDay[];
    eventTimeZone?: string;
    themeColor?: string;
    myStandId?: string;
    meetings?: Meeting[];
    onSuccess?: () => void;
    onUpdateStatus?: (meetingId: string, status: string) => Promise<void>;
    initialView?: 'list' | 'request';
}

interface BusySlot {
    start_time: string;
    end_time: string;
    type: string;
    label: string;
}

type TimelineStatus = 'upcoming' | 'starting-soon' | 'live' | 'ended' | 'expired';

function getMeetingTimeline(m: Meeting): { status: TimelineStatus; label: string; color: string; bgColor: string; icon: typeof Clock } {
    const now = Date.now();
    const start = new Date(m.start_time).getTime();
    const end = new Date(m.end_time).getTime();
    const minsUntilStart = Math.round((start - now) / 60000);

    if (m.status === 'rejected') return { status: 'ended', label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-50 border-red-100', icon: Ban };
    if (m.status === 'canceled') return { status: 'ended', label: 'Canceled', color: 'text-zinc-500', bgColor: 'bg-zinc-50 border-zinc-200', icon: Ban };
    if (m.status === 'completed' || m.session_status === 'ended') return { status: 'ended', label: 'Completed', color: 'text-zinc-500', bgColor: 'bg-zinc-50 border-zinc-200', icon: CheckCircle2 };
    if (m.session_status === 'live') return { status: 'live', label: 'Live Now', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: CircleDot };
    if (now > end) return { status: 'expired', label: 'Expired', color: 'text-red-500', bgColor: 'bg-red-50/50 border-red-100', icon: Timer };
    if (now >= start && now <= end) return { status: 'live', label: 'Ready to Join', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: Video };
    if (minsUntilStart <= 15 && minsUntilStart > 0) return { status: 'starting-soon', label: `In ${minsUntilStart} min`, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', icon: Hourglass };
    if (minsUntilStart <= 60) return { status: 'upcoming', label: `In ${minsUntilStart} min`, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', icon: Clock };
    const hoursUntil = Math.floor(minsUntilStart / 60);
    if (hoursUntil < 24) return { status: 'upcoming', label: `In ${hoursUntil}h`, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', icon: Clock };
    return { status: 'upcoming', label: `In ${Math.floor(hoursUntil / 24)}d`, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', icon: Clock };
}

function formatLocalDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseClockTime(value?: string): [number, number] | null {
    if (!value || !value.includes(':')) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return [hours, minutes];
}

function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16) || 79,
        g: parseInt(h.substring(2, 4), 16) || 70,
        b: parseInt(h.substring(4, 6), 16) || 229,
    };
}

function timeToMinutes(value: string): number | null {
    const parsed = parseClockTime(value);
    if (!parsed) return null;
    return parsed[0] * 60 + parsed[1];
}

function minutesToTime(totalMinutes: number): string {
    const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
}

type ScheduleSegment = { start: string; end: string };

function buildScheduleSegments(slots: { start_time: string; end_time: string }[]): ScheduleSegment[] {
    const parsed = slots
        .map((slot) => {
            const start = timeToMinutes(slot.start_time);
            const end = timeToMinutes(slot.end_time);
            if (start === null || end === null || end <= start) return null;
            return { start, end };
        })
        .filter((slot): slot is { start: number; end: number } => slot !== null)
        .sort((a, b) => a.start - b.start);

    if (parsed.length === 0) return [];

    const merged: { start: number; end: number }[] = [];
    for (const slot of parsed) {
        const last = merged[merged.length - 1];
        if (!last || slot.start > last.end) {
            merged.push({ ...slot });
            continue;
        }
        last.end = Math.max(last.end, slot.end);
    }

    return merged.map((slot) => ({
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
    }));
}

function buildTimeSteps(startTime: string, endTime: string, includeEnd: boolean, stepMinutes = 15): string[] {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null || end <= start) return [];

    const values: string[] = [];
    for (let current = start; current < end; current += stepMinutes) {
        values.push(minutesToTime(current));
    }
    if (includeEnd && values[values.length - 1] !== minutesToTime(end)) {
        values.push(minutesToTime(end));
    }
    return values;
}

export function MeetingRequestModal({
    isOpen,
    onClose,
    standId,
    standAliasIds,
    standName,
    eventId,
    eventAliasIds,
    eventStartDate,
    eventEndDate,
    scheduleDays,
    eventTimeZone = 'UTC',
    themeColor = '#4f46e5',
    myStandId,
    meetings: meetingsProp,
    onSuccess,
    onUpdateStatus,
    initialView = 'list',
}: MeetingRequestModalProps): JSX.Element {
    const router = useRouter();
    const [activeView, setActiveView] = useState<'list' | 'request'>(initialView);
    const viewerTimeZone = getUserTimezone();

    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const meetingsLengthRef = useRef(0);
    const wasOpenRef = useRef(false);
    const standAliasIdsRef = useRef(standAliasIds);
    const eventAliasIdsRef = useRef(eventAliasIds);
    standAliasIdsRef.current = standAliasIds;
    eventAliasIdsRef.current = eventAliasIds;
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [busySlots, setBusySlots] = useState<BusySlot[]>([]);

    const [loading, setLoading] = useState(false);
    const [meetingError, setMeetingError] = useState<string | null>(null);

    const [meetingForm, setMeetingForm] = useState({
        date: '',
        startTime: '',
        endTime: '',
        durationMinutes: 0,
        purpose: '',
    });
    const activeViewRef = useRef<'list' | 'request'>('list');
    useEffect(() => { activeViewRef.current = activeView; }, [activeView]);
    const { r, g, b } = hexToRgb(themeColor);

    const fetchMeetings = useCallback(async (silent = false) => {
        if (meetingsProp) {
            setMeetings(meetingsProp as Meeting[]);
            setLoadingMeetings(false);
            return;
        }
        if (!standId) {
            setMeetings([]);
            setLoadingMeetings(false);
            setActiveView('request'); // Always allow request view for B2B
            return;
        }
        if (!silent || meetingsLengthRef.current === 0) {
            setLoadingMeetings(true);
        }
        try {
            const all = await apiClient.get<Meeting[]>('/meetings/my-meetings');

            const standIds = new Set(
                [standId, ...(standAliasIdsRef.current || [])]
                    .map((value) => String(value || '').trim())
                    .filter((value) => value.length > 0)
            );
            const eventIds = new Set(
                [eventId, ...(eventAliasIdsRef.current || [])]
                    .map((value) => String(value || '').trim())
                    .filter((value) => value.length > 0)
            );

            const filtered = (all || [])
                .filter((m) => {
                    const matchesStand = standIds.has(String(m.stand_id || '')) || 
                        (myStandId ? String(m.stand_id || '') === myStandId : false);
                    const matchesEvent = eventIds.has(String(m.event_id || ''));
                    return matchesStand && matchesEvent;
                })
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            setMeetings(filtered);
            meetingsLengthRef.current = filtered.length;
        } catch (error) {
            console.error('Failed to fetch visitor meetings', error);
        } finally {
            setLoadingMeetings(false);
        }
    }, [standId, eventId, meetingsProp]);

    const fetchBusySlots = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingSlots(true);
        }
        try {
            const slots = await apiClient.get<BusySlot[]>(`/meetings/busy-slots?event_id=${encodeURIComponent(eventId)}&partner_stand_id=${encodeURIComponent(standId)}`);
            setBusySlots(Array.isArray(slots) ? slots : []);
        } catch (error) {
            console.error('Failed to fetch busy meeting slots', error);
            setBusySlots([]);
        } finally {
            setLoadingSlots(false);
        }
    }, [eventId, standId]);

    useEffect(() => {
        if (!isOpen || !standId || !eventId) {
            wasOpenRef.current = false;
            if (!meetingsProp) setMeetings([]);
            meetingsLengthRef.current = 0;
            setLoadingMeetings(false);
            setLoadingSlots(false);
            return;
        }
        // One-time initialization — only when the modal first opens, not on
        // every callback recreation caused by parent re-renders.
        if (!wasOpenRef.current) {
            wasOpenRef.current = true;
            setMeetingError(null);
            setMeetingForm({ date: '', startTime: '', endTime: '', durationMinutes: 0, purpose: '' });
            setActiveView(initialView);
            activeViewRef.current = initialView;
        }
        if (!meetingsProp) {
            fetchMeetings();
            fetchBusySlots();

            const interval = setInterval(() => {
                fetchMeetings(true);
                fetchBusySlots(true);
            }, 8000);
            return () => clearInterval(interval);
        }
    }, [isOpen, standId, eventId, fetchMeetings, fetchBusySlots, meetingsProp]);

        const eventDays = useMemo(() => {
            const days: { dateStr: string; label: string; slots: { start_time: string; end_time: string }[] }[] = [];
            const startYmd = eventStartDate ? toYmdInEventTz(eventStartDate, eventTimeZone) : '';
            const endYmd = eventEndDate ? toYmdInEventTz(eventEndDate, eventTimeZone) : '';

            if (!startYmd || !endYmd) return days;

            const startAnchor = new Date(`${startYmd}T12:00:00Z`);
            const endAnchor = new Date(`${endYmd}T12:00:00Z`);

            const eventDateLabel = (d: Date, index: number) =>
                `Day ${index} — ${new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: eventTimeZone,
                }).format(d)}`;

            let d = new Date(startAnchor);
            let index = 1;
            while (d <= endAnchor) {
                const dateStr = formatInTZ(d, eventTimeZone, 'yyyy-MM-dd');
                
                // Try to find schedule for this specific day number
                const scheduleForDay = scheduleDays?.find(sd => sd.day_number === index);
                const slots = (scheduleForDay && scheduleForDay.slots.length > 0)
                    ? scheduleForDay.slots.map(s => ({ start_time: s.start_time, end_time: s.end_time }))
                    : [{ start_time: '08:00', end_time: '20:00' }]; // Default wider range if no schedule

                days.push({
                    dateStr,
                    label: eventDateLabel(d, index),
                    slots,
                });
                d = new Date(d.getTime());
                d.setUTCDate(d.getUTCDate() + 1);
                index += 1;
            }

            return days;
        }, [eventStartDate, eventEndDate, scheduleDays, eventTimeZone]);

    const getDateTimeValue = useCallback((dateStr: string, time: string) => {
        return fromZonedTime(`${dateStr}T${time}:00`, eventTimeZone).getTime();
    }, [eventTimeZone]);

    const isPastDate = useCallback((dateStr: string) => {
        const targetEndOfDay = fromZonedTime(`${dateStr}T23:59:59`, eventTimeZone).getTime();
        return targetEndOfDay < Date.now();
    }, [eventTimeZone]);

    const isPastDateTime = useCallback((dateStr: string, time: string) => {
        return getDateTimeValue(dateStr, time) <= Date.now() + 30000;
    }, [getDateTimeValue]);

    const dayAvailability = useMemo(() => {
        return eventDays.map((day) => {
            const segments = buildScheduleSegments(day.slots);
            const hasFutureStart = segments.some((segment) =>
                buildTimeSteps(segment.start, segment.end, false, 15).some((time) => !isPastDateTime(day.dateStr, time))
            );
            return {
                ...day,
                disabled: isPastDate(day.dateStr) || !hasFutureStart,
            };
        });
    }, [eventDays, isPastDate, isPastDateTime]);

    const selectedDay = useMemo(() => {
        return dayAvailability.find((day) => day.dateStr === meetingForm.date) || null;
    }, [dayAvailability, meetingForm.date]);

    const selectedDaySegments = useMemo(() => {
        return selectedDay ? buildScheduleSegments(selectedDay.slots) : [];
    }, [selectedDay]);

    const startTimeOptions = useMemo(() => {
        if (!selectedDay) return [];
        return selectedDaySegments.flatMap((segment) =>
            buildTimeSteps(segment.start, segment.end, false, 15).map((time) => ({
                time,
                disabled: isPastDateTime(selectedDay.dateStr, time),
            }))
        );
    }, [selectedDay, selectedDaySegments, isPastDateTime]);

    const isSlotBusy = useCallback((time: string, isEnd = false) => {
        if (!meetingForm.date) return null;
        const dtMs = getDateTimeValue(meetingForm.date, time);
        for (const bs of busySlots) {
            const bsStartMs = new Date(bs.start_time).getTime();
            const bsEndMs = new Date(bs.end_time).getTime();
            if (isEnd) {
                if (!meetingForm.startTime) return null;
                const startMs = getDateTimeValue(meetingForm.date, meetingForm.startTime);
                if (dtMs > bsStartMs && startMs < bsEndMs) return bs;
            } else if (dtMs >= bsStartMs && dtMs < bsEndMs) {
                return bs;
            }
        }
        return null;
    }, [meetingForm.date, meetingForm.startTime, busySlots, getDateTimeValue]);

    const durationOptions = useMemo(() => {
        if (!selectedDay || !meetingForm.startTime) return [];

        const startMinutes = timeToMinutes(meetingForm.startTime);
        if (startMinutes === null) return [];

        const segment = selectedDaySegments.find((item) => {
            const segmentStart = timeToMinutes(item.start);
            const segmentEnd = timeToMinutes(item.end);
            return segmentStart !== null && segmentEnd !== null && startMinutes >= segmentStart && startMinutes < segmentEnd;
        });
        if (!segment) return [];

        const segmentEndMinutes = timeToMinutes(segment.end);
        if (segmentEndMinutes === null) return [];

        const allowedDurations = [15, 30, 45, 60];
        return allowedDurations.map((duration) => {
            const endMinutes = startMinutes + duration;
            const endTime = minutesToTime(endMinutes);
            const inSegment = endMinutes <= segmentEndMinutes;
            const disabledByPast = !inSegment || isPastDateTime(selectedDay.dateStr, endTime);
            const conflict = disabledByPast ? null : isSlotBusy(endTime, true);
            return {
                duration,
                endTime,
                disabled: disabledByPast || !!conflict,
                conflict,
            };
        });
    }, [selectedDay, meetingForm.startTime, selectedDaySegments, isPastDateTime, isSlotBusy]);

    useEffect(() => {
        if (!meetingForm.startTime || !meetingForm.durationMinutes || !meetingForm.endTime) return;
        const stillValid = durationOptions.some((option) =>
            option.duration === meetingForm.durationMinutes &&
            option.endTime === meetingForm.endTime &&
            !option.disabled
        );
        if (!stillValid) {
            setMeetingForm((prev) => ({ ...prev, endTime: '', durationMinutes: 0 }));
        }
    }, [meetingForm.startTime, meetingForm.durationMinutes, meetingForm.endTime, durationOptions]);

    const handleUpdateMeetingStatus = async (meetingId: string, status: string) => {
        try {
            if (onUpdateStatus) {
                await onUpdateStatus(meetingId, status);
            } else {
                await apiClient.patch(`/meetings/${meetingId}`, { status });
            }
            await Promise.all([fetchMeetings(true), fetchBusySlots(true)]);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Failed to update meeting status', error);
            setMeetingError((error as Error)?.message || 'Failed to update meeting');
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMeetingError(null);

        try {
            if (!eventId) {
                throw new Error('Missing event id for meeting request');
            }

            if (!meetingForm.date || !meetingForm.startTime || !meetingForm.endTime) {
                throw new Error('Please select date and time');
            }

            const startTime = fromZonedTime(`${meetingForm.date}T${meetingForm.startTime}:00`, viewerTimeZone);
            const endTime = fromZonedTime(`${meetingForm.date}T${meetingForm.endTime}:00`, viewerTimeZone);
            const now = Date.now();

            if (!startTime || Number.isNaN(startTime.getTime())) {
                throw new Error('Invalid meeting start time');
            }
            if (startTime.getTime() <= now + 30000) {
                throw new Error('Meeting time must be in the future');
            }

            if (endTime <= startTime) {
                throw new Error('End time must be after start time');
            }

            if (eventStartDate && eventEndDate) {
                const eventStart = new Date(eventStartDate);
                const eventEnd = new Date(eventEndDate);
                if (startTime < eventStart || endTime > eventEnd) {
                    throw new Error('Meeting must be within event schedule dates');
                }
            }

            await apiClient.post(ENDPOINTS.MEETINGS.REQUEST, {
                visitor_id: 'SELF',
                stand_id: standId,
                event_id: eventId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                purpose: meetingForm.purpose || 'General Inquiry',
            });

            setMeetingForm({ date: '', startTime: '', endTime: '', durationMinutes: 0, purpose: '' });
            // Reset length ref so fetchMeetings treats this as a fresh load
            meetingsLengthRef.current = 0;
            await Promise.all([fetchMeetings(), fetchBusySlots()]);
            // Give the backend a moment to index the new meeting before refreshing again
            await new Promise(res => setTimeout(res, 500));
            // Reset length ref so the next fetch treats it as a fresh load
            meetingsLengthRef.current = 0;
            await fetchMeetings();
            setActiveView('list');
        } catch (error) {
            console.error('Failed to request meeting', error);
            setMeetingError((error as Error)?.message || 'Failed to send request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Only show meetings between the two enterprises for this event
    const filteredMeetings = meetingsProp || meetings;
    const categorizedMeetings = filteredMeetings.map((m) => ({ ...m, timeline: getMeetingTimeline(m) }));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div
                className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border"
                style={{
                    borderColor: `rgba(${r},${g},${b},0.22)`,
                    boxShadow: `0 20px 56px -26px rgba(${r},${g},${b},0.42), 0 8px 20px -14px rgba(15,23,42,0.42)`,
                }}
            >
                <div
                    className="px-6 py-4 border-b flex justify-between items-center"
                    style={{
                        borderBottomColor: `rgba(${r},${g},${b},0.16)`,
                        background: `linear-gradient(180deg, rgba(${r},${g},${b},0.11) 0%, rgba(255,255,255,0.98) 75%)`,
                    }}
                >
                    <div>
                        <h3 className="font-bold text-gray-900">Meetings with {standName}</h3>
                        <p className="text-xs text-gray-500">Event-scoped scheduling with availability constraints • Times shown in {viewerTimeZone}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-76px)]">
                    <div
                        className="flex items-center gap-2 p-1 rounded-xl w-fit"
                        style={{ backgroundColor: `rgba(${r},${g},${b},0.10)` }}
                    >
                        <button
                            onClick={() => {
                                setActiveView('list');
                                fetchMeetings();
                                fetchBusySlots();
                            }}
                            className={clsx(
                                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                                activeView === 'list' ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                            )}
                            style={activeView === 'list' ? { color: themeColor } : undefined}
                        >
                            <MessageSquare size={14} className="inline mr-1.5 -mt-0.5" /> My Meetings
                        </button>
                        <button
                            onClick={() => {
                                setActiveView('request');
                                setLoadingMeetings(false); // Kill spinner instantly
                            }}
                            className={clsx(
                                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                                activeView === 'request' ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                            )}
                            style={activeView === 'request' ? { color: themeColor } : undefined}
                        >
                            <Calendar size={14} className="inline mr-1.5 -mt-0.5" /> Request New
                        </button>
                    </div>

                    {meetingError && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <span>{meetingError}</span>
                        </div>
                    )}

                    {activeView === 'list' ? (
                        <div className="space-y-3">
                            {loadingMeetings && activeView === 'list' ? (
                                <div className="h-40 flex items-center justify-center text-zinc-400 text-sm">
                                    <Loader2 size={18} className="mr-2 animate-spin" /> Loading your meetings...
                                </div>
                            ) : categorizedMeetings.length === 0 ? (
                                <div className="h-40 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-2xl border border-zinc-200">
                                    <Calendar size={36} className="text-zinc-300 mb-2" />
                                    <p className="font-semibold text-zinc-500">No meetings with this enterprise in this event yet.</p>
                                    <Button
                                        className="mt-3 text-white"
                                        style={{ backgroundColor: themeColor }}
                                        onClick={() => setActiveView('request')}
                                    >
                                        Request a Meeting
                                    </Button>
                                </div>
                            ) : (
                                categorizedMeetings.map((m) => {
                                    const tl = m.timeline;
                                    const TlIcon = tl.icon;
                                    const canJoin = (m.status === 'approved' || m.session_status === 'live') && (tl.status === 'live' || tl.status === 'starting-soon');
                                    const canCancel = (m.status === 'pending' || m.status === 'approved') && tl.status !== 'ended' && tl.status !== 'expired';

                                    return (
                                        <div key={m.id || m._id} className="border rounded-xl p-4 bg-white">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <span className={clsx('text-[11px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wide', tl.bgColor, tl.color)}>
                                                            <TlIcon size={12} className="inline mr-1 -mt-0.5" /> {tl.label}
                                                        </span>
                                                        <span className={clsx(
                                                            'text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide',
                                                            m.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                            m.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                            m.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                            'bg-zinc-100 text-zinc-600'
                                                        )}>
                                                            {m.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-zinc-900">{m.purpose || 'General discussion'}</p>
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                        {formatInTZ(m.start_time, viewerTimeZone, 'MMM d, yyyy')}
                                                        {' · '}
                                                        {formatInTZ(m.start_time, viewerTimeZone, 'h:mm a')}
                                                        {' - '}
                                                        {formatInTZ(m.end_time, viewerTimeZone, 'h:mm a')}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                                    {m.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                                onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'approved')}
                                                            >
                                                                <CheckCircle2 size={13} className="mr-1.5" /> Approve
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-red-200 text-red-600 hover:bg-red-50"
                                                                onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'rejected')}
                                                            >
                                                                <X size={13} className="mr-1.5" /> Reject
                                                            </Button>
                                                        </>
                                                    )}
                                                    {canJoin && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                            onClick={() => router.push(`/meetings/${m.id || m._id}/room`)}
                                                        >
                                                            <Video size={13} className="mr-1.5" /> Join
                                                        </Button>
                                                    )}
                                                    {canCancel && m.status !== 'pending' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="border-red-200 text-red-600 hover:bg-red-50"
                                                            onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'canceled')}
                                                        >
                                                            <Ban size={13} className="mr-1.5" /> Cancel
                                                        </Button>
                                                    )}
                                                    {!canJoin && !canCancel && m.status !== 'pending' && (
                                                        <span className="text-xs text-zinc-400 flex items-center">
                                                            <CheckCircle2 size={13} className="mr-1.5" /> No actions available
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div
                                className="flex items-start gap-2 p-3 rounded-lg text-xs"
                                style={{
                                    backgroundColor: `rgba(${r},${g},${b},0.10)`,
                                    color: themeColor,
                                }}
                            >
                                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>
                                    Meeting requests are constrained by event schedule, your availability, enterprise availability, and conference overlaps.
                                </span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase text-zinc-400">Event Day</label>
                                {dayAvailability.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {dayAvailability.map((day) => (
                                            <button
                                                type="button"
                                                key={day.dateStr}
                                                disabled={day.disabled}
                                                onClick={() => {
                                                    setMeetingForm((f) => ({ ...f, date: day.dateStr, startTime: '', endTime: '', durationMinutes: 0 }));
                                                    setMeetingError(null);
                                                }}
                                                className={clsx(
                                                    'px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
                                                    day.disabled
                                                            ? 'bg-zinc-50 text-zinc-300 border-zinc-100 cursor-not-allowed'
                                                            : 'bg-white text-zinc-700 border-zinc-200'
                                                )}
                                                style={meetingForm.date === day.dateStr
                                                    ? { backgroundColor: themeColor, borderColor: themeColor, color: '#fff' }
                                                    : day.disabled
                                                        ? undefined
                                                        : { borderColor: `rgba(${r},${g},${b},0.26)` }}
                                            >
                                                {day.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-400 italic">No schedule available for this event.</p>
                                )}
                            </div>

                            {meetingForm.date && (
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-zinc-400">Start Time</label>
                                    {loadingSlots ? (
                                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                                            <Loader2 size={14} className="animate-spin" /> Checking availability...
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pr-1">
                                            {startTimeOptions.map(({ time, disabled }) => {
                                                const conflict = disabled ? null : isSlotBusy(time);
                                                const isDisabled = disabled || !!conflict;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={time}
                                                        disabled={isDisabled}
                                                        title={conflict ? `${conflict.type}: ${conflict.label}` : undefined}
                                                        onClick={() => {
                                                            setMeetingForm((f) => ({ ...f, startTime: time, endTime: '', durationMinutes: 0 }));
                                                            setMeetingError(null);
                                                        }}
                                                        className={clsx(
                                                            'px-2 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                                                            isDisabled
                                                                ? 'bg-red-50 text-red-300 border border-red-100 cursor-not-allowed line-through'
                                                                : meetingForm.startTime === time
                                                                    ? 'text-white'
                                                                    : 'bg-zinc-50 text-zinc-700 border border-zinc-200'
                                                        )}
                                                        style={isDisabled
                                                            ? undefined
                                                            : meetingForm.startTime === time
                                                                ? { backgroundColor: themeColor }
                                                                : { borderColor: `rgba(${r},${g},${b},0.24)` }}
                                                    >
                                                        {time}
                                                    </button>
                                                );
                                            })}
                                            {startTimeOptions.length === 0 && <p className="col-span-full text-xs text-zinc-400 italic">No start slots available.</p>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {meetingForm.startTime && (
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-zinc-400">Duration</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {durationOptions.map(({ duration, endTime, disabled, conflict }) => {
                                            return (
                                                <button
                                                    type="button"
                                                    key={duration}
                                                    disabled={disabled}
                                                    title={conflict ? `${conflict.type}: ${conflict.label}` : undefined}
                                                    onClick={() => {
                                                        setMeetingForm((f) => ({ ...f, durationMinutes: duration, endTime }));
                                                        setMeetingError(null);
                                                    }}
                                                    className={clsx(
                                                        'px-3 py-2 rounded-lg text-xs font-semibold transition-all',
                                                        disabled
                                                            ? 'bg-red-50 text-red-300 border border-red-100 cursor-not-allowed line-through'
                                                            : meetingForm.durationMinutes === duration
                                                                ? 'text-white'
                                                                : 'bg-zinc-50 text-zinc-700 border border-zinc-200'
                                                    )}
                                                        style={disabled
                                                            ? undefined
                                                            : meetingForm.durationMinutes === duration
                                                                ? { backgroundColor: themeColor }
                                                                : { borderColor: `rgba(${r},${g},${b},0.24)` }}
                                                >
                                                    {duration} min
                                                </button>
                                            );
                                        })}
                                        {durationOptions.length === 0 && <p className="col-span-full text-xs text-zinc-400 italic">No valid durations for this start time.</p>}
                                    </div>
                                </div>
                            )}

                            {meetingForm.startTime && meetingForm.endTime && (
                                <div
                                    className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium"
                                    style={{ backgroundColor: `rgba(${r},${g},${b},0.10)`, color: themeColor }}
                                >
                                    <Clock size={16} />
                                    {meetingForm.startTime} <ArrowRight size={12} /> {meetingForm.endTime}
                                    {meetingForm.durationMinutes > 0 && (
                                        <span className="ml-auto text-xs font-bold">{meetingForm.durationMinutes} min</span>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                                <textarea
                                    rows={3}
                                    value={meetingForm.purpose}
                                    onChange={(e) => setMeetingForm((f) => ({ ...f, purpose: e.target.value }))}
                                    placeholder="Briefly describe what you'd like to discuss..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
                                    style={{ ['--tw-ring-color' as string]: `${themeColor}44` }}
                                />
                            </div>

                            <div className="pt-2 flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-40"
                                    onClick={() => setActiveView('list')}
                                >
                                    Back to Meetings
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 text-white"
                                    style={{ backgroundColor: themeColor }}
                                    disabled={loading}
                                >
                                    {loading ? 'Sending Request...' : 'Send Request'}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
