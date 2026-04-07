"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Conference } from '@/types/conference';
import { OrganizerEvent, EventScheduleDay } from '@/types/event';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import { resolveMediaUrl } from '@/lib/media';
import {
    MessageSquare,
    Calendar,
    User,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    Users,
    Video,
    LayoutDashboard,
    ArrowLeft,
    Loader2,
    Building2,
    AlertTriangle,
    Timer,
    CircleDot,
    Ban,
    Hourglass,
    PhoneCall,
    ArrowRight,
    CalendarClock,
    Lock,
    CalendarCheck,
    ShieldAlert,
    Globe,
    Mail,
    FileText,
    Phone,
    MapPin,
    Package,
    Tag,
} from 'lucide-react';
import { ChatPanel } from '@/components/stand/ChatPanel';
import { MeetingRequestModal } from '@/components/stand/MeetingRequestModal';
import clsx from 'clsx';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

// Simple Modal implementation
function Modal({ open, onClose, children }: { open: boolean, onClose: () => void, children: React.ReactNode }) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 relative animate-in fade-in duration-200">
                <button onClick={onClose} className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-700 text-xl">×</button>
                {children}
            </div>
        </div>
    );
}


// ─── Meeting Timeline ────────────────────────────────────────────────────────

type TimelineStatus = 'upcoming' | 'starting-soon' | 'live' | 'ended' | 'expired';

function getMeetingTimeline(m: Meeting): { status: TimelineStatus; label: string; color: string; bgColor: string; icon: typeof Clock } {
    const now = Date.now();
    const start = new Date(m.start_time).getTime();
    const end = new Date(m.end_time).getTime();
    const diff = start - now;
    const minsUntilStart = Math.round(diff / 60000);

    // If meeting is rejected / canceled / completed by backend
    if (m.status === 'rejected') return { status: 'ended', label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-50 border-red-100', icon: Ban };
    if (m.status === 'canceled') return { status: 'ended', label: 'Canceled', color: 'text-zinc-500', bgColor: 'bg-zinc-50 border-zinc-200', icon: Ban };
    if (m.status === 'completed' || m.session_status === 'ended') return { status: 'ended', label: 'Completed', color: 'text-zinc-500', bgColor: 'bg-zinc-50 border-zinc-200', icon: CheckCircle2 };

    // Session is currently live
    if (m.session_status === 'live') return { status: 'live', label: 'Live Now', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: CircleDot };

    // Time already passed but meeting wasn't started
    if (now > end) return { status: 'expired', label: 'Expired', color: 'text-red-500', bgColor: 'bg-red-50/50 border-red-100', icon: Timer };

    // Currently in the meeting window but session not started
    if (now >= start && now <= end) return { status: 'live', label: 'Ready to Join', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: PhoneCall };

    // Starting soon (within 15 min)
    if (minsUntilStart <= 15 && minsUntilStart > 0) return { status: 'starting-soon', label: `In ${minsUntilStart} min`, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', icon: Hourglass };

    // Upcoming – format relative time
    if (minsUntilStart <= 60) return { status: 'upcoming', label: `In ${minsUntilStart} min`, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', icon: Clock };
    const hoursUntil = Math.floor(minsUntilStart / 60);
    if (hoursUntil < 24) return { status: 'upcoming', label: `In ${hoursUntil}h`, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', icon: Clock };
    const daysUntil = Math.floor(hoursUntil / 24);
    return { status: 'upcoming', label: `In ${daysUntil}d`, color: 'text-indigo-600', bgColor: 'bg-indigo-50 border-indigo-200', icon: Clock };
}

function parseClockTime(value?: string): [number, number] | null {
    if (!value || !value.includes(':')) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return [hours, minutes];
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

function buildHalfHourSteps(startTime: string, endTime: string, includeEnd: boolean): string[] {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (start === null || end === null || end <= start) return [];

    const values: string[] = [];
    for (let current = start; current < end; current += 30) {
        values.push(minutesToTime(current));
    }
    if (includeEnd) {
        values.push(minutesToTime(end));
    }
    return values;
}

function getEventScheduleWindow(eventData: OrganizerEvent | null): { start: Date | null; end: Date | null } {
    if (!eventData) return { start: null, end: null };

    const scheduleDays = Array.isArray(eventData.schedule_days) ? eventData.schedule_days : [];
    const baseDateValue = eventData.start_date;

    if (scheduleDays.length > 0 && baseDateValue) {
        let earliest: Date | null = null;
        let latest: Date | null = null;

        for (const day of scheduleDays) {
            const slots = Array.isArray(day.slots) ? day.slots : [];
            const dayOffset = Math.max(0, Number(day.day_number ?? 1) - 1);

            for (const slot of slots) {
                const startParts = parseClockTime(slot.start_time);
                const endParts = parseClockTime(slot.end_time);
                if (!startParts || !endParts) continue;

                const slotStart = new Date(baseDateValue);
                slotStart.setHours(0, 0, 0, 0);
                slotStart.setDate(slotStart.getDate() + dayOffset);
                slotStart.setHours(startParts[0], startParts[1], 0, 0);

                const slotEnd = new Date(baseDateValue);
                slotEnd.setHours(0, 0, 0, 0);
                slotEnd.setDate(slotEnd.getDate() + dayOffset);
                slotEnd.setHours(endParts[0], endParts[1], 0, 0);

                if (!earliest || slotStart < earliest) earliest = slotStart;
                if (!latest || slotEnd > latest) latest = slotEnd;
            }
        }

        if (earliest || latest) {
            return { start: earliest, end: latest };
        }
    }

    return {
        start: eventData.start_date ? new Date(eventData.start_date) : null,
        end: eventData.end_date ? new Date(eventData.end_date) : null,
    };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BusySlot {
    start_time: string;
    end_time: string;
    type: string;
    label: string;
}

interface ChatRoom {
    _id: string;
    id?: string;
    name?: string;
    type: string;
    room_category?: string; // "visitor" | "b2b"
    event_id?: string;
    members: string[];
    created_at: string;
    last_message?: any;
}

interface Meeting {
    _id: string;
    id?: string;
    visitor_id: string;
    stand_id: string;
    start_time: string;
    end_time: string;
    purpose?: string;
    status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'completed';
    created_at: string;
    requester_name?: string;
    requester_role?: string;
    requester_org_name?: string;
    type?: 'inbound' | 'outbound';
    receiver_org_name?: string;
    sender_enterprise_id?: string;
    receiver_enterprise_id?: string;
    session_status?: 'scheduled' | 'live' | 'ended';
}

interface Session {
    id: string;
    title: string;
    speaker: string;
    status: string;
    start_time: string;
    end_time: string;
}

interface Stand {
    id: string;
    name: string;
    event_id: string;
}

interface Participant {
    _id?: string;
    id?: string;
    organization_id?: string;
    organization_name: string;
    role: string;
    status: string;
    stand_id?: string;
    description?: string;
    industry?: string;
    website?: string;
    logo_url?: string;
    contact_email?: string;
    contact_phone?: string;
    location_city?: string;
    location_country?: string;
}

// ─── Components ──────────────────────────────────────────────────────────────

const ChatItem = ({ room, active, onClick, unreadCount, tz }: { room: ChatRoom; active: boolean; onClick: () => void; unreadCount?: number; tz: string }) => (
    <div
        onClick={onClick}
        className={clsx(
            "p-4 cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 flex items-center gap-3",
            active ? "bg-indigo-50 border-l-4 border-l-indigo-600" : "bg-white"
        )}
    >
        <div className={clsx(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            room.room_category === 'b2b' ? "bg-purple-100 text-purple-600" : "bg-zinc-100 text-zinc-500"
        )}>
            {room.room_category === 'b2b' ? <Building2 size={20} /> : <User size={20} />}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-0.5">
                <h4 className="font-bold text-sm text-zinc-900 truncate">
                    {room.name || `Chat #${(room.id || room._id).slice(-4)}`}
                </h4>
                <span className="text-[10px] text-zinc-400">
                    {formatInTZ(room.created_at, tz, 'MMM d')}
                </span>
            </div>
            <p className="text-xs text-zinc-500 truncate">
                {room.last_message?.content || "No messages yet"}
            </p>
        </div>
        {!!unreadCount && unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
        {room.type === 'direct' && <Users size={12} className="text-zinc-300" />}
    </div>
);

export default function EventManagementHub() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const eventId = params.eventId as string;


    const [activeTab, setActiveTab] = useState<'chats' | 'meetings' | 'conferences' | 'partners'>('chats');
    const [chatSubTab, setChatSubTab] = useState<'visitor' | 'b2b'>('visitor');
    const [stand, setStand] = useState<Stand | null>(null);
    const [visitorRooms, setVisitorRooms] = useState<ChatRoom[]>([]);
    const [b2bRooms, setB2bRooms] = useState<ChatRoom[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [lastSeenByRoom, setLastSeenByRoom] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedPartner, setSelectedPartner] = useState<Participant | null>(null);
    const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [myConferences, setMyConferences] = useState<Conference[]>([]);
    const [allConferences, setAllConferences] = useState<Conference[]>([]);
    const [meetingForm, setMeetingForm] = useState({ date: '', startTime: '', endTime: '', purpose: '' });
    const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);
    const [meetingFilter, setMeetingFilter] = useState<'all' | 'upcoming' | 'live' | 'past'>('all');
    const [eventData, setEventData] = useState<OrganizerEvent | null>(null);
    const [meetingModalTab, setMeetingModalTab] = useState<'my-meetings' | 'request-new'>('my-meetings');
    const [partnerMeetings, setPartnerMeetings] = useState<Meeting[] | null>(null);
    const [loadingPartnerMeetings, setLoadingPartnerMeetings] = useState(false);
    const [busySlots, setBusySlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [meetingError, setMeetingError] = useState<string | null>(null);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());
    const [error, setError] = useState<string | null>(null);
    const [isForbidden, setIsForbidden] = useState(false);


    // Polling interval ref for auto-refresh
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch meetings between my org and selected partner org for this event
    const fetchPartnerMeetings = useCallback(async (partnerOrgId: string) => {
        const myOrgId = (stand as any)?.organization_id || (stand as any)?.org_id || (stand as any)?.id || (stand as any)?._id || '';
        if (!myOrgId || !partnerOrgId) return;
        setLoadingPartnerMeetings(true);
        try {
            const url = `/meetings/between-orgs?event_id=${eventId}&org_id_1=${encodeURIComponent(myOrgId)}&org_id_2=${encodeURIComponent(partnerOrgId)}&all_statuses=true`;
            const res = await http.get<Meeting[]>(url);
            // Deduplicate by meeting id
            const deduped: Record<string, Meeting> = {};
            res.forEach((m) => {
                const id = m.id || m._id;
                if (!id) return;
                deduped[id] = m;
            });
            const dedupedArr = Object.values(deduped);
            setPartnerMeetings(dedupedArr);
        } catch (err) {
            console.error('Error fetching partner meetings:', err);
            setPartnerMeetings([]);
        } finally {
            setLoadingPartnerMeetings(false);
        }
    }, [eventId, stand]);

    const fetchRooms = useCallback(async () => {
        try {
            const [vRooms, bRooms] = await Promise.all([
                http.get<ChatRoom[]>(`/chat/rooms?event_id=${eventId}&room_category=visitor`),
                http.get<ChatRoom[]>(`/chat/rooms?event_id=${eventId}&room_category=b2b`),
            ]);
            setVisitorRooms(vRooms);
            setB2bRooms(bRooms);
        } catch (err) {
            console.error('Failed to refresh rooms', err);
        }
    }, [eventId]);

    const fetchMeetings = useCallback(async (standId: string) => {
        try {
            const [inboundMeetings, outboundMeetings] = await Promise.all([
                http.get<Meeting[]>(`/meetings/stand/${standId}?event_id=${eventId}`),
                http.get<Meeting[]>(`/meetings/my-meetings?event_id=${eventId}`),
            ]);

            // Deduplicate meetings by ID
            const deduped: Record<string, Meeting> = {};

            // Add meetings from my-meetings (enriched with correct type by backend)
            outboundMeetings.forEach(m => {
                const id = m.id || m._id;
                if (id) deduped[id] = m;
            });

            // Add meetings from stand-specific list (always inbound for this stand)
            inboundMeetings.forEach(m => {
                const id = m.id || m._id;
                if (id && !deduped[id]) {
                    deduped[id] = { ...m, type: 'inbound' };
                }
            });

            const allMeetings = Object.values(deduped).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setMeetings(allMeetings);
        } catch (err) {
            console.error('Failed to fetch meetings', err);
        }
    }, [eventId]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        let sData: Stand | null = null;

        // 1. Core Data (Required)
        try {
            const evtData = await http.get<OrganizerEvent>(`/events/${eventId}`);
            setEventData(evtData);

            const standData = await http.get<Stand>(`/enterprise/events/${eventId}/stand`);
            setStand(standData);
            sData = standData; // Shared with meetings catch-guard
        } catch (err: any) {
            console.error('Failed to fetch core event data', err);
            if (err.status === 403 || err.status === 404) setIsForbidden(true);
            else setError(err.message || 'An error occurred while loading dashboard data.');
            setIsLoading(false);
            return; // Stop here if core data fails
        }

        // 2. Rooms & Meetings
        try {
            await Promise.all([
                fetchRooms(),
                sData ? fetchMeetings(sData.id) : Promise.resolve()
            ]);
        } catch (err) {
            console.error('Failed to fetch rooms/meetings', err);
        }

        // 3. Sessions
        try {
            const sessionData = await http.get<Session[]>(`/events/${eventId}/sessions`);
            setSessions(sessionData);
        } catch (err) {
            console.error('Failed to fetch sessions', err);
        }

        // 4. Conferences (Handle 403 Forbidden gracefully for enterprise users)
        try {
            const myConfs = await http.get<Conference[]>(`/conferences/my-assigned?event_id=${eventId}`);
            setMyConferences(myConfs);
        } catch (err) { console.error('Failed to fetch my-assigned conferences', err); }

        try {
            const allConfs = await http.get<Conference[]>(`/conferences/?event_id=${eventId}`);
            setAllConferences(allConfs);
        } catch (err: any) {
            // Ignore 403 Forbidden or "Not authenticated" noise for global conferences list
            const msg = String(err.message || '');
            const isIgnorable = msg.includes('403') || msg.includes('Forbidden') || msg.includes('Not authenticated');
            if (!isIgnorable) console.error('Failed to fetch all conferences', err);
        }

        // 5. Partners
        try {
            const participantsData = await http.get<Participant[]>(
                `/participants/event/${eventId}/enterprises`
            );
            const uniqueParticipants = Array.from(
                new Map(
                    participantsData.map((p) => {
                        const key = p.organization_id || p.stand_id || p.id || p._id || p.organization_name;
                        return [key, p] as const;
                    })
                ).values()
            );
            setParticipants(uniqueParticipants);
        } catch (err) {
            console.error('Failed to fetch partners', err);
        }

        setIsLoading(false);
    }, [eventId, fetchRooms, fetchMeetings]);

    useEffect(() => {
        if (eventId) fetchData();
    }, [eventId, fetchData]);

    // Auto-refresh rooms + meetings every 8 seconds for near-real-time UX
    useEffect(() => {
        pollRef.current = setInterval(() => {
            fetchRooms();
            if (stand) fetchMeetings(stand.id);
        }, 8000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchRooms, fetchMeetings, stand]);

    const handleUpdateMeetingStatus = async (id: string, status: string) => {
        try {
            await http.patch(`/meetings/${id}`, { status });
            if (stand) fetchMeetings(stand.id);
            if (selectedPartner) {
                fetchPartnerMeetings(selectedPartner.organization_id || selectedPartner.id || selectedPartner._id || '');
            }
        } catch (err) { console.error(err); }
    };

    const handleStartB2B = async (partnerOrgId: string) => {
        if (!partnerOrgId) {
            console.error('No organization ID found for B2B chat');
            return;
        }
        try {
            const room = await http.post<ChatRoom>(
                `/chat/rooms/b2b/${partnerOrgId}?event_id=${eventId}`, {}
            );
            const roomId = room._id || (room as any).id;
            setSelectedRoomId(roomId);
            setChatSubTab('b2b');
            setActiveTab('chats');
            await fetchRooms();
        } catch (err) { console.error(err); }
    };

    // Fetch busy slots when modal opens
    const fetchBusySlots = useCallback(async (partnerStandId: string) => {
        setLoadingSlots(true);
        try {
            const slots = await http.get<BusySlot[]>(
                `/meetings/busy-slots?event_id=${eventId}&partner_stand_id=${partnerStandId}`
            );
            setBusySlots(slots);
        } catch (err) {
            console.error('Failed to fetch busy slots', err);
        } finally {
            setLoadingSlots(false);
        }
    }, [eventId]);

    // Compute event days for the date picker
    const eventDays = useMemo(() => {
        if (!eventData) return [];
        // Prefer schedule_days if available
        if (eventData.schedule_days && eventData.schedule_days.length > 0) {
            return eventData.schedule_days.map(sd => {
                const tz = eventData.event_timezone || getUserTimezone();
                const baseTimestamp = new Date(eventData.start_date || new Date().toISOString()).getTime();
                const dayOffset = Math.max(0, sd.day_number - 1);
                // Move safely forward by 'dayOffset' days (86400000 ms) in UTC.
                const offsetDate = new Date(baseTimestamp + dayOffset * 24 * 60 * 60 * 1000);
                const dateStr = formatInTZ(offsetDate, tz, 'yyyy-MM-dd');

                return {
                    dateStr,
                    label: sd.date_label || `Day ${sd.day_number}`,
                    slots: sd.slots,
                };
            });
        }
        // Fallback: generate from start_date to end_date
        const days: { dateStr: string; label: string; slots: { start_time: string; end_time: string }[] }[] = [];
        const tz = eventData.event_timezone || getUserTimezone();
        const start = new Date(eventData.start_date);
        const end = new Date(eventData.end_date);
        let d = new Date(start);
        let num = 1;
        while (d <= end) {
            days.push({
                dateStr: d.toISOString().split('T')[0],
                label: `Day ${num} — ${formatInTZ(d, tz, 'EEE, MMM d')}`,
                slots: [{ start_time: '09:00', end_time: '18:00' }],
            });
            d.setDate(d.getDate() + 1);
            num++;
        }
        return days;
    }, [eventData]);

    const getDateTimeValue = useCallback((dateStr: string, time: string) => {
        return fromZonedTime(`${dateStr}T${time}:00`, eventData?.event_timezone || 'UTC').getTime();
    }, [eventData?.event_timezone]);

    const isPastDate = useCallback((dateStr: string) => {
        const targetEndOfDay = fromZonedTime(`${dateStr}T23:59:59`, eventData?.event_timezone || 'UTC').getTime();
        return targetEndOfDay < Date.now();
    }, [eventData?.event_timezone]);

    const isPastDateTime = useCallback((dateStr: string, time: string) => {
        return getDateTimeValue(dateStr, time) <= Date.now() + 30000;
    }, [getDateTimeValue]);

    const dayAvailability = useMemo(() => {
        return eventDays.map((day) => {
            const segments = buildScheduleSegments(day.slots);
            const hasFutureStart = segments.some((segment) =>
                buildHalfHourSteps(segment.start, segment.end, false).some((time) => !isPastDateTime(day.dateStr, time))
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
            buildHalfHourSteps(segment.start, segment.end, false).map((time) => ({
                time,
                disabled: isPastDateTime(selectedDay.dateStr, time),
            }))
        );
    }, [selectedDay, selectedDaySegments, isPastDateTime]);

    const endTimeOptions = useMemo(() => {
        if (!selectedDay || !meetingForm.startTime) return [];
        const startMinutes = timeToMinutes(meetingForm.startTime);
        if (startMinutes === null) return [];

        const segment = selectedDaySegments.find((item) => {
            const segmentStart = timeToMinutes(item.start);
            const segmentEnd = timeToMinutes(item.end);
            return segmentStart !== null && segmentEnd !== null && startMinutes >= segmentStart && startMinutes < segmentEnd;
        });
        if (!segment) return [];

        const values = buildHalfHourSteps(meetingForm.startTime, segment.end, true).slice(1);
        return values.map((time) => ({
            time,
            disabled: isPastDateTime(selectedDay.dateStr, time),
        }));
    }, [selectedDay, selectedDaySegments, meetingForm.startTime, isPastDateTime]);

    useEffect(() => {
        if (!meetingForm.startTime || !meetingForm.endTime) return;
        const stillValid = endTimeOptions.some((option) => option.time === meetingForm.endTime && !option.disabled);
        if (!stillValid) {
            setMeetingForm((prev) => ({ ...prev, endTime: '' }));
        }
    }, [meetingForm.startTime, meetingForm.endTime, endTimeOptions]);

    // Check if a time slot is busy
    const isSlotBusy = useCallback((time: string, isEnd = false) => {
        if (!meetingForm.date) return null;
        const dt = new Date(`${meetingForm.date}T${time}:00`);
        for (const bs of busySlots) {
            const bsStart = new Date(bs.start_time);
            const bsEnd = new Date(bs.end_time);
            if (isEnd) {
                // For end time: conflict if dt > bsStart && startDt < bsEnd
                const startDt = new Date(`${meetingForm.date}T${meetingForm.startTime}:00`);
                if (dt > bsStart && startDt < bsEnd) return bs;
            } else {
                // For start time: conflict if dt >= bsStart && dt < bsEnd
                if (dt >= bsStart && dt < bsEnd) return bs;
            }
        }
        return null;
    }, [meetingForm.date, meetingForm.startTime, busySlots]);

    const handleCreateB2BMeeting = async () => {
        if (!selectedPartner?.stand_id || !meetingForm.date || !meetingForm.startTime || !meetingForm.endTime) return;
        setIsSubmittingMeeting(true);
        setMeetingError(null);
        try {
            const timeZone = eventData?.event_timezone || 'UTC';
            const start = fromZonedTime(`${meetingForm.date}T${meetingForm.startTime}:00`, timeZone);
            const end = fromZonedTime(`${meetingForm.date}T${meetingForm.endTime}:00`, timeZone);

            await http.post('/meetings/', {
                visitor_id: user?._id || user?.id || "SELF",
                stand_id: selectedPartner.stand_id,
                event_id: eventId,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                purpose: meetingForm.purpose,
            });
            setIsMeetingModalOpen(false);
            setMeetingForm({ date: '', startTime: '', endTime: '', purpose: '' });
            setBusySlots([]);
            if (stand) fetchMeetings(stand.id);
        } catch (err: any) {
            const detail = err?.body?.detail || err?.message || 'Failed to create meeting';
            setMeetingError(detail);
            console.error('Failed to create B2B meeting', err);
        } finally {
            setIsSubmittingMeeting(false);
        }
    };

    // Determine which rooms to show based on sub-tab
    const displayedRooms = chatSubTab === 'b2b' ? b2bRooms : visitorRooms;
    const activeRoom = displayedRooms.find(r => (r.id || r._id) === selectedRoomId);

    const getMessageTime = (message?: any) => {
        if (!message) return null;
        const raw = message.timestamp || message.created_at || message.createdAt || message.sent_at;
        const value = raw ? new Date(raw).getTime() : null;
        return Number.isFinite(value) ? value : null;
    };

    const allRooms = useMemo(() => [...visitorRooms, ...b2bRooms], [visitorRooms, b2bRooms]);

    useEffect(() => {
        if (!selectedRoomId) return;
        const selectedRoom = allRooms.find((room) => (room.id || room._id) === selectedRoomId);
        const lastMessageTime = getMessageTime(selectedRoom?.last_message) ?? Date.now();
        setLastSeenByRoom((prev) => ({ ...prev, [selectedRoomId]: lastMessageTime }));
    }, [allRooms, selectedRoomId]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    const unreadByRoomId = useMemo(() => {
        return allRooms.reduce<Record<string, number>>((acc, room) => {
            const roomId = room.id || room._id;
            const lastMessageTime = getMessageTime(room.last_message);
            const lastSeenTime = lastSeenByRoom[roomId] || 0;
            if (roomId !== selectedRoomId && lastMessageTime && lastMessageTime > lastSeenTime) {
                acc[roomId] = 1;
            }
            return acc;
        }, {});
    }, [allRooms, lastSeenByRoom, selectedRoomId]);

    const unreadTotal = useMemo(() => Object.values(unreadByRoomId).reduce((sum, v) => sum + v, 0), [unreadByRoomId]);

    // ── Event Timeline Gating ─────────────────────────────────────────────
    const eventTimeline = useMemo(() => {
        if (!eventData) return null;
        const state = eventData.state;
        const lifecycle = getEventLifecycle(eventData);

        let res: any = null;
        if (state === 'closed') {
            res = { gate: 'ended' as const, title: eventData.title, startDate: lifecycle.startsAt?.toISOString() || eventData.start_date, endDate: lifecycle.endsAt?.toISOString() || eventData.end_date };
        } else if (state === 'rejected') {
            res = { gate: 'rejected' as const, title: eventData.title, reason: eventData.rejection_reason };
        } else if (['pending_approval', 'waiting_for_payment', 'payment_proof_submitted'].includes(state)) {
            res = { gate: 'not-ready' as const, title: eventData.title, state };
        } else if (state === 'approved' || state === 'payment_done' || state === 'live') {
            if (!lifecycle.hasScheduleSlots) {
                res = { gate: 'timeline-missing' as const, title: eventData.title };
            } else if (lifecycle.status === 'live') {
                res = { gate: 'active' as const, title: eventData.title };
            } else if (lifecycle.betweenSlots) {
                res = { gate: 'between-slots' as const, title: eventData.title, nextSlotStart: lifecycle.nextSlotStart?.toISOString() };
            } else if (lifecycle.status === 'ended') {
                res = { gate: 'ended' as const, title: eventData.title, startDate: lifecycle.startsAt?.toISOString() || eventData.start_date, endDate: lifecycle.endsAt?.toISOString() || eventData.end_date };
            } else {
                res = {
                    gate: 'not-started' as const,
                    title: eventData.title,
                    nextSlotStart: lifecycle.nextSlotStart?.toISOString() || null,
                    startDate: lifecycle.startsAt?.toISOString() || eventData.start_date,
                    endDate: lifecycle.endsAt?.toISOString() || eventData.end_date,
                };
            }
        } else {
            res = { gate: 'not-ready' as const, title: eventData.title, state };
        }
        return res;
    }, [eventData, timelineNow]);

    // Allow users to view data for ended events.

    if (isLoading && !stand && !isForbidden) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    if (isForbidden) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-8">
                    <Clock size={48} className="text-amber-500 animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-4 tracking-tight">Approval Pending</h2>
                <p className="text-zinc-500 max-w-md leading-relaxed mb-10">
                    Your enterprise participation is currently being reviewed by the exhibition organizers.
                    You will have full access to this management hub once your stand is approved.
                </p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button onClick={() => fetchData()}>
                        <Loader2 size={16} className="mr-2" /> Refresh Status
                    </Button>
                </div>
            </div>
        );
    }

    {/* ── Event Timeline Gate Screens ────────────────────────────────────── */}

    if (eventTimeline && eventTimeline.gate === 'not-started') {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center mb-8">
                    <CalendarClock size={48} className="text-indigo-500" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Event Not Started Yet</h2>
                <p className="text-lg font-semibold text-indigo-600 mb-2">{eventTimeline.title}</p>
                <p className="text-zinc-500 max-w-lg leading-relaxed mb-8">
                    This event hasn&apos;t opened yet. All features — meetings, chats, conferences, and partner interactions — will be available once the event goes live.
                </p>

                <div className="mb-8 inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700">
                    {formatTimeToStart((eventTimeline as any).nextSlotStart ? new Date((eventTimeline as any).nextSlotStart) : null)}
                </div>

                {/* Event dates */}
                <div className="flex items-center gap-3 text-sm text-zinc-400 mb-10">
                    <Calendar size={14} />
                    <span>{formatInTZ((eventTimeline as any).startDate, eventData?.event_timezone || 'UTC', 'EEEE, MMMM d, yyyy')}</span>
                    <ArrowRight size={14} />
                    <span>{formatInTZ((eventTimeline as any).endDate, eventData?.event_timezone || 'UTC', 'EEEE, MMMM d, yyyy')}</span>
                </div>

                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button onClick={() => fetchData()}>
                        <Loader2 size={16} className="mr-2" /> Refresh
                    </Button>
                </div>
            </div>
        );
    }

    if (eventTimeline && eventTimeline.gate === 'between-slots') {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center mb-8">
                    <Hourglass size={48} className="text-blue-500" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Event In Progress</h2>
                <p className="text-lg font-semibold text-blue-600 mb-2">{eventTimeline.title}</p>
                <p className="text-zinc-500 max-w-lg leading-relaxed mb-6">
                    The event is currently between schedule slots. Management features are temporarily locked and reopen automatically at the next live slot.
                </p>
                <div className="mb-8 inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                    {formatTimeToStart((eventTimeline as any).nextSlotStart ? new Date((eventTimeline as any).nextSlotStart) : null)}
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button onClick={() => fetchData()}>
                        <Loader2 size={16} className="mr-2" /> Refresh
                    </Button>
                </div>
            </div>
        );
    }

    if (eventTimeline && eventTimeline.gate === 'timeline-missing') {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-8">
                    <AlertTriangle size={48} className="text-amber-500" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Timeline Not Published Yet</h2>
                <p className="text-lg font-semibold text-amber-600 mb-2">{eventTimeline.title}</p>
                <p className="text-zinc-500 max-w-lg leading-relaxed mb-10">
                    This event does not have published schedule slots yet. Meetings, conferences, and live interactions unlock only during live slots.
                </p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button onClick={() => fetchData()}>
                        <Loader2 size={16} className="mr-2" /> Refresh
                    </Button>
                </div>
            </div>
        );
    }

    if (eventTimeline && eventTimeline.gate === 'ended') {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center mb-8">
                    <CalendarCheck size={48} className="text-zinc-400" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Event Has Ended</h2>
                <p className="text-lg font-semibold text-zinc-500 mb-2">{eventTimeline.title}</p>
                <p className="text-zinc-400 max-w-lg leading-relaxed mb-6">
                    This exhibition has concluded. Meeting rooms, live chats, and conference sessions are no longer available.
                    Thank you for your participation.
                </p>
                <p className="text-sm font-medium text-zinc-500 mb-6">
                    Redirecting you back to your enterprise events dashboard...
                </p>

                {/* Event period */}
                <div className="flex items-center gap-3 text-sm text-zinc-400 mb-8">
                    <Calendar size={14} />
                    <span>{new Date((eventTimeline as any).startDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                    <ArrowRight size={14} />
                    <span>{new Date((eventTimeline as any).endDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                </div>

                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`/enterprise/events/${eventId}/analytics`)}>
                        <LayoutDashboard size={16} className="mr-2" /> View Analytics
                    </Button>
                </div>
            </div>
        );
    }

    if (eventTimeline && eventTimeline.gate === 'rejected') {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center mb-8">
                    <ShieldAlert size={48} className="text-red-400" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Event Rejected</h2>
                <p className="text-lg font-semibold text-red-500 mb-2">{eventTimeline.title}</p>
                <p className="text-zinc-500 max-w-lg leading-relaxed mb-4">
                    This event was not approved by the platform administrators. Access to all event features is unavailable.
                </p>
                {(eventTimeline as any).reason && (
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-red-600 text-sm max-w-md mb-10">
                        <strong>Reason:</strong> {(eventTimeline as any).reason}
                    </div>
                )}
                <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                    <ArrowLeft size={16} className="mr-2" /> Back to Events
                </Button>
            </div>
        );
    }

    if (eventTimeline && eventTimeline.gate === 'not-ready') {
        const stateLabels: Record<string, string> = {
            pending_approval: 'Pending platform approval',
            waiting_for_payment: 'Waiting for organizer payment',
            payment_proof_submitted: 'Payment verification in progress',
        };
        const currentState = (eventTimeline as any).state || '';
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-8">
                    <Lock size={48} className="text-amber-500" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-3 tracking-tight">Event Not Available</h2>
                <p className="text-lg font-semibold text-amber-600 mb-2">{eventTimeline.title}</p>
                <p className="text-zinc-500 max-w-lg leading-relaxed mb-6">
                    This event is currently being prepared. All interactive features will become available once the event is fully set up and goes live.
                </p>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium mb-10">
                    <Hourglass size={14} className="animate-pulse" />
                    {stateLabels[currentState] || 'Event setup in progress'}
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button onClick={() => fetchData()}>
                        <Loader2 size={16} className="mr-2" /> Refresh
                    </Button>
                </div>
            </div>
        );
    }


        return (
            <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in duration-500">
                {/* Event Info Section */}
                <Card className="mb-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-1">{eventData?.title || 'Event'}</h2>
                            <div className="text-sm text-zinc-500 mb-1">{eventData?.description}</div>
                            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                                <span><Calendar size={12} className="inline mr-1" />{eventData?.start_date?.slice(0, 10)} to {eventData?.end_date?.slice(0, 10)}</span>
                                <span><Globe size={12} className="inline mr-1" />{eventData?.event_timezone}</span>
                                {eventData?.location && <span><MapPin size={12} className="inline mr-1" />{eventData.location}</span>}
                                {eventData?.category && <span><Tag size={12} className="inline mr-1" />{eventData.category}</span>}
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button variant="outline" size="sm" onClick={() => router.push(`/enterprise/events/${eventId}/analytics`)}>
                                <LayoutDashboard size={14} className="mr-2" /> Analytics
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => router.push(`/enterprise/events/${eventId}/manage/requests`)}>
                                <Package size={14} className="mr-2" /> Requests
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => router.push(`/enterprise/events/${eventId}/stand`)}>
                                <Calendar size={14} className="mr-2" /> Config
                            </Button>
                        </div>
                    </CardHeader>
                </Card>


                {/* ...existing code... */}

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl w-fit">
                {[
                    { id: 'chats', label: 'Chats', icon: MessageSquare, count: visitorRooms.length + b2bRooms.length },
                    { id: 'meetings', label: 'Meetings', icon: Calendar, count: meetings.filter(m => m.status === 'pending').length },
                    { id: 'conferences', label: 'Conferences', icon: Video, count: allConferences.length },
                    { id: 'partners', label: 'Partners', icon: Users, count: participants.length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={clsx(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                            activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                        )}
                    >
                        <tab.icon size={16} /> {tab.label}
                        {tab.id === 'chats' && unreadTotal > 0 && (
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                                {unreadTotal > 9 ? '9+' : unreadTotal}
                            </span>
                        )}
                        {tab.count > 0 && (
                            <span className={clsx(
                                "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                                tab.id === 'meetings' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-600"
                            )}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {activeTab === 'chats' && (
                <Card className="flex-1 border-zinc-200 overflow-hidden flex flex-col md:flex-row shadow-sm min-h-0 bg-white">
                    {/* Sidebar */}
                    <div className={clsx(
                        "w-full md:w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/30",
                        selectedRoomId ? "hidden md:flex" : "flex"
                    )}>
                        {/* Chat sub-tabs: Visitor / B2B */}
                        <div className="flex border-b border-zinc-100 bg-white">
                            <button
                                onClick={() => { setChatSubTab('visitor'); setSelectedRoomId(null); }}
                                className={clsx(
                                    "flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors",
                                    chatSubTab === 'visitor'
                                        ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50"
                                        : "text-zinc-400 hover:text-zinc-600"
                                )}
                            >
                                <User size={12} className="inline mr-1.5 -mt-0.5" />
                                Visitors {visitorRooms.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-[10px]">{visitorRooms.length}</span>}
                            </button>
                            <button
                                onClick={() => { setChatSubTab('b2b'); setSelectedRoomId(null); }}
                                className={clsx(
                                    "flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors",
                                    chatSubTab === 'b2b'
                                        ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50"
                                        : "text-zinc-400 hover:text-zinc-600"
                                )}
                            >
                                <Building2 size={12} className="inline mr-1.5 -mt-0.5" />
                                Enterprise {b2bRooms.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[10px]">{b2bRooms.length}</span>}
                            </button>
                        </div>

                        <div className="p-4 border-b border-zinc-100 bg-white">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Find conversation..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {displayedRooms
                                .filter(r => !search || (r.name || '').toLowerCase().includes(search.toLowerCase()))
                                .map(room => (
                                    <ChatItem
                                        key={room.id || room._id}
                                        room={room}
                                        tz={eventData?.event_timezone || 'UTC'}
                                        active={selectedRoomId === (room.id || room._id)}
                                        unreadCount={unreadByRoomId[room.id || room._id]}
                                        onClick={() => {
                                            const roomId = room.id || room._id;
                                            const lastMessageTime = getMessageTime(room.last_message) ?? Date.now();
                                            setLastSeenByRoom((prev) => ({ ...prev, [roomId]: lastMessageTime }));
                                            setSelectedRoomId(roomId);
                                        }}
                                    />
                                ))
                            }
                            {displayedRooms.length === 0 && (
                                <div className="p-10 text-center">
                                    {chatSubTab === 'b2b'
                                        ? <Building2 size={32} className="mx-auto text-zinc-200 mb-3" />
                                        : <MessageSquare size={32} className="mx-auto text-zinc-200 mb-3" />}
                                    <p className="text-zinc-400 text-xs">
                                        {chatSubTab === 'b2b'
                                            ? "No enterprise chats yet. Start one from the Partners tab."
                                            : "No visitor chats for this event yet."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat Window */}
                    <div className={clsx(
                        "flex-1 bg-white relative",
                        !selectedRoomId ? "hidden md:flex" : "flex flex-col h-full"
                    )}>
                        {selectedRoomId ? (
                            <>
                                <div className="md:hidden border-b border-zinc-100 bg-white px-4 py-3.5 flex items-center gap-3">
                                    <button 
                                        onClick={() => setSelectedRoomId(null)}
                                        className="p-1.5 rounded-xl bg-zinc-50 text-zinc-500 hover:bg-zinc-100 transition-all"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <h4 className="font-black text-sm text-zinc-900 truncate">
                                        {activeRoom?.name || "Chat"}
                                    </h4>
                                </div>
                                <div className="flex-1 min-h-0 relative">
                                    <ChatPanel
                                        initialRoomId={selectedRoomId!}
                                        standName={activeRoom?.name || "Member"}
                                        isEmbedded={true}
                                        disableMessageLimit={true}
                                        eventTimeZone={eventData?.event_timezone}
                                        onClose={() => setSelectedRoomId(null)}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                                <div className={clsx(
                                    "w-20 h-20 rounded-3xl flex items-center justify-center mb-6",
                                    chatSubTab === 'b2b' ? "bg-purple-50 text-purple-500" : "bg-indigo-50 text-indigo-500"
                                )}>
                                    {chatSubTab === 'b2b' ? <Building2 size={40} /> : <MessageSquare size={40} />}
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">
                                    {chatSubTab === 'b2b' ? 'Enterprise Conversations' : 'Visitor Conversations'}
                                </h3>
                                <p className="text-zinc-500 max-w-sm">
                                    {chatSubTab === 'b2b'
                                        ? 'Select a Enterprise chat to connect with partner enterprises.'
                                        : 'Select a chat to talk with visitors who contacted your stand.'}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {activeTab === 'meetings' && (() => {
                // Categorize meetings by timeline
                const categorized = meetings.map(m => ({ ...m, _tl: getMeetingTimeline(m) }));
                const liveMeetings = categorized.filter(m => m._tl.status === 'live' || m._tl.status === 'starting-soon');
                const upcomingMeetings = categorized.filter(m => m._tl.status === 'upcoming');
                const pastMeetings = categorized.filter(m => m._tl.status === 'ended' || m._tl.status === 'expired');
                const pendingInbound = categorized.filter(m => m.status === 'pending' && m.type === 'inbound' && m._tl.status !== 'expired' && m._tl.status !== 'ended');

                const filtered = meetingFilter === 'live' ? liveMeetings
                    : meetingFilter === 'upcoming' ? upcomingMeetings
                    : meetingFilter === 'past' ? pastMeetings
                    : categorized;

                return (
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {/* Meeting sub-filters */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {[
                            { id: 'all' as const, label: 'All', count: meetings.length },
                            { id: 'live' as const, label: 'Live & Soon', count: liveMeetings.length },
                            { id: 'upcoming' as const, label: 'Upcoming', count: upcomingMeetings.length },
                            { id: 'past' as const, label: 'Past', count: pastMeetings.length },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setMeetingFilter(f.id)}
                                className={clsx(
                                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all border",
                                    meetingFilter === f.id
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : "bg-white text-zinc-500 border-zinc-200 hover:border-indigo-300"
                                )}
                            >
                                {f.label}
                                {f.count > 0 && (
                                    <span className={clsx(
                                        "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full",
                                        meetingFilter === f.id ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                                    )}>{f.count}</span>
                                )}
                            </button>
                        ))}

                        {/* Pending inbound badge */}
                        {pendingInbound.length > 0 && (
                            <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                                <Hourglass size={12} />
                                {pendingInbound.length} awaiting your response
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {filtered.map((m, index) => {
                            const tl = m._tl;
                            const TlIcon = tl.icon;
                            const canJoin = (m.status === 'approved' || m.session_status === 'live') && (tl.status === 'live' || tl.status === 'starting-soon');
                            const isExpired = tl.status === 'expired';
                            const isPast = tl.status === 'ended' || isExpired;

                            return (
                            <Card key={`meeting-${m.id || m._id}-${index}`} className={clsx(
                                "transition-all border",
                                tl.status === 'live' ? "border-emerald-200 shadow-emerald-100/50 shadow-md" :
                                tl.status === 'starting-soon' ? "border-orange-200 shadow-orange-100/50 shadow-sm" :
                                isPast ? "border-zinc-100 opacity-75" :
                                "border-zinc-200 hover:border-indigo-100"
                            )}>
                                <CardContent className="p-0">
                                    {/* Top colored strip for live / starting-soon */}
                                    {(tl.status === 'live' || tl.status === 'starting-soon') && (
                                        <div className={clsx(
                                            "h-1 rounded-t-xl",
                                            tl.status === 'live' ? "bg-emerald-500" : "bg-orange-400"
                                        )} />
                                    )}

                                    <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        {/* Left: Icon + Info */}
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div className={clsx(
                                                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                                                tl.bgColor
                                            )}>
                                                <TlIcon size={22} className={tl.color} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h4 className={clsx("font-bold truncate", isPast ? "text-zinc-400" : "text-zinc-900")}>
                                                        {m.type === 'inbound' ? (m.requester_name || m.requester_org_name || 'Visitor') : `To: ${m.receiver_org_name || 'Partner'}`}
                                                    </h4>
                                                    {/* Timeline badge */}
                                                    <span className={clsx(
                                                        "text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1",
                                                        tl.bgColor, tl.color
                                                    )}>
                                                        {tl.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                        {tl.label}
                                                    </span>
                                                    {/* Approval status badge */}
                                                    <span className={clsx(
                                                        "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                                        m.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                        m.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                                                        m.status === 'rejected' ? "bg-red-100 text-red-600" :
                                                        "bg-zinc-200 text-zinc-500"
                                                    )}>
                                                        {m.status}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                                                        {m.type === 'inbound' ? 'Received' : 'Sent'}
                                                    </span>
                                                </div>
                                                <p className={clsx("text-sm font-medium mb-1.5", isPast ? "text-zinc-400" : "text-zinc-600")}>
                                                    {m.purpose || 'General Discussion'}
                                                </p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar size={11} />
                                                        {formatInTZ(new Date(m.start_time), eventData?.event_timezone || 'UTC', 'MMM d, yyyy')}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Clock size={11} />
                                                        {formatInTZ(new Date(m.start_time), eventData?.event_timezone || 'UTC', 'h:mm a')}
                                                        <ArrowRight size={10} />
                                                        {formatInTZ(new Date(m.end_time), eventData?.event_timezone || 'UTC', 'h:mm a')}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Building2 size={11} />
                                                        {m.type === 'inbound' ? (m.requester_org_name || 'Individual') : (m.receiver_org_name || 'Partner')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex flex-col items-end gap-2 w-full md:w-auto shrink-0">
                                            {/* Pending inbound => Approve/Reject (only if not expired) */}
                                            {m.status === 'pending' && m.type === 'inbound' && !isExpired && (
                                                <div className="flex gap-2 w-full md:w-auto">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="flex-1 md:flex-none text-red-600 border-red-100 hover:bg-red-50"
                                                        onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'rejected')}
                                                    >
                                                        <XCircle size={14} className="mr-1.5" /> Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
                                                        onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'approved')}
                                                    >
                                                        <CheckCircle2 size={14} className="mr-1.5" /> Approve
                                                    </Button>
                                                </div>
                                            )}

                                            {/* Pending outbound => Waiting text */}
                                            {m.status === 'pending' && m.type === 'outbound' && !isExpired && (
                                                <span className="text-xs text-amber-500 font-medium flex items-center gap-1.5">
                                                    <Hourglass size={12} className="animate-pulse" />
                                                    Awaiting partner approval
                                                </span>
                                            )}

                                            {/* Expired pending => Show expired notice */}
                                            {m.status === 'pending' && isExpired && (
                                                <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                                                    <Timer size={12} /> Time slot has passed
                                                </span>
                                            )}

                                            {/* Approved + can join (live / starting-soon) */}
                                            {canJoin && (
                                                <Button
                                                    size="sm"
                                                    className={clsx(
                                                        "text-white px-6",
                                                        tl.status === 'live'
                                                            ? "bg-emerald-600 hover:bg-emerald-700 animate-pulse"
                                                            : "bg-orange-500 hover:bg-orange-600"
                                                    )}
                                                    onClick={() => router.push(`/meetings/${m.id || m._id}/room`)}
                                                >
                                                    <Video size={14} className="mr-1.5" />
                                                    {m.session_status === 'live' ? 'Join Live' : 'Join Now'}
                                                </Button>
                                            )}

                                            {/* Approved but not yet time */}
                                            {m.status === 'approved' && tl.status === 'upcoming' && (
                                                <span className="text-xs text-indigo-500 font-medium flex items-center gap-1.5">
                                                    <Clock size={12} /> Available {tl.label.toLowerCase()}
                                                </span>
                                            )}

                                            {/* Approved but expired without joining */}
                                            {m.status === 'approved' && isExpired && (
                                                <span className="text-xs text-red-400 font-medium flex items-center gap-1.5">
                                                    <Timer size={12} /> Meeting window passed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="h-64 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                                <Calendar size={48} className="text-zinc-200 mb-4" />
                                <h3 className="text-lg font-bold text-zinc-400">
                                    {meetingFilter === 'all' ? 'No Meetings Scheduled' :
                                     meetingFilter === 'live' ? 'No Live Meetings' :
                                     meetingFilter === 'upcoming' ? 'No Upcoming Meetings' :
                                     'No Past Meetings'}
                                </h3>
                                <p className="text-sm text-zinc-400 max-w-xs">
                                    {meetingFilter === 'all'
                                        ? 'When visitors or partners request meetings, they will appear here.'
                                        : 'Try switching to a different filter.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                );
            })()}

            {
                activeTab === 'partners' && (
                    <div className="flex-1 overflow-y-auto pr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {participants.map((p, idx) => {
                                const pId = p.id || p._id || "";
                                const orgId = p.organization_id || "";
                                return (
                                    <Card key={pId || `partner-${idx}`} className="border-zinc-200 hover:border-indigo-200 transition-all group">
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                                                        <Building2 size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                                                            {p.organization_name === 'Unknown Enterprise' ? `Partner #${(orgId || pId).slice(-4)}` : p.organization_name}
                                                        </h4>
                                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Approved Participant</p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="rounded-full w-9 h-9 p-0 text-indigo-600 hover:bg-indigo-50" onClick={() => handleStartB2B(orgId)}>
                                                    <MessageSquare size={18} />
                                                </Button>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 text-xs h-8"
                                                    onClick={() => {
                                                        setSelectedPartner(p);
                                                        setIsPartnerModalOpen(true);
                                                        fetchPartnerMeetings(p.organization_id || p.id || p._id || '');
                                                    }}
                                                >
                                                    Details
                                                </Button>
                                                {p.stand_id && (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        className="flex-1 text-xs h-8 bg-indigo-600"
                                                        onClick={() => {
                                                            setPartnerMeetings(null);
                                                            setLoadingPartnerMeetings(true);
                                                            setSelectedPartner(p);
                                                            setIsMeetingModalOpen(true);
                                                            setMeetingModalTab('my-meetings');
                                                            setMeetingForm({ date: '', startTime: '', endTime: '', purpose: '' });
                                                            setMeetingError(null);
                                                            fetchPartnerMeetings(p.organization_id || p.id || p._id || '');
                                                            if (p.stand_id) fetchBusySlots(p.stand_id);
                                                            else { setBusySlots([]); setLoadingSlots(false); }
                                                        }}
                                                    >
                                                        <Calendar size={12} className="mr-1.5" /> Meeting
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                        {participants.length === 0 && (
                            <div className="h-64 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                                <Users size={48} className="text-zinc-200 mb-4" />
                                <h3 className="text-lg font-bold text-zinc-400">No Partners Available</h3>
                                <p className="text-sm text-zinc-400 max-w-xs">Other enterprises participating in this event will appear here once approved.</p>
                            </div>
                        )}
                    </div>
                )
            }

            {
                activeTab === 'conferences' && (
                    <div className="flex-1 space-y-6 overflow-y-auto">
                        <Card className="border-indigo-100 bg-indigo-50/50 p-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-indigo-900">Event Conferences</h3>
                                <p className="text-sm text-indigo-700 mt-1">View all scheduled live sessions. You can host your assigned talks or join others.</p>
                            </div>
                            <Video size={40} className="text-indigo-400 opacity-50" />
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allConferences.map(c => {
                                const isHost = myConferences.some(mc => mc._id === c._id);
                                const now = new Date();
                                const startTime = new Date(c.start_time);
                                const endTime = new Date(c.end_time);
                                const hasEnded = c.status === 'ended' || now > endTime;
                                const canJoin = c.status === 'live' || (now >= startTime && !hasEnded);
                                // Hosts can go live 15 min early
                                const canGoLive = c.status === 'live' || (now >= new Date(startTime.getTime() - 15 * 60 * 1000) && !hasEnded);
                                return (
                                    <Card key={c._id} className={clsx(
                                        "border-zinc-200 overflow-hidden group transition-all",
                                        isHost ? "border-indigo-200 bg-indigo-50/20" : "hover:border-zinc-300"
                                    )}>
                                        <div className="p-5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">{c.title}</h4>
                                                    {isHost && <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded">You are Hosting</span>}
                                                </div>
                                                <span className={clsx(
                                                    "px-2 py-1 text-[10px] font-bold rounded uppercase",
                                                    c.status === 'live' ? "bg-red-100 text-red-600"
                                                        : hasEnded ? "bg-zinc-200 text-zinc-500"
                                                        : "bg-zinc-100 text-zinc-600"
                                                )}>
                                                    {c.status === 'live' ? '🔴 Live' : hasEnded ? 'Ended' : c.status}
                                                </span>
                                            </div>
                                            <div className="space-y-2 mb-6 text-xs text-zinc-500">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={14} /> {formatInTZ(c.start_time, eventData?.event_timezone || 'UTC', 'MMM d, yyyy h:mm a')}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users size={14} /> {c.attendee_count} attendees
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                {isHost ? (
                                                    <Button
                                                        className={clsx(
                                                            "flex-1 transition-all",
                                                            hasEnded ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                                                                : c.status === 'live' ? "bg-red-600 hover:bg-red-700"
                                                                : "bg-indigo-600 hover:bg-indigo-700"
                                                        )}
                                                        disabled={hasEnded || !canGoLive}
                                                        onClick={() => {
                                                            router.push(`/enterprise/events/${eventId}/conferences/${c._id}/live`);
                                                        }}
                                                    >
                                                        {hasEnded ? 'Conference Ended' : c.status === 'live' ? 'Enter Studio' : canGoLive ? 'Go Live' : 'Not Started Yet'}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant={hasEnded ? "outline" : c.status === 'live' ? "primary" : "primary"}
                                                        className={clsx("flex-1", hasEnded && "opacity-50 cursor-not-allowed")}
                                                        disabled={hasEnded || !canJoin}
                                                        onClick={() => {
                                                            router.push(`/events/${eventId}/live/conferences/${c._id}/watch`);
                                                        }}
                                                    >
                                                        {hasEnded ? 'Conference Ended' : c.status === 'live' ? 'Join Conference' : canJoin ? 'Join Conference' : 'Not Started Yet'}
                                                    </Button>
                                                )}
                                            </div>
                                            {isHost && !hasEnded && (
                                                <p className="text-[10px] text-zinc-400 mt-2 text-center">
                                                    Speakers can go live up to 15 mins before scheduled time.
                                                </p>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                            {allConferences.length === 0 && (
                                <div className="col-span-full h-48 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                                    <Video size={48} className="text-zinc-200 mb-4" />
                                    <h3 className="text-lg font-bold text-zinc-400">No Conferences</h3>
                                    <p className="text-sm text-zinc-400 max-w-xs">There are no conferences scheduled for this event yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Partner Details Modal */}
            {
                isPartnerModalOpen && selectedPartner && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <Card className="w-full max-w-lg max-h-[90vh] shadow-2xl border-none overflow-hidden flex flex-col">
                            <CardHeader className="border-b border-zinc-100 bg-white/80 backdrop-blur-md z-10 shrink-0">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                                            <Building2 className="text-indigo-600" size={18} />
                                        </div>
                                        <CardTitle className="text-lg font-black">Partner Details</CardTitle>
                                    </div>
                                    <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0" onClick={() => setIsPartnerModalOpen(false)}>
                                        <XCircle size={20} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent">
                                <div className="p-6 space-y-6">
                                    {/* Header Section */}
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
                                        <div className="w-24 h-24 rounded-3xl bg-white shadow-sm flex items-center justify-center text-indigo-600 overflow-hidden border border-zinc-100 shrink-0">
                                            {selectedPartner.logo_url ? (
                                                <img src={resolveMediaUrl(selectedPartner.logo_url)} alt={selectedPartner.organization_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Building2 size={48} className="opacity-20" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                                <h3 className="text-2xl font-black text-zinc-900">{selectedPartner.organization_name}</h3>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider">Approved</span>
                                            </div>
                                            <p className="text-zinc-500 text-sm font-medium mb-2">B2B Event Partner</p>
                                            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                                                {selectedPartner.industry && (
                                                    <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-bold">
                                                        {selectedPartner.industry}
                                                    </span>
                                                )}
                                                {selectedPartner.location_country && (
                                                    <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 text-[11px] font-bold flex items-center gap-1">
                                                        <MapPin size={10} /> {selectedPartner.location_country}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Meeting Stats Quick View */}
                                    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                                                <Calendar size={13} /> Meeting Status
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Current Event</span>
                                        </div>
                                        
                                        {loadingPartnerMeetings ? (
                                            <div className="flex items-center justify-center py-4 gap-2 text-zinc-400 text-xs">
                                                <Loader2 className="animate-spin" size={16} /> Analyzing meetings...
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100/50 text-center transition-all hover:scale-[1.02]">
                                                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Approved</p>
                                                    <p className="text-2xl font-black text-emerald-700">{partnerMeetings?.filter(m => m.status === 'approved').length || 0}</p>
                                                </div>
                                                <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100/50 text-center transition-all hover:scale-[1.02]">
                                                    <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Pending</p>
                                                    <p className="text-2xl font-black text-amber-700">{partnerMeetings?.filter(m => m.status === 'pending').length || 0}</p>
                                                </div>
                                                <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100/50 text-center transition-all hover:scale-[1.02]">
                                                    <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Total</p>
                                                    <p className="text-2xl font-black text-indigo-700">{partnerMeetings?.length || 0}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Meeting List with sender/receiver context */}
                                    {!loadingPartnerMeetings && partnerMeetings && partnerMeetings.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                                <Calendar size={13} /> Meetings with this Partner
                                            </div>
                                            <div className="space-y-2">
                                                {[...(partnerMeetings || [])]
                                                    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
                                                    .map((m) => {
                                                        const isSender = (m.type ?? 'outbound') === 'outbound'
                                                        const isReceiver = m.type === 'inbound';
                                                        const now = Date.now();
                                                        const start = new Date(m.start_time).getTime();
                                                        const end = new Date(m.end_time).getTime();
                                                        const canJoin = m.status === 'approved' && now >= start - 5 * 60 * 1000 && now < end;
                                                        const isExpired = now > end && m.status === 'pending';

                                                        return (
                                                            <div key={m.id || m._id} className={clsx(
                                                                "rounded-2xl border p-4 bg-white space-y-3",
                                                                m.status === 'approved' ? "border-emerald-100" :
                                                                m.status === 'pending' ? "border-amber-100" :
                                                                "border-zinc-100"
                                                            )}>
                                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className={clsx(
                                                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                                                                            isSender
                                                                                ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                                                : "bg-violet-50 text-violet-600 border-violet-100"
                                                                        )}>
                                                                            {isSender ? "↑ You sent" : "↓ They sent"}
                                                                        </span>
                                                                        <span className={clsx(
                                                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                                                            m.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                                            m.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                                                                            m.status === 'rejected' ? "bg-red-100 text-red-600" :
                                                                            "bg-zinc-100 text-zinc-500"
                                                                        )}>
                                                                            {m.status}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                                                                        <Calendar size={11} />
                                                                        {formatInTZ(m.start_time, eventData?.event_timezone || 'UTC', 'MMM d, h:mm a')}
                                                                        {' → '}
                                                                        {formatInTZ(m.end_time, eventData?.event_timezone || 'UTC', 'h:mm a')}
                                                                    </span>
                                                                </div>

                                                                {m.purpose && (
                                                                    <p className="text-xs text-zinc-500 italic">&ldquo;{m.purpose}&rdquo;</p>
                                                                )}

                                                                <div className="flex gap-2 flex-wrap">
                                                                    {isReceiver && m.status === 'pending' && !isExpired && (
                                                                        <>
                                                                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                                onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'approved')}>
                                                                                <CheckCircle2 size={12} className="mr-1" /> Approve
                                                                            </Button>
                                                                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-100 hover:bg-red-50"
                                                                                onClick={() => handleUpdateMeetingStatus(m.id || m._id, 'rejected')}>
                                                                                <XCircle size={12} className="mr-1" /> Reject
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                    {isSender && m.status === 'pending' && !isExpired && (
                                                                        <span className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                                                                            <Hourglass size={11} className="animate-pulse" /> Awaiting their approval
                                                                        </span>
                                                                    )}
                                                                    {m.status === 'pending' && isExpired && (
                                                                        <span className="text-xs text-red-400 flex items-center gap-1.5">
                                                                            <Timer size={11} /> Time slot passed
                                                                        </span>
                                                                    )}
                                                                    {canJoin && (
                                                                        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                            onClick={() => router.push(`/meetings/${m.id || m._id}/room`)}>
                                                                            <Video size={12} className="mr-1" /> Join Now
                                                                        </Button>
                                                                    )}
                                                                    {m.status === 'approved' && !canJoin && now < end && (
                                                                        <span className="text-xs text-emerald-600 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg">
                                                                            <CheckCircle2 size={11} /> Approved · starts {formatInTZ(m.start_time, eventData?.event_timezone || 'UTC', 'h:mm a')}
                                                                        </span>
                                                                    )}
                                                                    {m.status === 'approved' && now >= end && (
                                                                        <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                                                                            <CheckCircle2 size={11} /> Meeting ended
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Company Overview */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                            <FileText size={13} /> Company Overview
                                        </div>
                                        <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 text-zinc-600 text-sm leading-relaxed">
                                            {selectedPartner.description || 'This enterprise is participating in the event and is available for direct partnership discussions and meeting requests.'}
                                        </div>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                                                <Globe size={13} /> Contact & Links
                                            </div>
                                            <div className="space-y-3 text-sm text-zinc-600">
                                                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors group">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors shadow-sm">
                                                        <Mail size={14} />
                                                    </div>
                                                    <span className="font-medium truncate">{selectedPartner.contact_email || 'Email not shared'}</span>
                                                </div>
                                                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors group">
                                                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors shadow-sm">
                                                        <Phone size={14} />
                                                    </div>
                                                    <span className="font-medium">{selectedPartner.contact_phone || 'Phone not shared'}</span>
                                                </div>
                                                {selectedPartner.website && (
                                                    <a href={selectedPartner.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 transition-colors group">
                                                        <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors shadow-sm">
                                                            <Globe size={14} />
                                                        </div>
                                                        <span className="font-medium text-indigo-600 truncate">{selectedPartner.website.replace(/^https?:\/\//, '')}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
                                                <MapPin size={13} /> Location Info
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Primary Office</p>
                                                    <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                                        <span className="text-lg">📍</span>
                                                        {[selectedPartner.location_city, selectedPartner.location_country].filter(Boolean).join(', ') || 'Global Headquarters'}
                                                    </p>
                                                </div>
                                                <div className="pt-3 border-t border-zinc-50">
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Event Availability</p>
                                                    <p className="text-xs font-medium text-zinc-600">Available for B2B networking during all event days.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="p-6 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row gap-3 shrink-0">
                                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-6 font-bold shadow-lg shadow-indigo-100" onClick={() => {
                                    setIsPartnerModalOpen(false);
                                    handleStartB2B(selectedPartner.organization_id!);
                                }}>
                                    <MessageSquare className="mr-2" size={18} /> Send Message
                                </Button>
                                {selectedPartner.stand_id && (
                                    <Button variant="outline" className="flex-1 py-6 font-bold border-zinc-200 hover:border-indigo-600 hover:text-indigo-600 transition-all" onClick={() => {
                                        setIsPartnerModalOpen(false);
                                        setIsMeetingModalOpen(true);
                                        setMeetingModalTab('my-meetings');
                                        setMeetingForm({ date: '', startTime: '', endTime: '', purpose: '' });
                                        setMeetingError(null);
                                        fetchPartnerMeetings(selectedPartner.organization_id || selectedPartner.id || selectedPartner._id || '');
                                        if (selectedPartner?.stand_id) fetchBusySlots(selectedPartner.stand_id);
                                    }}>
                                        <Calendar className="mr-2" size={18} /> Request Meeting
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </div>
                )
            }

            {/* Meeting Request Modal */}
            {isMeetingModalOpen && selectedPartner && (
                <MeetingRequestModal
                    isOpen={isMeetingModalOpen}
                    onClose={() => {
                        setIsMeetingModalOpen(false);
                        setMeetingError(null);
                    }}
                    standId={selectedPartner.stand_id || selectedPartner.organization_id || selectedPartner.id || ''}
                    standAliasIds={[
                        String(selectedPartner.stand_id || ''),
                        String(selectedPartner.organization_id || ''),
                        String(selectedPartner.id || ''),
                        String(selectedPartner._id || '')
                    ]}
                    standName={selectedPartner.organization_name}
                    showApproveReject={true}
                    eventId={String(eventId)}
                    eventAliasIds={[String(eventId)]}
                    eventStartDate={eventData?.start_date}
                    eventEndDate={eventData?.end_date}
                    scheduleDays={selectedPartner.stand_id ? eventData?.schedule_days : []}
                    eventTimeZone={eventData?.event_timezone}
                    themeColor="#4f46e5"
                    myStandId={stand?.id || ''}
                    meetings={partnerMeetings as any[]}
                    initialView={meetingModalTab === 'my-meetings' ? 'list' : 'request'}
                    onUpdateStatus={handleUpdateMeetingStatus}
                    onSuccess={async () => {
                        if (selectedPartner) {
                            await fetchPartnerMeetings(selectedPartner.organization_id || selectedPartner.id || selectedPartner._id || '');
                        }
                    }}
                />
            )}
        </div >
    );
}