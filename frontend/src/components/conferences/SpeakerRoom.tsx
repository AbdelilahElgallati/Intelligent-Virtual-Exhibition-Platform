'use client';

import React, { useEffect, useState } from 'react';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    useLocalParticipant,
    useRemoteParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import QAPanel from './QAPanel';
import { AlertTriangle, CalendarClock, Clock3, Mic, MicOff, MonitorUp, RefreshCw, Users, Video, VideoOff } from 'lucide-react';

interface SpeakerRoomProps {
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
    eventId?: string;
    onEndSession: () => Promise<void> | void;
    onRefreshToken?: () => Promise<string>;
}

function SpeakerVideoGrid() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
            { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );
    return (
        <GridLayout tracks={tracks} style={{ flex: 1 }}>
            <ParticipantTile />
        </GridLayout>
    );
}

function LiveViewerCount({ fallbackCount }: { fallbackCount: number }) {
    const participants = useRemoteParticipants();
    const liveCount = Math.max(participants.length + 1, fallbackCount);
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {liveCount} watching now
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
    const absMs = Math.max(0, ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function SpeakerControls({
    onEndSession,
    isDisconnected,
    onReconnectRequest,
}: {
    onEndSession: () => Promise<void> | void;
    isDisconnected: boolean;
    onReconnectRequest: () => Promise<void> | void;
}) {
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
    const [controlError, setControlError] = useState<string | null>(null);
    const isScreenShareEnabled = !!localParticipant?.isScreenShareEnabled;

    const ensureMediaPermission = async (kind: 'audio' | 'video' | 'both') => {
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

        const constraints =
            kind === 'audio'
                ? { audio: true, video: false }
                : kind === 'video'
                    ? { audio: false, video: true }
                    : { audio: true, video: true };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        stream.getTracks().forEach((track) => track.stop());
    };

    const withPublishGuard = async (action: () => Promise<void>) => {
        if (!localParticipant) {
            setControlError('Local participant is not ready yet. Please retry in a moment.');
            return;
        }

        try {
            setControlError(null);
            await action();
        } catch (error: unknown) {
            const raw = error instanceof Error ? error.message : 'Unable to publish media track.';
            const isEngineTimeout = /engine not connected|timeout|not connected/i.test(raw);

            if (isEngineTimeout || isDisconnected) {
                try {
                    await onReconnectRequest();
                    setControlError('Reconnected. Please press the control again to publish your track.');
                    return;
                } catch {
                    // fallback to error message below
                }
            }

            const isPermissionError = /NotAllowedError|Permission denied|Permission dismissed|Permission/i.test(raw);

            setControlError(
                isPermissionError
                    ? 'Camera/Microphone permission is blocked in the browser. Allow permissions for localhost and try again.'
                    :
                isEngineTimeout
                    ? 'Publishing failed because the room is not connected. Reconnect and try again.'
                    : raw
            );
        }
    };

    const toggleMic = async () => {
        await withPublishGuard(async () => {
            if (!isMicrophoneEnabled) {
                await ensureMediaPermission('audio');
            }
            await localParticipant!.setMicrophoneEnabled(!isMicrophoneEnabled);
        });
    };

    const toggleCam = async () => {
        await withPublishGuard(async () => {
            if (!isCameraEnabled) {
                await ensureMediaPermission('video');
            }
            await localParticipant!.setCameraEnabled(!isCameraEnabled);
        });
    };

    const toggleScreen = async () => {
        await withPublishGuard(async () => {
            await localParticipant!.setScreenShareEnabled(!isScreenShareEnabled);
        });
    };

    const disconnect = () => onEndSession();

    const controlBase = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors border';

    return (
        <div className="border-t border-zinc-200 bg-white px-4 py-3 flex flex-wrap items-center gap-2">
            <button
                type="button"
                onClick={toggleMic}
                className={`${controlBase} ${isMicrophoneEnabled ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            >
                {isMicrophoneEnabled ? <Mic size={15} /> : <MicOff size={15} />}
                {isMicrophoneEnabled ? 'Microphone On' : 'Microphone Off'}
            </button>

            <button
                type="button"
                onClick={toggleCam}
                className={`${controlBase} ${isCameraEnabled ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            >
                {isCameraEnabled ? <Video size={15} /> : <VideoOff size={15} />}
                {isCameraEnabled ? 'Camera On' : 'Camera Off'}
            </button>

            <button
                type="button"
                onClick={toggleScreen}
                className={`${controlBase} ${isScreenShareEnabled ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100' : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            >
                <MonitorUp size={15} />
                {isScreenShareEnabled ? 'Stop Share' : 'Share Screen'}
            </button>

            <button
                type="button"
                onClick={onReconnectRequest}
                className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
                <RefreshCw size={14} className="mr-1.5" />
                Reconnect
            </button>

            <button
                type="button"
                onClick={disconnect}
                className="ml-auto inline-flex items-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
            >
                End Session
            </button>

            {controlError && (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {controlError}
                </div>
            )}
        </div>
    );
}

export default function SpeakerRoom({
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
    eventId,
    onEndSession,
    onRefreshToken,
}: SpeakerRoomProps) {
    const [roomKey, setRoomKey] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [activeToken, setActiveToken] = useState(token);
    const [isDisconnected, setIsDisconnected] = useState(false);
    const [endingSession, setEndingSession] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [showDisconnectOverlay, setShowDisconnectOverlay] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        setActiveToken(token);
    }, [token]);

    useEffect(() => {
        if (!isDisconnected) {
            setShowDisconnectOverlay(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setShowDisconnectOverlay(true);
        }, 2500);

        return () => window.clearTimeout(timer);
    }, [isDisconnected]);

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
        setIsReconnecting(true);
        try {
            if (onRefreshToken) {
                try {
                    const freshToken = await onRefreshToken();
                    setActiveToken(freshToken);
                } catch {
                    // Continue reconnect with existing token if refresh fails.
                }
            }
            setIsDisconnected(false);
            setShowDisconnectOverlay(false);
            setRoomKey((prev) => prev + 1);
        } finally {
            setIsReconnecting(false);
        }
    };

    const handleExplicitEnd = async () => {
        setEndingSession(true);
        try {
            await onEndSession();
        } finally {
            setEndingSession(false);
        }
    };

    useEffect(() => {
        if (!isDisconnected || endingSession || isReconnecting) return;

        if (reconnectAttempts >= 3) return;

        const retryTimer = window.setTimeout(() => {
            handleReconnect().catch(() => {
                setReconnectAttempts((prev) => prev + 1);
            });
        }, 3000);

        return () => window.clearTimeout(retryTimer);
    }, [isDisconnected, endingSession, isReconnecting, reconnectAttempts]);

    useEffect(() => {
        if (isDisconnected) return;

        const maybeAutoEnableTracks = async () => {
            // Best-effort bootstrap so speaker doesn't stay on placeholder forever.
            try {
                await navigator.mediaDevices?.getUserMedia?.({ audio: true, video: true });
            } catch {
                // Permission prompt may be denied; manual controls still available.
            }
        };

        maybeAutoEnableTracks();
    }, [roomKey, isDisconnected]);

    return (
        <div className="h-screen bg-zinc-100 font-sans text-zinc-900">
            <LiveKitRoom
                key={roomKey}
                token={activeToken}
                serverUrl={serverUrl}
                connect={true}
                audio={true}
                video={true}
                onConnected={() => {
                    setIsDisconnected(false);
                    setReconnectAttempts(0);
                    setShowDisconnectOverlay(false);
                }}
                onDisconnected={() => {
                    if (!endingSession) setIsDisconnected(true);
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
                                    <LiveViewerCount fallbackCount={attendeeCount} />
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarClock size={13} />
                                        {formatDateTime(startTime)} - {formatDateTime(endTime)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {eventId && (
                                    <button
                                        onClick={() => window.location.href = `/enterprise/events/${eventId}/manage`}
                                        className="inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-200"
                                    >
                                        ← Back to Event
                                    </button>
                                )}
                                <button
                                    onClick={handleExplicitEnd}
                                    className="inline-flex items-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                                >
                                    End Session
                                </button>
                            </div>
                        </div>
                    </header>

                    <main className="flex min-h-0 flex-1 flex-col">
                        <div className="relative min-h-0 flex-1 overflow-hidden bg-zinc-950">
                            <RoomAudioRenderer />
                            <SpeakerVideoGrid />
                            {showDisconnectOverlay && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/90 px-4">
                                    <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center text-zinc-100">
                                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <p className="text-sm font-semibold">Connection lost</p>
                                        <p className="mt-1 text-xs text-zinc-300">
                                            Your conference is still active because the timeline has not ended. Reconnect to continue broadcasting.
                                        </p>
                                        {isReconnecting && (
                                            <p className="mt-3 text-xs text-zinc-400">Reconnecting...</p>
                                        )}
                                        {reconnectAttempts > 0 && !isReconnecting && (
                                            <p className="mt-3 text-xs text-zinc-400">Retry attempts: {reconnectAttempts}/3</p>
                                        )}
                                        <button
                                            onClick={handleReconnect}
                                            disabled={isReconnecting}
                                            className="mt-4 inline-flex items-center rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-900"
                                        >
                                            <RefreshCw size={14} className="mr-1.5" />
                                            Reconnect now
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-[11px] text-zinc-100">
                                Presenter: {speakerName || enterpriseName || 'Assigned speaker'}
                            </div>
                        </div>
                        <SpeakerControls
                            onEndSession={handleExplicitEnd}
                            isDisconnected={isDisconnected}
                            onReconnectRequest={handleReconnect}
                        />
                    </main>
                </div>

                <aside className="flex max-h-[45vh] flex-col border-t border-zinc-200 bg-white xl:max-h-none xl:border-l xl:border-t-0">
                    <div className="border-b border-zinc-100 px-5 py-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Speaker Studio</h2>
                        <p className="mt-1 text-sm font-semibold text-zinc-900">Conference operations</p>
                    </div>

                    <div className="border-b border-zinc-100 px-5 py-4 text-sm">
                        <p className="font-semibold text-zinc-800">Speaker</p>
                        <p className="mt-1 text-zinc-600">{speakerName || enterpriseName || 'Not specified'}</p>
                        <p className="mt-3 text-xs text-zinc-500 line-clamp-3">{conferenceDescription || 'Use screen sharing, audio and camera controls to run your conference professionally.'}</p>
                    </div>

                    <div className="border-b border-zinc-100 px-5 py-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Attendees</p>
                        <AttendeesList registeredCount={attendeeCount} />
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        {qaEnabled ? (
                            <QAPanel conferenceId={conferenceId} isSpeaker={true} />
                        ) : (
                            <div className="px-5 py-8 text-sm text-zinc-500">Q&A is disabled for this conference.</div>
                        )}
                    </div>
                </aside>
            </LiveKitRoom>
        </div>
    );
}

function AttendeesList({ registeredCount }: { registeredCount: number }) {
    const participants = useRemoteParticipants();
    const liveNames = participants
        .map((participant) => participant.name || participant.identity)
        .filter((name): name is string => Boolean(name && name.trim()));

    return (
        <div className="mt-2">
            <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-700 font-semibold">
                    <Users size={13} />
                    Live now: {liveNames.length + 1}
                </span>
                <span className="text-zinc-500">Registered: {Math.max(registeredCount, liveNames.length + 1)}</span>
            </div>

            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                <div className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700">You (speaker)</div>
                {liveNames.length === 0 && (
                    <div className="px-2 py-1 text-xs text-zinc-500">No audience connected yet.</div>
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
