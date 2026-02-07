import { useState, useEffect, useRef } from 'react';

export interface TranscriptLine {
    id: string;
    timestamp: string;
    text: string;
}

export const useTranscription = (roomId: string) => {
    const [lines, setLines] = useState<TranscriptLine[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!roomId) return;

        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/api/v1/transcripts/ws/live/${roomId}`;
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onmessage = (event) => {
            const newLine: TranscriptLine = JSON.parse(event.data);
            setLines((prev) => [...prev, newLine]);
            setActiveId(newLine.id);

            // Auto-clear active line after some time if needed
            setTimeout(() => {
                // Only clear if it's still the same line
                setActiveId(current => current === newLine.id ? current : current);
            }, 5000);
        };

        return () => {
            socket.close();
        };
    }, [roomId]);

    return { lines, activeId };
};
