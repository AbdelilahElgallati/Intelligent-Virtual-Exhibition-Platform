import React from 'react';
import { useTranscription, TranscriptLine } from '../../hooks/useTranscription';

interface LiveSubtitlesOverlayProps {
    roomId: string;
}

export const LiveSubtitlesOverlay: React.FC<LiveSubtitlesOverlayProps> = ({ roomId }) => {
    const { lines, activeId } = useTranscription(roomId);

    // Get only the most recent line or the active one
    const activeLine = lines.find(l => l.id === activeId) || lines[lines.length - 1];

    if (!activeLine) return null;

    return (
        <div className="absolute bottom-12 left-0 right-0 flex justify-center p-4 pointer-events-none z-30">
            <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                <p className="text-white text-lg font-medium text-center leading-tight tracking-wide drop-shadow-md">
                    {activeLine.text}
                </p>
            </div>
        </div>
    );
};
