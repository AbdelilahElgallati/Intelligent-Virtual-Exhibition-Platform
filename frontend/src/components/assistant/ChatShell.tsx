"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { AssistantMessage, streamAssistantQuery } from '@/services/assistant.service';
import { useAuth } from '@/context/AuthContext';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { TypingIndicator } from './TypingIndicator';
import { Button } from '@/components/ui/Button';

interface ChatShellProps {
    scope: string;
    title: string;
    subtitle?: string;
    suggestedPrompts?: string[];
    onClose?: () => void;
    className?: string;
}

const createMessage = (role: AssistantMessage['role'], content: string): AssistantMessage => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${role}-${Date.now()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
});

export const ChatShell: React.FC<ChatShellProps> = ({ scope, title, subtitle, suggestedPrompts = [], onClose, className }) => {
    const { tokens, isAuthenticated } = useAuth();
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const authToken = useMemo(() => tokens?.access_token ?? null, [tokens]);
    const composerDisabled = !authToken || !isAuthenticated;

    useEffect(() => {
        if (!autoScroll || !scrollRef.current) return;
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight });
    }, [messages, isStreaming, autoScroll]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const threshold = 120;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        setAutoScroll(atBottom);
    };

    const handleSend = async (overrideInput?: string) => {
        const content = (overrideInput ?? input).trim();
        if (!content || isStreaming) return;

        if (!authToken) {
            setError('Please log in to use the assistant.');
            return;
        }

        setInput('');
        setError(null);

        const userMessage = createMessage('user', content);
        const assistantMessage = createMessage('assistant', '');
        setMessages((prev) => [...prev, userMessage, assistantMessage]);

        const controller = new AbortController();
        setAbortController(controller);
        setIsStreaming(true);

        try {
            await streamAssistantQuery({
                scope,
                query: content,
                token: authToken,
                signal: controller.signal,
                onTokenChunk: (chunk) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === assistantMessage.id
                                ? { ...msg, content: `${msg.content}${chunk}` }
                                : msg
                        )
                    );
                },
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Assistant request failed';
            setError(message);
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessage.id ? { ...msg, content: `⚠️ ${message}` } : msg
                )
            );
        } finally {
            setIsStreaming(false);
            setAbortController(null);
        }
    };

    const handleStop = () => {
        abortController?.abort();
        setIsStreaming(false);
    };

    const handleClear = () => {
        setMessages([]);
        setError(null);
    };

    return (
        <div className={clsx('flex flex-col h-full bg-white rounded-2xl border border-gray-200 shadow-sm', className)}>
            <div className="flex items-start gap-3 p-4 border-b border-gray-100">
                <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
                {onClose && (
                    <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {error && (
                <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="px-4 pt-4 space-y-3">
                {suggestedPrompts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {suggestedPrompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => handleSend(prompt)}
                                className="text-xs px-3 py-2 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {!isAuthenticated && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                        Please <Link href="/auth/login" className="underline font-medium">log in</Link> to chat with the assistant.
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-[320px] px-4 pb-4 pt-2">
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4"
                >
                    {messages.length === 0 && !isStreaming ? (
                        <div className="text-sm text-gray-500 text-center py-10">
                            Start the conversation to receive tailored guidance.
                        </div>
                    ) : (
                        messages.map((message) => <MessageBubble key={message.id} message={message} />)
                    )}
                    {isStreaming && (
                        <div className="flex justify-start">
                            <TypingIndicator />
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 pb-4">
                <ChatComposer
                    value={input}
                    onChange={setInput}
                    onSend={() => handleSend()}
                    onStop={handleStop}
                    onClear={messages.length > 0 ? handleClear : undefined}
                    isStreaming={isStreaming}
                    disabled={composerDisabled}
                />
            </div>
        </div>
    );
};
