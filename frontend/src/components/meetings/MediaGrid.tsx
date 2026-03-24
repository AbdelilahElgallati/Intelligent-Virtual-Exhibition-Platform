'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { DailyParticipant } from '@/hooks/useDailyRoom';
import { 
  MicOff, Maximize, Minimize, User, 
  ScreenShare, VideoOff 
} from 'lucide-react';

interface MediaGridProps {
  participants: DailyParticipant[];
  /** Layout type: 'meeting' (1:1/group), 'conference' (presenter-led), or 'whatsapp' (1:1 PIP) */
  layout?: 'meeting' | 'conference' | 'whatsapp';
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
  /** 'cover' for cameras, 'contain' for screens */
  objectFit?: 'cover' | 'contain';
  /** For PIP windows */
  isPip?: boolean;
}

function MediaTile({ track, userName, isLocal, isAudioOn, isVideoOn, isScreen, objectFit, isPip }: MediaTileProps) {
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

  const fit = objectFit || (isScreen ? 'contain' : 'cover');

  return (
    <div
      ref={containerRef}
      className={`relative bg-zinc-950 rounded-2xl overflow-hidden border border-white/5 group shadow-2xl transition-all duration-300 ${isFullscreen ? 'rounded-none border-none' : ''} ${isPip ? 'ring-1 ring-white/20' : ''}`}
      style={{ width: '100%', height: '100%' }}
    >
      {track && isVideoOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${fit} ${isScreen ? 'bg-black' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0a0a0f]">
          <div className="relative">
            <div className={`rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold shadow-[0_0_30px_rgba(79,70,229,0.3)] ${isPip ? 'w-12 h-12 text-lg' : 'w-20 h-20 text-3xl'}`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            {!isAudioOn && (
              <div className={`absolute -bottom-1 -right-1 bg-red-500 rounded-full border-2 border-[#0a0a0f] text-white ${isPip ? 'p-1' : 'p-1.5'}`}>
                <MicOff size={isPip ? 10 : 12} />
              </div>
            )}
          </div>
          {!isPip && (
            <div className="flex flex-col items-center text-center px-4">
              <span className="text-zinc-100 font-semibold tracking-tight">{userName}</span>
              <span className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] mt-1 font-medium opacity-70">
                {isScreen ? 'Screen shared' : 'Stream Paused'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Modern Glass Overlays */}
      {!isPip && (
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 duration-300">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-black/40 backdrop-blur-xl text-white border border-white/10 hover:bg-black/60 hover:scale-105 active:scale-95 transition-all"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      )}

      <div className={`absolute flex items-center gap-2.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg ${isPip ? 'bottom-2 left-2 px-2 py-1' : 'bottom-4 left-4 px-3 py-2'}`}>
        <div className="flex items-center gap-1.5">
          {!isAudioOn && <MicOff size={isPip ? 10 : 13} className="text-red-400" />}
          {isScreen && <ScreenShare size={isPip ? 10 : 13} className="text-indigo-400" />}
          <span className={`${isPip ? 'text-[10px]' : 'text-xs'} font-semibold text-zinc-100 tracking-tight`}>
            {userName} {isLocal && <span className="text-white/40 ml-1 font-normal">(You)</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Grid ──────────────────────────────────────────────────────────────

export default function MediaGrid({ participants, layout = 'meeting', prominentScreenShare = true }: MediaGridProps) {
  const items = useMemo(() => {
    const list: (MediaTileProps & { id: string })[] = [];
    participants.forEach((p) => {
      list.push({
        id: `${p.sessionId}-cam`,
        track: p.videoTrack,
        userName: p.userName,
        isLocal: p.local,
        isAudioOn: p.audioOn,
        isVideoOn: p.videoOn,
        isScreen: false,
      });
      if (p.screenVideoTrack) {
        list.push({
          id: `${p.sessionId}-screen`,
          track: p.screenVideoTrack,
          userName: p.userName,
          isLocal: p.local,
          isAudioOn: p.audioOn,
          isVideoOn: true,
          isScreen: true,
        });
      }
    });
    return list;
  }, [participants]);

  const screenShareItem = items.find(item => item.isScreen);
  const otherItems = items.filter(item => item !== screenShareItem);

  const [isSwapped, setIsSwapped] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#030305] text-zinc-500 font-sans">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center animate-pulse border border-white/5">
            <User size={36} className="text-zinc-700" />
          </div>
          <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping opacity-20" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold text-zinc-300">Room is currently quiet</p>
          <p className="text-xs text-zinc-500 tracking-wide uppercase">Waiting for streams to begin</p>
        </div>
      </div>
    );
  }

  // Case: WhatsApp Style (1:1 PIP with swap capability)
  if (layout === 'whatsapp' && items.length >= 1) {
    const remote = items.find(i => !i.isLocal) || items[0];
    const local = items.find(i => i.isLocal && i !== remote) || (items[0].isLocal ? items[0] : null);

    const main = isSwapped ? local : remote;
    const pip = isSwapped ? remote : local;

    return (
      <div className="flex-1 relative overflow-hidden bg-[#030305]">
        {/* Main Participant (Background) */}
        {main && (
          <div className="w-full h-full p-4">
            <MediaTile {...main} />
          </div>
        )}
        
        {/* Floating PIP Participant (Switchable) */}
        {pip && (
          <button 
            onClick={() => setIsSwapped(!isSwapped)}
            className="absolute bottom-10 right-10 w-32 sm:w-48 aspect-[3/4] sm:aspect-video shadow-2xl transition-all hover:scale-105 active:scale-95 group/pip overflow-hidden rounded-2xl border-2 border-white/10"
          >
            <MediaTile {...pip} isPip={true} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/pip:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600 px-2 py-1 rounded-full shadow-lg">
                Switch
              </span>
            </div>
          </button>
        )}
      </div>
    );
  }

  // Case: Screen Share Present
  if (prominentScreenShare && screenShareItem) {
    return (
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0 bg-[#030305]">
        <div className="flex-[4] min-h-0 min-w-0">
          <MediaTile {...screenShareItem} />
        </div>
        <div className="flex-1 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto min-h-0 pr-1 pb-1">
          {otherItems.map((item) => (
            <div key={item.id} className="w-[280px] lg:w-full aspect-video shrink-0 shadow-xl">
              <MediaTile {...item} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Case: 1:1 Meeting layout (Standard grid)
  if (layout === 'meeting' && items.length === 2) {
    return (
      <div className="flex-1 flex flex-col sm:flex-row gap-4 p-4 min-h-0 bg-[#030305]">
        {items.map((item) => (
          <div key={item.id} className="flex-1 min-h-0">
            <MediaTile {...item} />
          </div>
        ))}
      </div>
    );
  }

  // Case: Conference stage (Single prominent or standard grid)
  if (layout === 'conference' && items.length === 1) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 bg-[#030305]">
        <div className="w-full h-full max-w-6xl aspect-video mx-auto">
          <MediaTile {...items[0]} />
        </div>
      </div>
    );
  }

  // Fallback: Standard masonry-ish grid
  return (
    <div className={`flex-1 grid gap-4 p-4 min-h-0 bg-[#030305] ${
      items.length === 1 ? 'grid-cols-1' :
      items.length <= 4 ? 'grid-cols-1 md:grid-cols-2' :
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
