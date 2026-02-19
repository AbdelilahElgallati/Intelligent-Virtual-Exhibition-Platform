"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X } from 'lucide-react';
import clsx from 'clsx';
import { AssistantMessage, streamAssistantQuery } from '@/services/assistant.service';
import { useAuth } from '@/context/AuthContext';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { TypingIndicator } from './TypingIndicator';

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

    const showEmptyState = messages.length === 0 && !isStreaming;

    return (
        <div className={clsx('flex flex-col h-full bg-white rounded-2xl overflow-hidden', className)}>

            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 leading-tight">{title}</h2>
                    {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-1">
                    {messages.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Message area ── */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
                {showEmptyState ? (
                    <div className="flex flex-col items-center justify-center h-full gap-5 py-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <MessageCircle className="w-7 h-7 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">How can I help you?</p>
                            <p className="text-xs text-gray-400 mt-1">Ask anything about the platform or this event.</p>
                        </div>

                        {!isAuthenticated ? (
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 max-w-xs">
                                Please <Link href="/auth/login" className="underline font-medium">log in</Link> to chat with the assistant.
                            </div>
                        ) : suggestedPrompts.length > 0 ? (
                            <div className="flex flex-col gap-2 w-full max-w-xs">
                                {suggestedPrompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => handleSend(prompt)}
                                        className="w-full text-left text-xs px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-gray-600 transition-colors"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <>
                        {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
                        {isStreaming && (
                            <div className="flex justify-start">
                                <TypingIndicator />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mx-4 mb-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                </div>
            )}

            {/* ── Composer ── */}
            <div className="border-t border-gray-100 bg-white">
                <ChatComposer
                    value={input}
                    onChange={setInput}
                    onSend={() => handleSend()}
                    onStop={handleStop}
                    isStreaming={isStreaming}
                    disabled={composerDisabled}
                />
            </div>
        </div>
    );
};
