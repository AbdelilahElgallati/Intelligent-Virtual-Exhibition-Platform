"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
    ArrowRight,
    Search,
    Filter,
    Users
} from 'lucide-react';
import { Container } from '@/components/common/Container';
import { ChatPanel } from '@/components/stand/ChatPanel';
import clsx from 'clsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatRoom {
    _id: string;
    id?: string;
    name?: string;
    type: string;
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
}

interface Stand {
    id: string;
    _id?: string;
    name: string;
    event_id: string;
}

// ─── Chat List Item ──────────────────────────────────────────────────────────

const ChatItem = ({ room, active, onClick, unreadCount }: { room: ChatRoom; active: boolean; onClick: () => void; unreadCount?: number }) => {
    return (
        <div
            onClick={onClick}
            className={clsx(
                "p-4 cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 flex items-center gap-3",
                active ? "bg-indigo-50 border-l-4 border-l-indigo-600" : "bg-white"
            )}
        >
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 shrink-0">
                <User size={20} />
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
            {room.type === 'direct' && <span title="B2B Chat"><Users size={12} className="text-zinc-300" /></span>}
        </div>
    );
};

// ─── Meeting Item ────────────────────────────────────────────────────────────

const MeetingItem = ({ meeting, onStatusUpdate }: { meeting: Meeting; onStatusUpdate: (id: string, status: string) => void }) => {
    const statusStyles = {
        pending: 'bg-amber-50 text-amber-700 border-amber-100',
        approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rejected: 'bg-red-50 text-red-700 border-red-100',
        canceled: 'bg-zinc-50 text-zinc-500 border-zinc-100',
        completed: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    };

    return (
        <Card className="border-zinc-200 hover:border-indigo-200 transition-all overflow-hidden group">
            <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500">
                                <User size={16} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-zinc-900">
                                    Visitor Request #{(meeting.id || meeting._id).slice(-6)}
                                </h4>
                                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                    <Clock size={12} />
                                    Submitted {new Date(meeting.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                                <Calendar size={14} className="text-indigo-500" />
                                <span className="font-semibold">
                                    {new Date(meeting.start_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                                <Clock size={14} className="text-indigo-500" />
                                <span>Duration: 30 min</span>
                            </div>
                        </div>

                        {meeting.purpose && (
                            <p className="text-xs text-zinc-500 bg-indigo-50/50 p-3 rounded-xl italic border border-indigo-50">
                                &ldquo;{meeting.purpose}&rdquo;
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 sm:w-32 justify-center">
                        <span className={clsx(
                            "text-[10px] font-bold px-2 py-1 rounded-full border text-center uppercase tracking-wider",
                            statusStyles[meeting.status]
                        )}>
                            {meeting.status}
                        </span>

                        {meeting.status === 'pending' && (
                            <div className="flex flex-col gap-2 mt-auto">
                                <Button
                                    size="sm"
                                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                                    onClick={() => onStatusUpdate(meeting.id || meeting._id, 'approved')}
                                >
                                    <CheckCircle2 size={12} className="mr-1" /> Approve
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs text-red-600 hover:bg-red-50 border-red-100"
                                    onClick={() => onStatusUpdate(meeting.id || meeting._id, 'rejected')}
                                >
                                    <XCircle size={12} className="mr-1" /> Decline
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function EnterpriseCommunicationsPage() {
    const [activeTab, setActiveTab] = useState<'chats' | 'meetings'>('chats');
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [stands, setStands] = useState<Stand[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [lastSeenByRoom, setLastSeenByRoom] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Events to find stands
            const events = await http.get<any[]>('/enterprise/events');
            const approvedEvents = events.filter(ev => ev.participation?.status === 'approved');

            // 2. Fetch stands for approved events
            const standPromises = approvedEvents.map(ev =>
                http.get<Stand>(`/enterprise/events/${ev.id || ev._id}/stand`)
                    .catch(() => null)
            );
            const standResults = (await Promise.all(standPromises)).filter(s => s !== null) as Stand[];
            setStands(standResults);

            // 3. Fetch Chat Rooms
            const roomsData = await http.get<ChatRoom[]>('/chat/rooms');
            setRooms(roomsData);

            // 4. Fetch Meetings for each stand
            const meetingPromises = standResults.map(s =>
                http.get<Meeting[]>(`/meetings/stand/${s.id || s._id}`)
                    .catch(() => [])
            );
            const meetingResults = await Promise.all(meetingPromises);
            setMeetings(meetingResults.flat().sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ));

        } catch (err) {
            console.error('Failed to fetch communications data', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleUpdateMeetingStatus = async (id: string, status: string) => {
        try {
            await http.patch(`/meetings/${id}`, { status });
            // Refresh meetings
            fetchData();
        } catch (err) {
            console.error('Failed to update meeting status', err);
        }
    };

    const activeRoom = rooms.find(r => (r.id || r._id) === selectedRoomId);

    const getMessageTime = (message?: any) => {
        if (!message) return null;
        const raw = message.timestamp || message.created_at || message.createdAt || message.sent_at;
        const value = raw ? new Date(raw).getTime() : null;
        return Number.isFinite(value) ? value : null;
    };

    useEffect(() => {
        if (!selectedRoomId) return;
        const selectedRoom = rooms.find((room) => (room.id || room._id) === selectedRoomId);
        const lastMessageTime = getMessageTime(selectedRoom?.last_message) ?? Date.now();
        setLastSeenByRoom((prev) => ({ ...prev, [selectedRoomId]: lastMessageTime }));
    }, [rooms, selectedRoomId]);

    const unreadByRoomId = useMemo(() => {
        return rooms.reduce<Record<string, number>>((acc, room) => {
            const roomId = room.id || room._id;
            const lastMessageTime = getMessageTime(room.last_message);
            const lastSeenTime = lastSeenByRoom[roomId] || 0;
            if (roomId !== selectedRoomId && lastMessageTime && lastMessageTime > lastSeenTime) {
                acc[roomId] = 1;
            }
            return acc;
        }, {});
    }, [rooms, lastSeenByRoom, selectedRoomId]);

    const unreadTotal = useMemo(() => Object.values(unreadByRoomId).reduce((sum, v) => sum + v, 0), [unreadByRoomId]);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Tabs */}
            <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('chats')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                        activeTab === 'chats' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    <MessageSquare size={16} /> Chats
                    {unreadTotal > 0 && (
                        <span className="ml-1 text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full">
                            {unreadTotal > 9 ? '9+' : unreadTotal}
                        </span>
                    )}
                    {rooms.length > 0 && (
                        <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                            {rooms.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('meetings')}
                    className={clsx(
                        "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                        activeTab === 'meetings' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                    )}
                >
                    <Calendar size={16} /> Meetings
                    {meetings.filter(m => m.status === 'pending').length > 0 && (
                        <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            {meetings.filter(m => m.status === 'pending').length}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'chats' ? (
                <Card className="flex-1 border-zinc-200 overflow-hidden flex flex-col md:flex-row shadow-sm">
                    {/* Sidebar */}
                    <div className="w-full md:w-80 border-r border-zinc-100 flex flex-col bg-zinc-50/30">
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
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <div key={i} className="p-4 border-b border-zinc-50 animate-pulse flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-zinc-100" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-zinc-100 rounded w-1/2" />
                                            <div className="h-2 bg-zinc-50 rounded w-3/4" />
                                        </div>
                                    </div>
                                ))
                            ) : rooms.length === 0 ? (
                                <div className="p-10 text-center">
                                    <MessageSquare size={32} className="mx-auto text-zinc-200 mb-3" />
                                    <p className="text-zinc-400 text-xs">No active chats yet.</p>
                                </div>
                            ) : (
                                rooms
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
                            )}
                        </div>
                    </div>

                    {/* Chat Window */}
                    <div className="flex-1 bg-white relative">
                        {selectedRoomId ? (
                            <div className="h-full flex flex-col">
                                {/* Use ChatPanel logic but inlined or adapted */}
                                <ChatPanel
                                    initialRoomId={selectedRoomId!}
                                    standName={activeRoom?.name || "Member"}
                                    isEmbedded={true}
                                    onClose={() => setSelectedRoomId(null)}
                                />
                                {/* Note: ChatPanel in this project is 'fixed' and right-positioned. 
                                    For the Hub, we should ideally have an 'InPageChat' component. 
                                    I will adapt ChatPanel or create a specialized one if needed.
                                */}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-500 mb-6">
                                    <MessageSquare size={40} />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">Select a Conversation</h3>
                                <p className="text-zinc-500 max-w-sm">
                                    Select a visitor or enterprise from the list to start or continue your conversation.
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            ) : (
                /* Meetings List */
                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                    {isLoading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="h-32 bg-zinc-100 rounded-2xl animate-pulse" />
                        ))
                    ) : meetings.length === 0 ? (
                        <Card className="border-dashed border-2 border-zinc-200 p-20 text-center">
                            <Calendar size={48} className="mx-auto text-zinc-200 mb-4" />
                            <h3 className="text-lg font-bold text-zinc-900 mb-2">No meetings scheduled</h3>
                            <p className="text-zinc-500">When visitors request meetings with your stands, they will appear here.</p>
                        </Card>
                    ) : (
                        meetings.map(meeting => (
                            <MeetingItem
                                key={meeting.id || meeting._id}
                                meeting={meeting}
                                onStatusUpdate={handleUpdateMeetingStatus}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
