import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
    id: string;
    sender_name: string;
    content: string;
    timestamp: string;
    sender_id: string;
}

export const useChat = (userId: string, roomId?: string) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!userId) return;

        const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/api/v1/chat/ws/${userId}`;
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            setIsConnected(true);
            console.log('Chat WebSocket connected');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setMessages((prev) => [...prev, data]);
        };

        socket.onclose = () => {
            setIsConnected(false);
            console.log('Chat WebSocket disconnected');
        };

        return () => {
            socket.close();
        };
    }, [userId]);

    const sendMessage = useCallback((content: string) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                content,
                room_id: roomId,
                timestamp: new Date().toISOString()
            }));
        }
    }, [roomId]);

    return { messages, setMessages, isConnected, sendMessage };
};
