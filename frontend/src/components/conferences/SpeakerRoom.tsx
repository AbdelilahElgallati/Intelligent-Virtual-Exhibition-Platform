'use client';

import React from 'react';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    ControlBar,
    useTracks,
    useRemoteParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import QAPanel from './QAPanel';

interface SpeakerRoomProps {
    token: string;
    serverUrl: string;
    conferenceId: string;
    conferenceTitle: string;
    attendeeCount: number;
    onEndSession: () => void;
}

function SpeakerVideoGrid() {
    const tracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: true }],
        { onlySubscribed: false }
    );
    return (
        <GridLayout tracks={tracks} style={{ flex: 1 }}>
            <ParticipantTile />
        </GridLayout>
    );
}

function LiveViewerCount() {
    const participants = useRemoteParticipants();
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {participants.length} watching
        </span>
    );
}

export default function SpeakerRoom({
    token,
    serverUrl,
    conferenceId,
    conferenceTitle,
    onEndSession,
}: SpeakerRoomProps) {
    return (
        <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900">
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                audio={true}
                video={true}
                onDisconnected={onEndSession}
                className="flex-1 flex min-w-0"
            >
                {/* Video area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <header className="h-14 px-5 bg-white border-b border-zinc-200/80 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 rounded-lg">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Live</span>
                            </div>
                            <div>
                                <h1 className="font-semibold text-sm text-zinc-900 leading-tight">{conferenceTitle}</h1>
                                <LiveViewerCount />
                            </div>
                        </div>
                        <button
                            onClick={onEndSession}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors active:scale-95"
                        >
                            End Session
                        </button>
                    </header>

                    {/* Video */}
                    <main className="flex-1 bg-zinc-900 relative overflow-hidden flex flex-col">
                        <div className="flex-1 min-h-0">
                            <RoomAudioRenderer />
                            <SpeakerVideoGrid />
                        </div>
                        <div className="h-16 bg-zinc-900/90 backdrop-blur-sm border-t border-zinc-800 flex items-center justify-center">
                            <ControlBar
                                controls={{ microphone: true, camera: true, screenShare: true, leave: false }}
                                className="!bg-transparent !border-none !gap-2"
                            />
                        </div>
                    </main>
                </div>

                {/* Q&A sidebar */}
                <aside className="w-[340px] bg-white border-l border-zinc-200/80 flex flex-col">
                    <div className="h-14 px-5 border-b border-zinc-100 flex items-center">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Live Q&A</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <QAPanel conferenceId={conferenceId} isSpeaker={true} />
                    </div>
                </aside>
            </LiveKitRoom>
        </div>
    );
}
