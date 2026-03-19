'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    useRemoteParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import QAPanel from './QAPanel';
import { AlertTriangle, CalendarClock, Clock3, RefreshCw, Users } from 'lucide-react';

interface AudienceRoomProps {
    token: string;
    serverUrl: string;
    conferenceId: string;
    conferenceTitle: string;
    conferenceDescription?: string;
    speakerName?: string;
    enterpriseName?: string;
    startTime?: string;
    endTime?: string;
    attendeeCount: number;
    qaEnabled?: boolean;
    onLeave: () => void;
    onRefreshToken?: () => Promise<string>;
}

function AudienceVideoTrack() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
            { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
        ],
        { onlySubscribed: true }
    );
    return (
        <GridLayout tracks={tracks} style={{ flex: 1 }}>
            <ParticipantTile />
        </GridLayout>
    );
}

function LiveViewerCount() {
    const participants = useRemoteParticipants();
    // +1 to count self
    const total = participants.length + 1;
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {total} watching
        </span>
    );
}

function formatDateTime(value?: string) {
    if (!value) return 'Not set';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not set';
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

function formatDuration(ms: number) {
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function AttendeesList({ registeredCount }: { registeredCount: number }) {
    const participants = useRemoteParticipants();
    const liveNames = participants
        .map((participant) => participant.name || participant.identity)
        .filter((name): name is string => Boolean(name && name.trim()));

    return (
        <div className="mt-2">
            <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-700">
                    <Users size={13} />
                    Live now: {liveNames.length + 1}
                </span>
                <span className="text-zinc-500">Registered: {Math.max(registeredCount, liveNames.length + 1)}</span>
            </div>
            <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 space-y-1">
                <div className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700">You</div>
                {liveNames.length === 0 && (
                    <div className="px-2 py-1 text-xs text-zinc-500">No other attendee connected yet.</div>
                )}
                {liveNames.map((name) => (
                    <div key={name} className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700">
                        {name}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AudienceRoom({
    token,
    serverUrl,
    conferenceId,
    conferenceTitle,
    conferenceDescription,
    speakerName,
    enterpriseName,
    startTime,
    endTime,
    attendeeCount,
    qaEnabled = true,
    onLeave,
    onRefreshToken,
}: AudienceRoomProps) {
    const [roomKey, setRoomKey] = useState(0);
    const [activeToken, setActiveToken] = useState(token);
    const handleDisconnected = useCallback(() => { }, []);
    const [now, setNow] = useState(() => Date.now());
    const [isDisconnected, setIsDisconnected] = useState(false);

    useEffect(() => {
        setActiveToken(token);
    }, [token]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const start = startTime ? new Date(startTime).getTime() : null;
    const end = endTime ? new Date(endTime).getTime() : null;
    const isBeforeStart = Boolean(start && now < start);
    const isInSession = Boolean(start && end && now >= start && now < end);
    const sessionState = isBeforeStart
        ? `Starts in ${formatDuration((start as number) - now)}`
        : isInSession
            ? `Ends in ${formatDuration((end as number) - now)}`
            : end
                ? `Ended ${formatDuration(now - end)} ago`
                : 'Live session';

    const handleReconnect = async () => {
        if (onRefreshToken) {
            try {
                const freshToken = await onRefreshToken();
                setActiveToken(freshToken);
            } catch {
                // Continue with existing token if refresh fails
            }
        }
        setIsDisconnected(false);
        setRoomKey((prev) => prev + 1);
    };

    return (
        <div className="h-screen bg-zinc-100 font-sans text-zinc-900">
            <LiveKitRoom
                key={roomKey}
                token={activeToken}
                serverUrl={serverUrl}
                connect={true}
                audio={false}
                video={false}
                onConnected={() => setIsDisconnected(false)}
                onDisconnected={() => {
                    handleDisconnected();
                    setIsDisconnected(true);
                }}
                className="grid h-full min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]"
            >
                <div className="flex min-w-0 flex-col">
                    <header className="border-b border-zinc-200 bg-white px-5 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-2 rounded-md bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-600">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                                        Live
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                                        <Clock3 size={13} />
                                        {sessionState}
                                    </span>
                                </div>
                                <h1 className="mt-2 truncate text-base font-bold text-zinc-900">{conferenceTitle}</h1>
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                                    <LiveViewerCount />
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarClock size={13} />
                                        {formatDateTime(startTime)} - {formatDateTime(endTime)}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={onLeave}
                                className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200"
                            >
                                Leave
                            </button>
                        </div>
                    </header>

                    <main className="relative flex-1 overflow-hidden bg-zinc-950">
                        <RoomAudioRenderer />
                        <AudienceVideoTrack />
                        {isDisconnected && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/90 px-4">
                                <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center text-zinc-100">
                                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <p className="text-sm font-semibold">Connection lost</p>
                                    <p className="mt-1 text-xs text-zinc-300">
                                        The conference is still running. Reconnect to continue watching and asking questions.
                                    </p>
                                    <button
                                        onClick={handleReconnect}
                                        className="mt-4 inline-flex items-center rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-900"
                                    >
                                        <RefreshCw size={14} className="mr-1.5" />
                                        Reconnect now
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-[11px] text-zinc-100">
                            Speaker: {speakerName || enterpriseName || 'Assigned speaker'}
                        </div>
                    </main>
                </div>

                <aside className="flex max-h-[45vh] flex-col border-t border-zinc-200 bg-white xl:max-h-none xl:border-l xl:border-t-0">
                    <div className="border-b border-zinc-100 px-5 py-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Session Info</h2>
                        <p className="mt-1 text-sm font-semibold text-zinc-900">Ask questions and follow attendees</p>
                    </div>

                    <div className="border-b border-zinc-100 px-5 py-4 text-sm">
                        <p className="font-semibold text-zinc-800">Speaker</p>
                        <p className="mt-1 text-zinc-600">{speakerName || enterpriseName || 'Not specified'}</p>
                        <p className="mt-3 text-xs text-zinc-500 line-clamp-3">{conferenceDescription || 'Watch the live session and use the Q&A panel to ask your questions.'}</p>
                    </div>

                    <div className="border-b border-zinc-100 px-5 py-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Attendees</p>
                        <AttendeesList registeredCount={attendeeCount} />
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        {qaEnabled ? (
                            <QAPanel conferenceId={conferenceId} isSpeaker={false} />
                        ) : (
                            <div className="px-5 py-8 text-sm text-zinc-500">Q&A is disabled for this conference.</div>
                        )}
                    </div>
                </aside>
            </LiveKitRoom>
        </div>
    );
}
