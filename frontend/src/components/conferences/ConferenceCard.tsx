'use client';

import React from 'react';
import { Conference } from '@/types/conference';
import { useRouter } from 'next/navigation';
import { Users, Clock } from 'lucide-react';
import { formatInTZ } from '@/lib/timezone';
import clsx from 'clsx';

interface ConferenceCardProps {
    conference: Conference;
    eventId: string;
    eventTimeZone?: string;
    onRegister?: (id: string) => void;
    onUnregister?: (id: string) => void;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: 'rgba(79,70,229,0.15)', text: '#818cf8', label: 'Scheduled' },
    live: { bg: 'rgba(16,185,129,0.15)', text: '#34d399', label: '🔴 Live Now' },
    ended: { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8', label: 'Ended' },
    canceled: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', label: 'Canceled' },
};

export default function ConferenceCard({ conference, eventId, eventTimeZone = 'UTC', onRegister, onUnregister }: ConferenceCardProps) {
    const router = useRouter();
    const sc = statusColors[conference.status] || statusColors.scheduled;

    const fmt = (iso: string) =>
        formatInTZ(iso, eventTimeZone, 'dd MMM HH:mm');
    
    const fmtTimeOnly = (iso: string) =>
        formatInTZ(iso, eventTimeZone, 'HH:mm');

    return (
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group relative overflow-hidden">
            {/* Background Accent */}
            <div className={clsx(
                "absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] transition-transform group-hover:scale-150 duration-700",
                conference.status === 'live' ? "bg-emerald-500" : "bg-indigo-500"
            )} />

            {/* Status & Stats */}
            <div className="flex justify-between items-start mb-5 relative z-10">
                <span className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                    conference.status === 'live' ? "bg-emerald-100 text-emerald-700" :
                        conference.status === 'scheduled' ? "bg-indigo-100 text-indigo-700" :
                            "bg-zinc-100 text-zinc-500"
                )}>
                    {conference.status === 'live' ? '🔴 Live Now' : conference.status}
                </span>
                <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                    <Users size={14} className="opacity-50" /> {conference.attendee_count} registered
                </span>
            </div>

            {/* Title & Info */}
            <div className="space-y-3 mb-6 relative z-10">
                <h3 className="text-lg font-black text-zinc-900 group-hover:text-indigo-600 transition-colors leading-tight">
                    {conference.title}
                </h3>

                <div className="space-y-1.5">
                    {conference.speaker_name && (
                        <p className="text-sm font-bold text-indigo-600 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-[10px]">🎙️</span>
                            {conference.speaker_name}
                        </p>
                    )}
                    {conference.assigned_enterprise_name && (
                        <p className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-zinc-50 flex items-center justify-center text-[10px]">🏢</span>
                            {conference.assigned_enterprise_name}
                        </p>
                    )}
                </div>
            </div>

            {/* Description */}
            {conference.description && (
                <p className="text-sm text-zinc-500 line-clamp-2 mb-6 leading-relaxed italic">
                    "{conference.description}"
                </p>
            )}

            {/* Time & Features */}
            <div className="flex flex-col gap-4 mb-8 relative z-10">
                <div className="px-4 py-2 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center gap-3 text-xs font-bold text-zinc-600 w-fit">
                    <Clock size={14} className="text-indigo-500" />
                    <span>{fmt(conference.start_time)} — {fmtTimeOnly(conference.end_time)}</span>
                </div>

                <div className="flex items-center gap-2">
                    {conference.chat_enabled && (
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-1">
                            Chat Enabled
                        </span>
                    )}
                    {conference.qa_enabled && (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-tighter flex items-center gap-1">
                            Q&A Open
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 gap-3 relative z-10">
                {conference.status === 'live' && (
                    <button
                        onClick={() => router.push(`/events/${eventId}/live/conferences/${conference._id}/watch`)}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        Join Live &rarr;
                    </button>
                )}

                {conference.status === 'scheduled' && !conference.is_registered && onRegister && (
                    <button
                        onClick={() => onRegister(conference._id)}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        Register for Session
                    </button>
                )}

                {conference.is_registered && conference.status === 'scheduled' && onUnregister && (
                    <button
                        onClick={() => onUnregister(conference._id)}
                        className="w-full py-3.5 bg-white border border-zinc-200 text-zinc-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 rounded-2xl font-bold text-sm transition-all"
                    >
                        &check; Registered &mdash; Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
