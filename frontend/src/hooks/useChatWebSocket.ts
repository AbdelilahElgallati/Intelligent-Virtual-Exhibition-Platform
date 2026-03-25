import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl } from '@/lib/config';

interface Message {
    _id?: string;
    room_id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    type: 'text' | 'image' | 'file';
    timestamp: string;
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
    const merged = [...existing];

    for (const message of incoming) {
        const existingIndex = merged.findIndex((item) => {
            if (item._id && message._id) return item._id === message._id;
            return item.sender_id === message.sender_id
                && item.timestamp === message.timestamp
                && item.content === message.content;
        });

        if (existingIndex === -1) {
            merged.push(message);
        } else {
            merged[existingIndex] = { ...merged[existingIndex], ...message };
        }
    }

    return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function useChatWebSocket(roomId: string | null) {
    const { tokens } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const accessToken = tokens?.access_token;
        if (!roomId || !accessToken) return;

        let shouldReconnect = true;

        const connect = () => {
            if (!shouldReconnect) return;

            if (wsRef.current) {
                wsRef.current.close();
            }

            const endpointUrl = getApiUrl(`/chat/ws/chat/${roomId}?token=${accessToken}`);
            const wsUrl = endpointUrl.replace(/^http/, 'ws');

            try {
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    setIsConnected(true);
                    setError(null);
                    if (reconnectTimeoutRef.current) {
                        clearTimeout(reconnectTimeoutRef.current);
                        reconnectTimeoutRef.current = null;
                    }
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        setMessages((prev) => mergeMessages(prev, [message]));
                    } catch (e) {
                        console.error('Failed to parse WS message', e);
                    }
                };

                ws.onclose = (event) => {
                    setIsConnected(false);
                    const reason = event.reason || `code ${event.code}`;
                    if (event.code === 1008 || event.code === 4401 || event.code === 4403) {
                        setError('Connection closed: unauthorized or access denied');
                        return;
                    }
                    if (event.code !== 1000 && shouldReconnect) {
                        console.log('WS Closed unexpectedly, reconnecting...', reason);
                        reconnectTimeoutRef.current = setTimeout(connect, 3000);
                    }
                };

                ws.onerror = () => {
                    console.warn('WS connection error', {
                        url: wsUrl,
                        readyState: ws.readyState,
                    });
                    setError('Connection error');
                };
            } catch (e) {
                console.error('WS Connection Creation Failed', e);
                setError('Failed to create connection');
            }
        };

        connect();

        return () => {
            shouldReconnect = false;
            if (wsRef.current) {
                wsRef.current.close(1000, 'Component unmounting');
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [roomId, tokens]);

    const sendMessage = useCallback((content: string) => {
        if (wsRef.current && isConnected) {
            wsRef.current.send(JSON.stringify({ content, type: 'text' }));
        }
    }, [isConnected]);

    return { messages, setMessages, isConnected, error, sendMessage };
}
