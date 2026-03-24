'use client';

/**
 * SpeakerRoom — Daily.co-based conference speaker component.
 *
 * Replaces the previous LiveKit-based SpeakerRoom.
 * The assigned enterprise host joins with is_owner=true (camera/mic on by default).
 * Preserves the same UI layout: video + controls + sidebar Q&A panel.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useDailyRoom, DailyParticipant } from '@/hooks/useDailyRoom';
import MediaGrid from '../meetings/MediaGrid';
import QAPanel from './QAPanel';
import {
  AlertTriangle, CalendarClock, Clock3, Mic, MicOff,
  MonitorUp, RefreshCw, Users, Video, VideoOff,
} from 'lucide-react';

interface SpeakerRoomProps {
  token: string;
  roomUrl: string;
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

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', hour: '2-digit', minute: '2-digit',
    month: 'short', day: '2-digit',
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


// ── Main component ─────────────────────────────────────────────────────────

export default function SpeakerRoom({
  token,
  roomUrl,
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
  const [now, setNow] = useState(() => Date.now());
  const [endingSession, setEndingSession] = useState(false);
  const [showDisconnectOverlay, setShowDisconnectOverlay] = useState(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    joined,
    error,
    reconnecting,
    localParticipant,
    remoteParticipants,
    allParticipants,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    leave,
    reconnect,
  } = useDailyRoom({
    roomUrl,
    token,
    startVideoOff: false,
    startAudioOff: false,
    onLeft: () => {
      if (!endingSession) {
        // Show reconnect overlay after a short delay
        disconnectTimerRef.current = setTimeout(() => setShowDisconnectOverlay(true), 2500);
      }
    },
    onJoined: () => {
      setShowDisconnectOverlay(false);
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
  }, []);

  const start = startTime ? new Date(startTime).getTime() : null;
  const end = endTime ? new Date(endTime).getTime() : null;
  const isInSession = Boolean(start && end && now >= start && now < end);
  const sessionState = !start
    ? 'Live session'
    : now < start
      ? `Starts in ${formatDuration(start - now)}`
      : isInSession
        ? `Ends in ${formatDuration((end as number) - now)}`
        : `Ended ${formatDuration(now - (end as number))} ago`;

  const handleExplicitEnd = async () => {
    setEndingSession(true);
    try {
      await leave();
      await onEndSession();
    } finally {
      setEndingSession(false);
    }
  };

  const handleReconnect = async () => {
    setShowDisconnectOverlay(false);
    await reconnect();
    if (onRefreshToken) {
      // Parent can provide a fresh token — the hook will re-join automatically
      // via the roomUrl/token effect if you want to wire that up
    }
  };

  const micOn = localParticipant?.audioOn ?? false;
  const camOn = localParticipant?.videoOn ?? false;
  const screenOn = !!localParticipant?.screenVideoTrack;
  const liveCount = remoteParticipants.length + 1; // +1 for self

  const controlBase = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors border';

  // The first remote participant or local is the "primary" speaker feed
  const primaryParticipant = localParticipant;

  return (
    <div className="h-screen bg-zinc-100 font-sans text-zinc-900">
      <div className="grid h-full min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* ── Left: Video + Controls ─────────────────────── */}
        <div className="flex min-w-0 flex-col">
          {/* Header */}
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
                  {reconnecting && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      <RefreshCw size={12} className="animate-spin" />
                      Reconnecting…
                    </span>
                  )}
                </div>
                <h1 className="mt-2 truncate text-base font-bold text-zinc-900">{conferenceTitle}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Users size={13} />
                    {liveCount} watching now
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock size={13} />
                    {formatDateTime(startTime)} – {formatDateTime(endTime)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {eventId && (
                  <button
                    onClick={() => { window.location.href = `/enterprise/events/${eventId}/manage`; }}
                    className="inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-200"
                  >
                    ← Back to Event
                  </button>
                )}
                <button
                  onClick={handleExplicitEnd}
                  disabled={endingSession}
                  className="inline-flex items-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {endingSession ? 'Ending…' : 'End Session'}
                </button>
              </div>
            </div>
          </header>

          {/* Video area */}
          <main className="flex min-h-0 flex-1 flex-col">
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
              {/* Media area */}
              {allParticipants.length > 0 ? (
                <MediaGrid participants={allParticipants} />
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#71717a', fontSize: 14,
                }}>
                  Connecting to room…
                </div>
              )}

              {/* Disconnect overlay */}
              {showDisconnectOverlay && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/90 px-4">
                  <div className="max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-center text-zinc-100">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
                      <AlertTriangle size={20} />
                    </div>
                    <p className="text-sm font-semibold">Connection lost</p>
                    <p className="mt-1 text-xs text-zinc-300">
                      Your conference is still active. Reconnect to continue broadcasting.
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

              {/* Speaker label overlay */}
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-black/55 px-3 py-2 text-[11px] text-zinc-100">
                Presenter: {speakerName || enterpriseName || 'Assigned speaker'}
              </div>
            </div>

            {/* Controls */}
            <div className="border-t border-zinc-200 bg-white px-4 py-3 flex flex-wrap items-center gap-2">
              <button
                type="button" onClick={toggleMic}
                className={`${controlBase} ${micOn ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                {micOn ? <Mic size={15} /> : <MicOff size={15} />}
                {micOn ? 'Microphone On' : 'Microphone Off'}
              </button>

              <button
                type="button" onClick={toggleCam}
                className={`${controlBase} ${camOn ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                {camOn ? <Video size={15} /> : <VideoOff size={15} />}
                {camOn ? 'Camera On' : 'Camera Off'}
              </button>

              <button
                type="button" onClick={toggleScreenShare}
                className={`${controlBase} ${screenOn ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100' : 'border-zinc-200 bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <MonitorUp size={15} />
                {screenOn ? 'Stop Share' : 'Share Screen'}
              </button>

              <button
                type="button" onClick={handleReconnect}
                className="inline-flex items-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                <RefreshCw size={14} className="mr-1.5" />
                Reconnect
              </button>

              <button
                type="button" onClick={handleExplicitEnd} disabled={endingSession}
                className="ml-auto inline-flex items-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                End Session
              </button>

              {error && (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {error}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* ── Right: Sidebar ─────────────────────────────── */}
        <aside className="flex max-h-[45vh] flex-col border-t border-zinc-200 bg-white xl:max-h-none xl:border-l xl:border-t-0">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Speaker Studio</h2>
            <p className="mt-1 text-sm font-semibold text-zinc-900">Conference operations</p>
          </div>

          <div className="border-b border-zinc-100 px-5 py-4 text-sm">
            <p className="font-semibold text-zinc-800">Speaker</p>
            <p className="mt-1 text-zinc-600">{speakerName || enterpriseName || 'Not specified'}</p>
            <p className="mt-3 text-xs text-zinc-500 line-clamp-3">
              {conferenceDescription || 'Use screen sharing, audio and camera controls to run your conference professionally.'}
            </p>
          </div>

          <div className="border-b border-zinc-100 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Attendees</p>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-700 font-semibold">
                  <Users size={13} />
                  Live now: {liveCount}
                </span>
                <span className="text-zinc-500">Registered: {Math.max(attendeeCount, liveCount)}</span>
              </div>
              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                <div className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700">You (speaker)</div>
                {remoteParticipants.length === 0 && (
                  <div className="px-2 py-1 text-xs text-zinc-500">No audience connected yet.</div>
                )}
                {remoteParticipants.map((p) => (
                  <div key={p.sessionId} className="rounded-md bg-white px-2 py-1.5 text-xs text-zinc-700">
                    {p.userName}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {qaEnabled ? (
              <QAPanel conferenceId={conferenceId} isSpeaker={true} />
            ) : (
              <div className="px-5 py-8 text-sm text-zinc-500">Q&A is disabled for this conference.</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
