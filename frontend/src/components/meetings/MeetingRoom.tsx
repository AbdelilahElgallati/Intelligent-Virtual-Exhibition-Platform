'use client';

import React, { useCallback } from 'react';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    ControlBar,
    useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

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

/**
 * Full two-party video meeting room.
 * Renders camera grid + standard control bar (mute/camera/screen share/hang up).
 */
export default function MeetingRoom({ token, serverUrl, onSessionEnd }: MeetingRoomProps) {
    const handleDisconnected = useCallback(() => {
        onSessionEnd?.();
    }, [onSessionEnd]);

    return (
        <div style={{ height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                audio={true}
                video={true}
                onDisconnected={handleDisconnected}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
                <RoomAudioRenderer />
                <VideoGrid />
                <div style={{ height: 80 }}>
                    <ControlBar
                        controls={{
                            microphone: true,
                            camera: true,
                            screenShare: true,
                            leave: true,
                        }}
                    />
                </div>
            </LiveKitRoom>
        </div>
    );
}
