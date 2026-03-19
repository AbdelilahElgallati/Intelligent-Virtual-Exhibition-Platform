'use client';

import React from 'react';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    useLocalParticipant,
    useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff } from 'lucide-react';

interface MeetingRoomProps {
    token: string;
    serverUrl: string;
    onSessionEnd?: () => void;
}

function VideoGrid() {
    const tracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: true }],
        { onlySubscribed: false }
    );
    return (
        <GridLayout tracks={tracks} style={{ height: 'calc(100vh - 80px)' }}>
            <ParticipantTile />
        </GridLayout>
    );
}

function MeetingControls({ onSessionEnd }: { onSessionEnd?: () => void }) {
    const room = useRoomContext();
    const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
    const isScreenShareEnabled = !!localParticipant?.isScreenShareEnabled;

    const toggleMic = async () => {
        if (!localParticipant) return;
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    };

    const toggleCam = async () => {
        if (!localParticipant) return;
        await localParticipant.setCameraEnabled(!isCameraEnabled);
    };

    const toggleScreen = async () => {
        if (!localParticipant) return;
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    };

    const leave = () => {
        room.disconnect();
        onSessionEnd?.();
    };

    const baseBtn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors';

    return (
        <div className="h-20 px-4 py-3 border-t border-white/10 bg-black/40 backdrop-blur flex items-center justify-center gap-2 sm:gap-3">
            <button
                onClick={toggleMic}
                className={`${baseBtn} ${isMicrophoneEnabled ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'}`}
                type="button"
            >
                {isMicrophoneEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                <span className="hidden sm:inline">{isMicrophoneEnabled ? 'Mic On' : 'Mic Off'}</span>
            </button>

            <button
                onClick={toggleCam}
                className={`${baseBtn} ${isCameraEnabled ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'}`}
                type="button"
            >
                {isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                <span className="hidden sm:inline">{isCameraEnabled ? 'Camera On' : 'Camera Off'}</span>
            </button>

            <button
                onClick={toggleScreen}
                className={`${baseBtn} ${isScreenShareEnabled ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'}`}
                type="button"
            >
                <ScreenShare size={16} />
                <span className="hidden sm:inline">{isScreenShareEnabled ? 'Stop Share' : 'Share Screen'}</span>
            </button>

            <button
                onClick={leave}
                className={`${baseBtn} bg-red-600 text-white border-red-500 hover:bg-red-500`}
                type="button"
            >
                <PhoneOff size={16} />
                <span className="hidden sm:inline">End</span>
            </button>
        </div>
    );
}

/**
 * Full two-party video meeting room.
 * Renders camera grid + standard control bar (mute/camera/screen share/hang up).
 */
export default function MeetingRoom({ token, serverUrl, onSessionEnd }: MeetingRoomProps) {
    return (
        <div style={{ height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                audio={true}
                video={true}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
                <RoomAudioRenderer />
                <VideoGrid />
                <MeetingControls onSessionEnd={onSessionEnd} />
            </LiveKitRoom>
        </div>
    );
}
