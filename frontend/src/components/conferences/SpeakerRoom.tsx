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
import ConferenceChatPanel from './ConferenceChatPanel';
import {
  AlertTriangle, Clock3, Mic, MicOff,
  MonitorUp, RefreshCw, Shield, Users, Video, VideoOff,
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
}: Readonly<SpeakerRoomProps>) {
  const [now, setNow] = useState(() => Date.now());
  const [endingSession, setEndingSession] = useState(false);
  const [showDisconnectOverlay, setShowDisconnectOverlay] = useState(false);
  const [activePanel, setActivePanel] = useState<'chat' | 'qa'>('chat');
  const [moderationMsg, setModerationMsg] = useState<string | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    reconnecting,
    localParticipant,
    remoteParticipants,
    allParticipants,
    roomMessages,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    sendRoomMessage,
    removeParticipant,
    leave,
    reconnect,
  } = useDailyRoom({
    roomUrl,
    token,
    startVideoOff: false,
    startAudioOff: false,
    onLeft: () => {
      if (!endingSession) {
        disconnectTimerRef.current = setTimeout(() => setShowDisconnectOverlay(true), 2500);
      }
    },
    onJoined: () => {
      setShowDisconnectOverlay(false);
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
    },
  });

  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
  }, []);

  const handleRemoveParticipant = async (participant: DailyParticipant) => {
    const ok = await removeParticipant(participant.sessionId);
    setModerationMsg(
      ok
        ? `${participant.userName} was removed from the conference.`
        : 'Participant removal is not available in this browser session.'
    );
    globalThis.setTimeout(() => setModerationMsg(null), 2600);
  };

  const start = startTime ? new Date(startTime).getTime() : null;
  const end = endTime ? new Date(endTime).getTime() : null;
  const isInSession = Boolean(start && end && now >= start && now < end);
  let sessionState = 'Live session';
  if (start && now < start) {
    sessionState = `Starts in ${formatDuration(start - now)}`;
  } else if (start && end && isInSession) {
    sessionState = `Ends in ${formatDuration(end - now)}`;
  } else if (start && end) {
    sessionState = `Ended ${formatDuration(now - end)} ago`;
  }

  const handleExplicitEnd = async () => {
    if (!confirm('Are you sure you want to end this session for everyone?')) return;
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
  };

  const micOn = localParticipant?.audioOn ?? false;
  const camOn = localParticipant?.videoOn ?? false;
  const screenOn = !!localParticipant?.screenVideoTrack;
  const liveCount = allParticipants.length;
  let engagementPanel: React.ReactNode;
  if (activePanel === 'chat') {
    engagementPanel = (
      <ConferenceChatPanel
        title="Speaker Chat"
        messages={roomMessages}
        onSend={sendRoomMessage}
      />
    );
  } else if (qaEnabled) {
    engagementPanel = <QAPanel conferenceId={conferenceId} isSpeaker={true} />;
  } else {
    engagementPanel = (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <p className="text-xs text-zinc-600 italic">Audience interaction is disabled for this session.</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#070709] font-sans text-zinc-100 overflow-hidden">
      <div className="grid h-full min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">

        {/* ── Left: Studio Stage ─────────────────────────── */}
        <div className="flex min-w-0 flex-col">
          {/* Professional Header */}
          <header className="border-b border-white/5 bg-[#0a0a0f] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500 border border-red-500/20">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span>Broadcasting Live</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 border border-white/5">
                    <Clock3 size={13} />
                    {sessionState}
                  </span>
                  {reconnecting && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-500 border border-amber-500/10">
                      <RefreshCw size={12} className="animate-spin" />
                      Recovering Connection…
                    </span>
                  )}
                </div>
                <h1 className="mt-2 truncate text-lg font-extrabold text-white tracking-tight">{conferenceTitle}</h1>
              </div>
              
              <div className="flex items-center gap-3">
                {eventId && (
                  <button
                    onClick={() => { globalThis.location.href = `/enterprise/events/${eventId}/manage`; }}
                    className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 transition-all hover:bg-white/10"
                  >
                    Event Settings
                  </button>
                )}
                <button
                  onClick={handleExplicitEnd}
                  disabled={endingSession}
                  className="rounded-xl border border-red-500/20 bg-red-500 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all hover:bg-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
                >
                  {endingSession ? 'Ending…' : 'End Session'}
                </button>
              </div>
            </div>
          </header>

          {/* Studio Stage Area */}
          <main className="relative flex-1 bg-black flex flex-col p-4 overflow-hidden">
            <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative bg-[#0a0a0f]">
              <MediaGrid 
                participants={allParticipants} 
                layout="conference"
                prominentScreenShare={true}
              />
              
              {/* Floating Speaker Status */}
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  STUDIO ACTIVE
                </div>
              </div>
            </div>

            {/* Floating Studio Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 rounded-3xl bg-[#12121a]/80 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <button
                onClick={toggleMic}
                className={`group flex flex-col items-center gap-1.5 transition-all ${micOn ? 'text-white' : 'text-red-500'}`}
              >
                <div className={`p-4 rounded-2xl transition-all ${micOn ? 'bg-white/5 hover:bg-white/10 border border-white/10' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {micOn ? <Mic size={22} /> : <MicOff size={22} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">{micOn ? 'Mute' : 'Unmute'}</span>
              </button>

              <button
                onClick={toggleCam}
                className={`group flex flex-col items-center gap-1.5 transition-all ${camOn ? 'text-white' : 'text-red-500'}`}
              >
                <div className={`p-4 rounded-2xl transition-all ${camOn ? 'bg-white/5 hover:bg-white/10 border border-white/10' : 'bg-red-500/10 border border-red-500/20'}`}>
                  {camOn ? <Video size={22} /> : <VideoOff size={22} />}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">{camOn ? 'Stop Video' : 'Start Video'}</span>
              </button>

              <div className="w-px h-10 bg-white/10 mx-2" />

              <button
                onClick={toggleScreenShare}
                className={`group flex flex-col items-center gap-1.5 transition-all ${screenOn ? 'text-emerald-400' : 'text-white'}`}
              >
                <div className={`p-4 rounded-2xl transition-all ${screenOn ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}>
                  <MonitorUp size={22} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">{screenOn ? 'Sharing' : 'Share Screen'}</span>
              </button>

              <button
                onClick={handleReconnect}
                className="group flex flex-col items-center gap-1.5 text-white transition-all"
              >
                <div className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10">
                  <RefreshCw size={22} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100">Sync</span>
              </button>
            </div>

            {/* Disconnect overlay */}
            {showDisconnectOverlay && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0a0a0f] p-8 text-center shadow-2xl">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-xl font-black text-white">Stream Disturbance</h3>
                  <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
                    We've detected a connection drop. Your audience is still waiting in the room.
                  </p>
                  <button
                    onClick={handleReconnect}
                    className="mt-8 w-full inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-black text-black transition-all hover:bg-zinc-200"
                  >
                    <RefreshCw size={18} className="mr-2" />
                    Resume Broadcast
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ── Right: Studio Dashboard ────────────────────── */}
        <aside className="flex flex-col bg-[#0a0a0f] border-l border-white/5 shadow-2xl overflow-hidden">
          <div className="px-6 py-6 border-b border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Producer Center</h2>
            <div className="mt-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg transform rotate-3">
                <Users size={24} className="text-white -rotate-3" />
              </div>
              <div>
                <p className="text-base font-black text-white leading-none">Studio Dashboard</p>
                <p className="text-[10px] text-zinc-500 mt-1.5 uppercase tracking-wider font-bold">Conference Management</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-8">
              {/* Speaker Profile Tile */}
              <div className="rounded-2xl bg-white/5 border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lead Speaker</p>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-black border border-red-500/20">LIVE</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-white/10">
                    {speakerName?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{speakerName || enterpriseName || 'Assigned speaker'}</p>
                    <p className="text-[11px] text-zinc-500">Broadcasting Now</p>
                  </div>
                </div>
              </div>

              {/* Analytics Quick View */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Live Audience</p>
                  <p className="text-2xl font-black text-white mt-1">{liveCount}</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase">Total Access</p>
                  <p className="text-2xl font-black text-zinc-400 mt-1">{Math.max(attendeeCount, liveCount)}</p>
                </div>
              </div>

              {/* Attendee Roster */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Active Roster</h3>
                  <div className="h-4 w-px bg-white/10" />
                  <span className="text-[10px] text-zinc-400 font-bold">{remoteParticipants.length} remote</span>
                </div>
                
                <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                    <span className="text-xs font-black text-white">You (Producer)</span>
                  </div>
                  
                  {remoteParticipants.map((p) => (
                    <div key={p.sessionId} className="group flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-transparent hover:border-white/5 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-zinc-600 transition-colors group-hover:bg-zinc-400" />
                        <span className="text-xs text-zinc-400 font-medium group-hover:text-zinc-200 transition-colors">{p.userName}</span>
                      </div>
                      {/* Optional micro-actions could go here */}
                    </div>
                  ))}
                  
                  {remoteParticipants.length === 0 && (
                    <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/5">
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Waiting for audience</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Interaction Panel */}
              <div className="pt-4 h-[400px]">
                <div className="mb-4 flex items-center gap-2">
                  <button
                    onClick={() => setActivePanel('chat')}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${activePanel === 'chat' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-zinc-300'}`}
                  >
                    Live Chat
                  </button>
                  <button
                    onClick={() => setActivePanel('qa')}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${activePanel === 'qa' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30' : 'bg-white/5 text-zinc-500 border border-white/5 hover:text-zinc-300'}`}
                  >
                    Q&A
                  </button>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="h-full rounded-2xl bg-zinc-950/50 border border-white/5 overflow-hidden shadow-inner">
                  {engagementPanel}
                </div>
              </div>

              {/* Moderation controls */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Moderation</h3>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                  {remoteParticipants.map((p) => (
                    <div key={`${p.sessionId}-mod`} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Shield size={12} className="text-zinc-500" />
                        <span className="text-xs text-zinc-300 font-semibold truncate max-w-[180px]">{p.userName}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveParticipant(p)}
                        className="rounded-lg border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-300 hover:bg-red-500/20"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {remoteParticipants.length === 0 && (
                    <p className="text-[10px] text-zinc-600 text-center py-2">No audience connected.</p>
                  )}
                </div>
                {moderationMsg && (
                  <p className="mt-2 text-[10px] font-semibold text-zinc-400">{moderationMsg}</p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
