'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    LiveKitRoom,
    VideoConference,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    ControlBar,
    useTracks,
    TrackRefContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';

interface LiveKitProviderProps {
    token: string;
    serverUrl: string;
    children?: React.ReactNode;
    onDisconnected?: () => void;
}

/**
 * Wraps the LiveKit Room with auth token.
 * Used by both MeetingRoom and AudienceRoom.
 */
export function LiveKitProvider({
    token,
    serverUrl,
    children,
    onDisconnected,
}: LiveKitProviderProps) {
    return (
        <LiveKitRoom
            token={token}
            serverUrl={serverUrl}
            connect={true}
            audio={true}
            video={true}
            onDisconnected={onDisconnected}
            style={{ height: '100%', width: '100%' }}
        >
            <RoomAudioRenderer />
            {children}
        </LiveKitRoom>
    );
}
