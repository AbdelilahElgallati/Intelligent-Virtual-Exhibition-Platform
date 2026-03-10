"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { http } from '@/lib/http';
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
    Building2
} from 'lucide-react';
import { ChatPanel } from '@/components/stand/ChatPanel';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

// ─── Components ──────────────────────────────────────────────────────────────

const ChatItem = ({ room, active, onClick, unreadCount }: { room: ChatRoom; active: boolean; onClick: () => void; unreadCount?: number }) => (
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
                    {new Date(room.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
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

    const [activeTab, setActiveTab] = useState<'chats' | 'meetings' | 'webinar' | 'partners'>('chats');
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
    const [meetingForm, setMeetingForm] = useState({ date: '', time: '', purpose: '' });
    const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);

    // Polling interval ref for auto-refresh
    const pollRef = useRef<NodeJS.Timeout | null>(null);

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
                http.get<Meeting[]>(`/meetings/stand/${standId}`),
                http.get<Meeting[]>('/meetings/my-meetings'),
            ]);

            const allMeetings = [
                ...inboundMeetings.map(m => ({ ...m, type: 'inbound' as const })),
                ...outboundMeetings.map(m => ({ ...m, type: 'outbound' as const })),
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setMeetings(allMeetings);
        } catch (err) {
            console.error('Failed to fetch meetings', err);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch stand for this event
            const standData = await http.get<Stand>(`/enterprise/events/${eventId}/stand`);
            setStand(standData);

            // 2. Fetch Chat Rooms (scoped to this event)
            await fetchRooms();

            // 3. Fetch Meetings (Inbound + Outbound)
            await fetchMeetings(standData.id);

            // 4. Fetch Sessions
            const sessionData = await http.get<Session[]>(`/events/${eventId}/sessions`);
            setSessions(sessionData);

            // 5. Fetch Participants for B2B — backend already excludes self and
            //    only returns approved enterprises, no extra filtering needed.
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
            console.error('Failed to fetch event hub data', err);
        } finally {
            setIsLoading(false);
        }
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

    const handleCreateB2BMeeting = async () => {
        if (!selectedPartner?.stand_id) return;
        setIsSubmittingMeeting(true);
        try {
            const startStr = `${meetingForm.date}T${meetingForm.time}`;
            const start = new Date(startStr);
            const end = new Date(start.getTime() + 30 * 60000); // +30 mins

            await http.post('/meetings/', {
                visitor_id: user?._id || user?.id || "SELF",
                stand_id: selectedPartner.stand_id,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                purpose: meetingForm.purpose,
            });
            setIsMeetingModalOpen(false);
            setMeetingForm({ date: '', time: '', purpose: '' });
            if (stand) fetchMeetings(stand.id);
        } catch (err) {
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

    if (isLoading && !stand) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
                            {stand?.name || "Manage Event"}
                        </h2>
                        <p className="text-sm text-zinc-500">Live interaction hub for this event.</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/enterprise/events/${eventId}/analytics`)}>
                        <LayoutDashboard size={14} className="mr-2" /> Analytics
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/enterprise/events/${eventId}/stand`)}>
                        <Calendar size={14} className="mr-2" /> Config
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl w-fit">
                {[
                    { id: 'chats', label: 'Chats', icon: MessageSquare, count: visitorRooms.length + b2bRooms.length },
                    { id: 'meetings', label: 'Meetings', icon: Calendar, count: meetings.filter(m => m.status === 'pending').length },
                    { id: 'webinar', label: 'Webinar', icon: Video, count: sessions.length },
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
                <Card className="flex-1 border-zinc-200 overflow-hidden flex flex-col md:flex-row shadow-sm">
                    {/* Sidebar */}
                    <div className="w-full md:w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/30">
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
                                B2B {b2bRooms.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[10px]">{b2bRooms.length}</span>}
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
                                            ? "No B2B chats yet. Start one from the Partners tab."
                                            : "No visitor chats for this event yet."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chat Window */}
                    <div className="flex-1 bg-white relative">
                        {selectedRoomId ? (
                            <ChatPanel
                                initialRoomId={selectedRoomId!}
                                standName={activeRoom?.name || "Member"}
                                isEmbedded={true}
                                onClose={() => setSelectedRoomId(null)}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                                <div className={clsx(
                                    "w-20 h-20 rounded-3xl flex items-center justify-center mb-6",
                                    chatSubTab === 'b2b' ? "bg-purple-50 text-purple-500" : "bg-indigo-50 text-indigo-500"
                                )}>
                                    {chatSubTab === 'b2b' ? <Building2 size={40} /> : <MessageSquare size={40} />}
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">
                                    {chatSubTab === 'b2b' ? 'B2B Conversations' : 'Visitor Conversations'}
                                </h3>
                                <p className="text-zinc-500 max-w-sm">
                                    {chatSubTab === 'b2b'
                                        ? 'Select a B2B chat to connect with partner enterprises.'
                                        : 'Select a chat to talk with visitors who contacted your stand.'}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {activeTab === 'meetings' && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    <div className="grid grid-cols-1 gap-4">
                        {meetings.map((m) => (
                            <Card key={m.id || m._id} className="border-zinc-200 hover:border-indigo-100 transition-all">
                                <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                                            m.status === 'pending' ? "bg-amber-50 text-amber-600" :
                                                m.status === 'approved' ? "bg-emerald-50 text-emerald-600" :
                                                    "bg-zinc-100 text-zinc-500"
                                        )}>
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-zinc-900">
                                                    {m.type === 'inbound' ? (m.requester_name || 'Visitor') : `To: ${m.receiver_org_name || 'Partner'}`}
                                                </h4>
                                                <span className={clsx(
                                                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                                                    m.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                        m.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                                                            "bg-zinc-200 text-zinc-600"
                                                )}>
                                                    {m.status}
                                                </span>
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-2">
                                                    {m.type === 'inbound' ? 'Received' : 'Sent'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-zinc-600 font-medium mb-1">{m.purpose || 'General Discussion'}</p>
                                            <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                                                <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(m.start_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="flex items-center gap-1.5"><Building2 size={12} /> {m.type === 'inbound' ? (m.requester_org_name || 'Individual') : 'Request'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {m.status === 'pending' && m.type === 'inbound' && (
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

                                    {m.type === 'outbound' && m.status === 'pending' && (
                                        <div className="text-xs text-zinc-400 font-medium italic">
                                            Waiting for partner approval...
                                        </div>
                                    )}

                                    {m.status === 'approved' && (
                                        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                            <span className="text-xs text-zinc-400 font-medium">
                                                Waiting for the other side to join.
                                            </span>
                                            <Button
                                                size="sm"
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                                onClick={() => {
                                                    console.info('Meeting join is not implemented yet.');
                                                }}
                                            >
                                                Join now
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                        {meetings.length === 0 && (
                            <div className="h-64 flex flex-col items-center justify-center text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                                <Calendar size={48} className="text-zinc-200 mb-4" />
                                <h3 className="text-lg font-bold text-zinc-400">No Meetings Scheduled</h3>
                                <p className="text-sm text-zinc-400 max-w-xs">When visitors or partners request meetings, they will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'partners' && (
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
                                                        setSelectedPartner(p);
                                                        setIsMeetingModalOpen(true);
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
            )}

            {activeTab === 'webinar' && (
                <div className="flex-1 space-y-6 overflow-y-auto">
                    <Card className="border-indigo-100 bg-indigo-50/50 p-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900">Host a Webinar</h3>
                            <p className="text-sm text-indigo-700 mt-1">If you have a speaking session, you can manage it here.</p>
                        </div>
                        <Video size={40} className="text-indigo-400 opacity-50" />
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sessions.map(s => (
                            <Card key={s.id} className="border-zinc-200 overflow-hidden group">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">{s.title}</h4>
                                        <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded uppercase">{s.status}</span>
                                    </div>
                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                            <Clock size={14} /> {new Date(s.start_time).toLocaleString()}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                            <User size={14} /> {s.speaker || "Assigned Speaker"}
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                        disabled={s.status !== 'live' && s.status !== 'upcoming'}
                                        onClick={() => {
                                            if (s.status === 'live' || s.status === 'upcoming') {
                                                window.open(`/sessions/${s.id}`, '_blank');
                                            }
                                        }}
                                    >
                                        {s.status === 'live' ? 'Join Now' : s.status === 'upcoming' ? 'View Details' : 'Closed'}
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Partner Details Modal */}
            {isPartnerModalOpen && selectedPartner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg shadow-2xl border-none">
                        <CardHeader className="border-b border-zinc-100">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Building2 className="text-indigo-600" />
                                    Partner Details
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setIsPartnerModalOpen(false)}>
                                    <XCircle size={20} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <Building2 size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-zinc-900">{selectedPartner.organization_name}</h3>
                                        <p className="text-zinc-500 text-sm">Approved Event Partner</p>
                                    </div>
                                </div>

                                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 italic text-zinc-600 text-sm">
                                    &ldquo;This enterprise is a certified participant in this exhibition. You can initiate a direct B2B chat or request a meeting to discuss partnerships.&rdquo;
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button className="w-full bg-indigo-600 py-6" onClick={() => {
                                        setIsPartnerModalOpen(false);
                                        handleStartB2B(selectedPartner.organization_id!);
                                    }}>
                                        <MessageSquare className="mr-2" size={18} /> Send Message
                                    </Button>
                                    {selectedPartner.stand_id && (
                                        <Button variant="outline" className="w-full py-6" onClick={() => {
                                            setIsPartnerModalOpen(false);
                                            setIsMeetingModalOpen(true);
                                        }}>
                                            <Calendar className="mr-2" size={18} /> Request Meeting
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Meeting Request Modal */}
            {isMeetingModalOpen && selectedPartner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl border-none">
                        <CardHeader className="border-b border-zinc-100">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <Calendar className="text-indigo-600" />
                                    Request B2B Meeting
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setIsMeetingModalOpen(false)}>
                                    <XCircle size={20} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-500 mb-4">
                                    Select a preferred time to meet with <strong>{selectedPartner.organization_name}</strong>.
                                </p>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-zinc-400">Preferred Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={meetingForm.date}
                                        onChange={e => setMeetingForm({ ...meetingForm, date: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-zinc-400">Preferred Time</label>
                                    <input
                                        type="time"
                                        className="w-full p-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={meetingForm.time}
                                        onChange={e => setMeetingForm({ ...meetingForm, time: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-zinc-400">Purpose / Agenda</label>
                                    <textarea
                                        placeholder="What would you like to discuss?"
                                        className="w-full p-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500/20 outline-none h-24 resize-none"
                                        value={meetingForm.purpose}
                                        onChange={e => setMeetingForm({ ...meetingForm, purpose: e.target.value })}
                                    />
                                </div>

                                <Button
                                    className="w-full bg-indigo-600 py-6 mt-4"
                                    disabled={!meetingForm.date || !meetingForm.time || isSubmittingMeeting}
                                    onClick={handleCreateB2BMeeting}
                                >
                                    {isSubmittingMeeting ? <Loader2 className="animate-spin" size={20} /> : "Submit Request"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
