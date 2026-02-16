import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

interface Message {
    _id?: string;
    room_id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    type: 'text' | 'image' | 'file';
    timestamp: string;
}

export function useChatWebSocket(roomId: string | null) {
    const { tokens } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const connect = useCallback(() => {
        if (!roomId || !tokens?.access_token) return;

        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
        }

        const wsUrl = `ws://127.0.0.1:8000/api/v1/chat/ws/chat/${roomId}?token=${tokens.access_token}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                setError(null);
                console.log('WS Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    setMessages((prev) => [...prev, message]);
                } catch (e) {
                    console.error('Failed to parse WS message', e);
                }
            };

            ws.onclose = (event) => {
                setIsConnected(false);
                if (event.code !== 1000) { // Normal closure
                    console.log('WS Closed unexpectedly, reconnecting...', event.reason);
                    // Reconnect after 3 seconds
                    reconnectTimeoutRef.current = setTimeout(connect, 3000);
                }
            };

            ws.onerror = (e) => {
                console.error('WS Error', e);
                setError('Connection error');
            };

        } catch (e) {
            console.error('WS Connection Creation Failed', e);
            setError('Failed to create connection');
        }
    }, [roomId, tokens?.access_token]);

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connect]);

    const sendMessage = useCallback((content: string) => {
        if (wsRef.current && isConnected) {
            wsRef.current.send(JSON.stringify({ content, type: 'text' }));
        }
    }, [isConnected]);

    return { messages, setMessages, isConnected, error, sendMessage };
}
