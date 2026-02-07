import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ragApi } from '../services/ragApi';
import { Message } from '../types/ai';

export const useAssistant = (scope: string = 'platform', sessionId?: string) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentResponse, setCurrentResponse] = useState('');
    const abortControllerRef = useRef<AbortController | null>(null);
    const queryClient = useQueryClient();

    // Fetch session history if sessionId is provided
    const { data: history } = useQuery({
        queryKey: ['assistant-session', sessionId],
        queryFn: () => ragApi.getSession(sessionId!),
        enabled: !!sessionId,
        onSuccess: (data) => setMessages(data.messages || []),
    });

    const sendMessage = useCallback(async (query: string) => {
        if (!query.trim()) return;

        const userMessage: Message = {
            role: 'user',
            content: query,
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setIsLoading(true);
        setCurrentResponse('');

        try {
            abortControllerRef.current = new AbortController();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/assistant/${scope}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ query, stream: true }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) throw new Error('Failed to fetch assistant response');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantText = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.replace('data: ', '').trim();
                            if (dataStr === '[DONE]') break;

                            try {
                                const data = JSON.parse(dataStr);
                                assistantText += data.text;
                                setCurrentResponse(assistantText);
                            } catch (e) {
                                console.error('Error parsing SSE data', e);
                            }
                        }
                    }
                }
            }

            const assistantMessage: Message = {
                role: 'assistant',
                content: assistantText,
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setCurrentResponse('');

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Assistant Error:', error);
            }
        } finally {
            setIsLoading(false);
        }
    }, [scope]);

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

    return { messages, isLoading, currentResponse, sendMessage, stopGeneration };
};
