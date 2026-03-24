'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { DailyParticipant } from '@/hooks/useDailyRoom';
import { 
  MicOff, Maximize, Minimize, User, 
  ScreenShare, VideoOff 
} from 'lucide-react';

interface MediaGridProps {
  participants: DailyParticipant[];
  /** If true, maximizes any active screen share */
  prominentScreenShare?: boolean;
}

// ── Generic Media Tile ─────────────────────────────────────────────────────

interface MediaTileProps {
  track: MediaStreamTrack | null;
  userName: string;
  isLocal: boolean;
  isAudioOn: boolean;
  isVideoOn: boolean;
  isScreen?: boolean;
}

function MediaTile({ track, userName, isLocal, isAudioOn, isVideoOn, isScreen }: MediaTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && track) {
      videoRef.current.srcObject = new MediaStream([track]);
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [track]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative bg-zinc-900 rounded-xl overflow-hidden border border-white/5 group"
      style={{ width: '100%', height: '100%' }}
    >
      {track ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${isScreen ? 'object-contain bg-black' : 'object-cover'}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-950">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-zinc-200 font-medium text-sm">{userName}</span>
            <span className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">
              {isScreen ? 'Screen share starting...' : 'Camera is off'}
            </span>
          </div>
        </div>
      )}

      {/* Overlays */}
      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/5">
        {!isAudioOn && <MicOff size={12} className="text-red-500" />}
        {isScreen && <ScreenShare size={12} className="text-indigo-400" />}
        <span className="text-[11px] font-medium text-white truncate max-w-[120px]">
          {userName} {isLocal && '(You)'} {isScreen && '· Screen'}
        </span>
      </div>
    </div>
  );
}

// ── Main Grid ──────────────────────────────────────────────────────────────

export default function MediaGrid({ participants, prominentScreenShare = true }: MediaGridProps) {
  // Flatten participants into individual media items (Camera and/or Screen)
  const items = useMemo(() => {
    const list: (MediaTileProps & { id: string })[] = [];
    
    participants.forEach((p) => {
      // 1. Camera Track
      list.push({
        id: `${p.sessionId}-cam`,
        track: p.videoTrack,
        userName: p.userName,
        isLocal: p.local,
        isAudioOn: p.audioOn,
        isVideoOn: p.videoOn,
        isScreen: false,
      });

      // 2. Screen Share Track (if active)
      if (p.screenVideoTrack) {
        list.push({
          id: `${p.sessionId}-screen`,
          track: p.screenVideoTrack,
          userName: p.userName,
          isLocal: p.local,
          isAudioOn: p.audioOn, // usually screen audio is separate, but we link to user state
          isVideoOn: true,
          isScreen: true,
        });
      }
    });

    return list;
  }, [participants]);

  const screenShareItem = items.find(item => item.isScreen);
  const otherItems = items.filter(item => item !== screenShareItem);

  // If there's a screen share and we want it prominent
  if (prominentScreenShare && screenShareItem) {
    return (
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0 bg-zinc-950">
        {/* Prominent View (Screen Share) */}
        <div className="flex-[3] min-h-0">
          <MediaTile {...screenShareItem} />
        </div>
        
        {/* Sidebar View (Cameras) */}
        <div className="flex-1 flex flex-row md:flex-col gap-3 overflow-x-auto md:overflow-y-auto pr-2 min-h-0">
          {otherItems.map((item) => (
            <div key={item.id} className="w-48 md:w-full aspect-video shrink-0">
              <MediaTile {...item} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-500">
        <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center animate-pulse">
          <User size={32} />
        </div>
        <p className="text-sm font-medium">Waiting for participants to join...</p>
      </div>
    );
  }

  // Fallback: Default Grid
  return (
    <div className={`flex-1 grid gap-4 p-4 min-h-0 bg-zinc-950 ${
      items.length === 1 ? 'grid-cols-1' : 
      items.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    }`}>
      {items.map((item) => (
        <div key={item.id} className="relative w-full h-full min-h-[200px]">
          <MediaTile {...item} />
        </div>
      ))}
    </div>
  );
}
