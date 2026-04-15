'use client';

/**
 * AudienceRoom — Daily.co-based conference viewer component.
 *
 * Replaces the previous LiveKit-based AudienceRoom.
 * Viewers join with startVideoOff=true and startAudioOff=true (receive-only).
 * Same visual design preserved: header + speaker video + Q&A sidebar.
 */

import React, { useEffect, useState } from 'react';
import { useDailyRoom } from '@/hooks/useDailyRoom';
import MediaGrid from '../meetings/MediaGrid';
import QAPanel from './QAPanel';
import ConferenceChatPanel from './ConferenceChatPanel';
import { AlertTriangle, CalendarClock, Clock3, Mic, MicOff, RefreshCw, Users, Video, VideoOff } from 'lucide-react';
import { formatInTZ, getUserTimezone, parseISOUTC } from '@/lib/timezone';

interface AudienceRoomProps {
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
  onLeave: () => void;
  onRefreshToken?: () => Promise<string>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(value?: string) {
  if (!value) return 'Not set';
  return formatInTZ(value, getUserTimezone(), 'EEE, MMM d, h:mm a');
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

// ── Speaker video display (receive-only) ───────────────────────────────────


// ── Main component ─────────────────────────────────────────────────────────

export default function AudienceRoom({
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
  onLeave,
  onRefreshToken,
}: Readonly<AudienceRoomProps>) {
  const [now, setNow] = useState(() => Date.now());
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'qa'>('chat');

  const {
    reconnecting,
    localParticipant,
    remoteParticipants,
    allParticipants,
    roomMessages,
    toggleMic,
    toggleCam,
    sendRoomMessage,
    leave,
    reconnect,
  } = useDailyRoom({
    roomUrl,
    token,
    startVideoOff: true,
    startAudioOff: true,  // audience viewers don't publish audio
    startsAtIso: startTime,
    endsAtIso: endTime,
    onJoined: () => setIsDisconnected(false),
    onLeft: () => setIsDisconnected(true),
  });

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, []);

  const start = startTime ? parseISOUTC(startTime).getTime() : null;
  const end = endTime ? parseISOUTC(endTime).getTime() : null;
  const isInSession = Boolean(start && end && now >= start && now < end);
  let sessionState = 'Live session';
  if (start && now < start) {
    sessionState = `Starts in ${formatDuration(start - now)}`;
  } else if (start && end && isInSession) {
    sessionState = `Ends in ${formatDuration(end - now)}`;
  } else if (start && end) {
    sessionState = `Ended ${formatDuration(now - end)} ago`;
  }

  const totalWatching = allParticipants.length;
  const micOn = localParticipant?.audioOn ?? false;
  const camOn = localParticipant?.videoOn ?? false;
  let sidePanelContent: React.ReactNode;
  if (activePanel === 'chat') {
    sidePanelContent = (
      <ConferenceChatPanel
        title="Audience Chat"
        messages={roomMessages}
        onSend={sendRoomMessage}
      />
    );
  } else if (qaEnabled) {
    sidePanelContent = <QAPanel conferenceId={conferenceId} isSpeaker={false} />;
  } else {
    sidePanelContent = (
      <div className="p-8 text-center">
        <p className="text-xs text-zinc-600">Q&A is currently disabled</p>
      </div>
    );
  }

  const handleLeave = async () => {
    await leave();
    onLeave();
  };

  const handleReconnect = async () => {
    setIsDisconnected(false);
    await reconnect();
  };

  return (
    <div className="h-screen bg-[#070709] font-sans text-zinc-100 overflow-hidden">
      <div className="grid h-full min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* ── Left: Video ───────────────────────────────── */}
        <div className="flex min-w-0 flex-col">
          {/* Professional Header */}
          <header className="border-b border-white/5 bg-[#0a0a0f] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span>Live Event</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 border border-white/5">
                    <Clock3 size={13} />
                    {sessionState}
                  </span>
                  {reconnecting && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-500 border border-amber-500/10">
                      <RefreshCw size={12} className="animate-spin" />
                      Reconnecting…
                    </span>
                  )}
                </div>
                <h1 className="mt-3 truncate text-lg font-extrabold text-white tracking-tight">{conferenceTitle}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Users size={14} className="text-zinc-400" />
                    <span className="text-zinc-300 font-bold">{totalWatching}</span> people watching
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock size={14} className="text-zinc-600" />
                    {formatDateTime(startTime)} – {formatDateTime(endTime)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLeave}
                className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/10 active:scale-95"
              >
                Leave Room
              </button>
            </div>
          </header>

          {/* Teams-style Stage */}
          <main className="relative flex-1 overflow-hidden bg-black flex flex-col p-4">
            <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
              <MediaGrid 
                participants={remoteParticipants} 
                layout="conference"
                prominentScreenShare={true} 
              />
            </div>

            {localParticipant && (
              <div className="absolute top-6 right-6 z-20 w-28 sm:w-44 aspect-video rounded-xl overflow-hidden border border-white/15 shadow-2xl">
                <MediaGrid participants={[localParticipant]} layout="conference" prominentScreenShare={false} />
              </div>
            )}

            {/* Disconnect overlay */}
            {isDisconnected && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
                <div className="max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-8 text-center text-zinc-100 shadow-2xl">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <AlertTriangle size={28} />
                  </div>
                  <h3 className="text-lg font-bold">Session Disconnected</h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    You've been disconnected from the live stream. Click below to return.
                  </p>
                  <button
                    onClick={handleReconnect}
                    className="mt-6 inline-flex items-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-black transition-all hover:bg-zinc-200 active:scale-95"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Reconnect Stream
                  </button>
                </div>
              </div>
            )}

            {/* Stage Label */}
            <div className="absolute bottom-10 left-10 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">
                Stage: {speakerName || enterpriseName || 'Assigned speaker'}
              </span>
            </div>

            <div className="absolute bottom-8 right-8 z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">
              <button
                onClick={toggleMic}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${micOn ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-red-400/30 bg-red-500/15 text-red-300 hover:bg-red-500/25'}`}
                title={micOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micOn ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              <button
                onClick={toggleCam}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition ${camOn ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-red-400/30 bg-red-500/15 text-red-300 hover:bg-red-500/25'}`}
                title={camOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {camOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>

              <button
                onClick={handleLeave}
                className="inline-flex h-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-red-600"
              >
                Leave
              </button>
            </div>
          </main>
        </div>

        {/* ── Right: Sidebar (Google Meet style) ─────────────────────────────── */}
        <aside className="flex flex-col bg-[#0a0a0f] border-l border-white/5 shadow-2xl overflow-hidden">
          {/* Sidebar Nav/Header */}
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Conference Intel</h2>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Users size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">Audience Panel</p>
                <p className="text-[10px] text-zinc-500 mt-1">Real-time interaction</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Session Summary Card */}
            <div className="p-6">
              <div className="rounded-2xl bg-white/5 border border-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Speaker</p>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-bold border border-emerald-500/20">Active</span>
                </div>
                <p className="text-sm font-bold text-zinc-100">{speakerName || enterpriseName || 'Not specified'}</p>
                <p className="text-xs text-zinc-400 leading-relaxed italic line-clamp-3">
                  "{conferenceDescription || 'Join our live expert session and participate in real-time Q&A.'}"
                </p>
              </div>

              {/* Attendance quick view */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Attendees</p>
                  <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{totalWatching} online</span>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-xs font-semibold text-white">You</span>
                  </div>
                  {remoteParticipants.map((p) => (
                    <div key={p.sessionId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-transparent hover:border-white/5 transition-all">
                      <div className="w-2 h-2 rounded-full bg-zinc-700" />
                      <span className="text-xs text-zinc-400 font-medium">{p.userName}</span>
                    </div>
                  ))}
                  {remoteParticipants.length === 0 && (
                    <p className="text-[10px] text-zinc-600 text-center py-2">No other attendees yet</p>
                  )}
                </div>
              </div>

              {/* Q&A Section */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActivePanel('chat')}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${activePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-zinc-300'}`}
                    >
                      Chat
                    </button>
                    <button
                      onClick={() => setActivePanel('qa')}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${activePanel === 'qa' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-zinc-300'}`}
                    >
                      Q&A
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl bg-zinc-950/50 border border-white/5 overflow-hidden">
                  {sidePanelContent}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
