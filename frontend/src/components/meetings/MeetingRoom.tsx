'use client';

/**
 * MeetingRoom — Daily.co-based 1:1 / group meeting room.
 *
 * Replaces the previous LiveKit-based implementation.
 * Renders a video grid for all participants plus controls for mic/camera/screen-share/leave.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useDailyRoom, DailyParticipant } from '@/hooks/useDailyRoom';
import MediaGrid from './MediaGrid';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, WifiOff, Loader2, AlertTriangle, RefreshCw, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MeetingRoomProps {
  token: string;
  roomUrl: string;
  startsAt?: string;
  endsAt?: string;
  onSessionEnd?: () => void;
}


// ── Control bar ────────────────────────────────────────────────────────────

function Controls({
  localParticipant,
  reconnecting,
  t,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onLeave,
}: Readonly<{
  localParticipant: DailyParticipant | null;
  reconnecting: boolean;
  t: (key: string) => string;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
}>) {
  const micOn = localParticipant?.audioOn ?? false;
  const camOn = localParticipant?.videoOn ?? false;
  const screenOn = !!localParticipant?.screenVideoTrack;

  const btnBase = 'w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md';

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-6 py-4 rounded-3xl bg-black/30 backdrop-blur-2xl border border-white/10 shadow-2xl">
      {reconnecting && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1 bg-amber-500 rounded-full text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
          <WifiOff size={12} /> {t('visitor.meetingRoom.reconnecting')}
        </div>
      )}

      {/* Mic Toggle */}
      <button
        onClick={onToggleMic}
        className={`${btnBase} ${micOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'}`}
        title={micOn ? t('visitor.meetingRoom.mute') : t('visitor.meetingRoom.unmute')}
      >
        {micOn ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      {/* Camera Toggle */}
      <button
        onClick={onToggleCam}
        className={`${btnBase} ${camOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'}`}
        title={camOn ? t('visitor.meetingRoom.cameraOff') : t('visitor.meetingRoom.cameraOn')}
      >
        {camOn ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      {/* Screen Share */}
      <button
        onClick={onToggleScreen}
        className={`${btnBase} ${screenOn ? 'bg-indigo-600 text-white' : 'bg-white/10 text-zinc-300 hover:bg-white/20'}`}
        title={screenOn ? t('visitor.meetingRoom.screenShareOff') : t('visitor.meetingRoom.screenShareOn')}
      >
        <ScreenShare size={20} />
      </button>

      {/* End Call */}
      <button
        onClick={onLeave}
        className={`${btnBase} bg-red-600 text-white hover:bg-red-500 hover:scale-105 active:scale-95 border-none`}
        title={t('visitor.meetingRoom.endCall')}
      >
        <PhoneOff size={24} />
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MeetingRoom({ token, roomUrl, startsAt, endsAt, onSessionEnd }: Readonly<MeetingRoomProps>) {
  const { t } = useTranslation();
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
    startsAtIso: startsAt,
    endsAtIso: endsAt,
  });

  const [rejoinAttempts, setRejoinAttempts] = useState(0);

  const meetingExpired = useMemo(() => {
    if (!endsAt) return false;
    const endMs = new Date(endsAt).getTime();
    if (!Number.isFinite(endMs)) return false;
    return Date.now() >= endMs;
  }, [endsAt]);

  const canRejoin = !meetingExpired;

  useEffect(() => {
    if (joined) {
      setRejoinAttempts(0);
    }
  }, [joined]);

  useEffect(() => {
    if (!canRejoin) return;
    if (joined) return;
    if (!error && !reconnecting) return;
    if (rejoinAttempts >= 3) return;

    const timer = globalThis.setTimeout(async () => {
      try {
        setRejoinAttempts((prev) => prev + 1);
        await reconnect();
      } catch {
        // noop: error state is already handled by the hook.
      }
    }, 1500);

    return () => globalThis.clearTimeout(timer);
  }, [canRejoin, error, joined, reconnect, reconnecting, rejoinAttempts]);

  const handleLeave = async () => {
    await leave();
    onSessionEnd?.();
  };

  if (error && !canRejoin) {
    return (
      <div className="h-screen bg-[#070709] flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black">
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('visitor.meetingRoom.connectionFailed')}</h2>
        <p className="text-zinc-500 max-w-sm mb-8">{error}</p>
        <button
          onClick={() => onSessionEnd?.()}
          className="px-8 py-3 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all active:scale-95"
        >
          {t('visitor.meetingRoom.returnToStand')}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden font-sans">
      {/* Connecting overlay */}
      {!joined && (
        <div className="absolute inset-0 z-50 bg-[#070709] flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <Loader2 size={48} className="animate-spin text-indigo-500" />
            <div className="absolute inset-0 blur-xl bg-indigo-500/20 animate-pulse" />
          </div>
          <p className="text-zinc-400 font-medium tracking-wide animate-pulse">{t('visitor.meetingRoom.establishing')}…</p>
          {canRejoin && (
            <button
              onClick={() => reconnect()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white border border-white/15 hover:bg-white/15 transition-all"
            >
              <RefreshCw size={16} /> {t('visitor.meetingRoom.rejoinPrompt')}
            </button>
          )}
          {error && <p className="text-xs text-red-300 max-w-md text-center px-4">{error}</p>}
        </div>
      )}

      {/* Main Video Area */}
      <div className="flex-1 min-h-0">
        <MediaGrid participants={allParticipants} layout="whatsapp" />
      </div>

      {joined && remoteParticipants.length === 0 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 border border-white/10 text-zinc-200 text-sm backdrop-blur-xl">
          <Users size={14} className="text-zinc-300" />
          {t('visitor.meetingRoom.waitingParticipant')}
        </div>
      )}

      {joined && error && canRejoin && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-3 rounded-2xl bg-red-500/15 border border-red-300/25 text-red-100 text-sm backdrop-blur-xl flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-300" />
          <span>{error}</span>
          <button
            onClick={() => reconnect()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/25 hover:bg-red-500/35 transition"
          >
            <RefreshCw size={13} /> {t('visitor.meetingRoom.rejoin')}
          </button>
        </div>
      )}

      {/* Floating Controls */}
      <Controls
        localParticipant={localParticipant}
        reconnecting={reconnecting}
        t={t}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={toggleScreenShare}
        onLeave={handleLeave}
      />

      <style jsx global>{`
        body { background: black; overflow: hidden; }
      `}</style>
    </div>
  );
}
