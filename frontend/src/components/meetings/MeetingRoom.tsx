'use client';

/**
 * MeetingRoom — Daily.co-based 1:1 / group meeting room.
 *
 * Replaces the previous LiveKit-based implementation.
 * Renders a video grid for all participants plus controls for mic/camera/screen-share/leave.
 */

import React, { useEffect, useRef } from 'react';
import { useDailyRoom, DailyParticipant } from '@/hooks/useDailyRoom';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, WifiOff, Loader2 } from 'lucide-react';

interface MeetingRoomProps {
  token: string;
  roomUrl: string;
  onSessionEnd?: () => void;
}

// ── Single participant video tile ──────────────────────────────────────────

function VideoTile({ participant, large = false }: { participant: DailyParticipant; large?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.videoTrack) {
      videoRef.current.srcObject = new MediaStream([participant.videoTrack]);
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [participant.videoTrack]);

  useEffect(() => {
    if (audioRef.current && participant.audioTrack && !participant.local) {
      audioRef.current.srcObject = new MediaStream([participant.audioTrack]);
    } else if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
  }, [participant.audioTrack, participant.local]);

  return (
    <div
      style={{
        position: 'relative',
        background: '#1a1a2e',
        borderRadius: 12,
        overflow: 'hidden',
        aspectRatio: large ? 'auto' : '16/9',
        flex: large ? '1 1 auto' : '0 0 calc(50% - 8px)',
        minWidth: 0,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {participant.videoOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.local}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff',
          }}>
            {participant.userName.charAt(0).toUpperCase()}
          </div>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{participant.userName}</span>
        </div>
      )}

      {/* Hidden audio element for remote participants */}
      {!participant.local && (
        <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
      )}

      {/* Name badge */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8,
        background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '3px 8px',
        fontSize: 11, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {!participant.audioOn && <MicOff size={10} color="#ef4444" />}
        {participant.userName}
        {participant.local && ' (You)'}
      </div>
    </div>
  );
}

// ── Video grid adaptable to 1–N participants ───────────────────────────────

function VideoGrid({ participants }: { participants: DailyParticipant[] }) {
  if (participants.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#64748b', flexDirection: 'column', gap: 12,
      }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />
        <span style={{ fontSize: 14 }}>Waiting for participants to join…</span>
      </div>
    );
  }

  if (participants.length === 1) {
    return (
      <div style={{ flex: 1, display: 'flex', padding: 16, minHeight: 0 }}>
        <VideoTile participant={participants[0]} large />
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16,
      alignContent: 'flex-start', overflowY: 'auto', minHeight: 0,
    }}>
      {participants.map((p) => (
        <VideoTile key={p.sessionId} participant={p} />
      ))}
    </div>
  );
}

// ── Control bar ────────────────────────────────────────────────────────────

function Controls({
  localParticipant,
  reconnecting,
  onToggleMic,
  onToggleCam,
  onToggleScreen,
  onLeave,
}: {
  localParticipant: DailyParticipant | null;
  reconnecting: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
}) {
  const micOn = localParticipant?.audioOn ?? false;
  const camOn = localParticipant?.videoOn ?? false;
  const screenOn = !!localParticipant?.screenVideoTrack;

  const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors';

  return (
    <div style={{
      height: 72, padding: '0 16px', borderTop: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {reconnecting && (
        <span style={{ color: '#f59e0b', fontSize: 12, marginRight: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <WifiOff size={14} /> Reconnecting…
        </span>
      )}

      <button
        onClick={onToggleMic}
        className={`${btn} ${micOn ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'}`}
        type="button"
      >
        {micOn ? <Mic size={16} /> : <MicOff size={16} />}
        <span className="hidden sm:inline">{micOn ? 'Mic On' : 'Mic Off'}</span>
      </button>

      <button
        onClick={onToggleCam}
        className={`${btn} ${camOn ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'}`}
        type="button"
      >
        {camOn ? <Video size={16} /> : <VideoOff size={16} />}
        <span className="hidden sm:inline">{camOn ? 'Camera On' : 'Camera Off'}</span>
      </button>

      <button
        onClick={onToggleScreen}
        className={`${btn} ${screenOn ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'}`}
        type="button"
      >
        <ScreenShare size={16} />
        <span className="hidden sm:inline">{screenOn ? 'Stop Share' : 'Share Screen'}</span>
      </button>

      <button
        onClick={onLeave}
        className={`${btn} bg-red-600 text-white border-red-500 hover:bg-red-500`}
        type="button"
      >
        <PhoneOff size={16} />
        <span className="hidden sm:inline">End</span>
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * Full-screen 1:1 / group meeting room powered by Daily.co.
 * Drop-in replacement for the previous LiveKit-based MeetingRoom.
 */
export default function MeetingRoom({ token, roomUrl, onSessionEnd }: MeetingRoomProps) {
  const {
    joined,
    error,
    reconnecting,
    localParticipant,
    allParticipants,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    leave,
  } = useDailyRoom({
    roomUrl,
    token,
    onLeft: onSessionEnd,
  });

  const handleLeave = async () => {
    await leave();
    onSessionEnd?.();
  };

  if (error) {
    return (
      <div style={{
        height: '100vh', background: '#060B18', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#e2e8f0',
        fontFamily: 'Inter, sans-serif', padding: 24, gap: 16,
      }}>
        <div style={{ fontSize: 56 }}>⚠️</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          Video connection error
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', maxWidth: 380 }}>{error}</p>
        <button
          onClick={() => onSessionEnd?.()}
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none',
            borderRadius: 10, color: '#fff', padding: '10px 24px',
            fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}
        >
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Connecting overlay */}
      {!joined && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, background: '#0a0a0a',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, color: '#e2e8f0', fontFamily: 'Inter, sans-serif',
        }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
          <p style={{ fontSize: 16, color: '#94a3b8' }}>Connecting to meeting room…</p>
        </div>
      )}

      {/* Video grid */}
      <VideoGrid participants={allParticipants} />

      {/* Controls */}
      <Controls
        localParticipant={localParticipant}
        reconnecting={reconnecting}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onToggleScreen={toggleScreenShare}
        onLeave={handleLeave}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
