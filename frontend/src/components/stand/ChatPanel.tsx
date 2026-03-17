import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { X, Send, User, Loader2, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const MAX_VISITOR_MESSAGES = 15;

interface ChatPanelProps {
    standId?: string;
    standName: string;
    onClose: () => void;
    avatarBg?: string;
    initialRoomId?: string;
    isEmbedded?: boolean;
    themeColor?: string;
    onMeetingOpen?: () => void;
    /** When true, disables the 15-message limit, announcement banner, and meeting CTA (enterprise mode). */
    disableMessageLimit?: boolean;
}

interface ChatRoom {
    _id: string;
    members: string[];
}

function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16) || 79,
        g: parseInt(h.substring(2, 4), 16) || 70,
        b: parseInt(h.substring(4, 6), 16) || 229,
    };
}

function mergeChatHistory(existing: any[], incoming: any[]) {
    const merged = [...existing];

    for (const message of incoming) {
        const idx = merged.findIndex((item) => {
            if (item._id && message._id) return item._id === message._id;
            return item.sender_id === message.sender_id
                && item.timestamp === message.timestamp
                && item.content === message.content;
        });

        if (idx === -1) {
            merged.push(message);
        } else {
            merged[idx] = { ...merged[idx], ...message };
        }
    }

    return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function ChatPanel({ standId, standName, onClose, avatarBg, initialRoomId, isEmbedded, themeColor = '#4f46e5', onMeetingOpen, disableMessageLimit = false }: ChatPanelProps) {
    const { user, isAuthenticated } = useAuth();
    const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(!initialRoomId);

    const { messages, setMessages, isConnected, error, sendMessage } = useChatWebSocket(roomId);
    const [myMessageCount, setMyMessageCount] = useState(0);
    const [limitReached, setLimitReached] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const userId = user?.id || (user as any)?._id;
    const { r, g, b } = hexToRgb(themeColor);

    /* ---- Persist / restore limit per room (visitor only) ---- */
    const limitKey = roomId ? `chat-limit-${roomId}` : null;

    useEffect(() => {
        if (disableMessageLimit) return;
        if (limitKey && typeof window !== 'undefined') {
            const stored = localStorage.getItem(limitKey);
            if (stored === 'true') setLimitReached(true);
        }
    }, [limitKey, disableMessageLimit]);

    const persistLimit = useCallback(() => {
        if (disableMessageLimit) return;
        if (limitKey && typeof window !== 'undefined') {
            localStorage.setItem(limitKey, 'true');
        }
    }, [limitKey, disableMessageLimit]);

    /* ---- Count MY messages (visitor only) ---- */
    useEffect(() => {
        if (disableMessageLimit || !userId) return;
        const count = messages.filter(m => m.sender_id === userId).length;
        setMyMessageCount(count);
        if (count >= MAX_VISITOR_MESSAGES && !limitReached) {
            setLimitReached(true);
            persistLimit();
        }
    }, [messages, userId, limitReached, persistLimit, disableMessageLimit]);

    /* ---- Initialize chat ---- */
    useEffect(() => {
        const initChat = async () => {
            if (!isAuthenticated) return;

            setIsLoading(true);
            setInput('');
            setMessages([]);

            if (initialRoomId) {
                setRoomId(initialRoomId);
                try {
                    const history = await apiClient.get<any[]>(ENDPOINTS.CHAT.HISTORY(initialRoomId));
                    setMessages((prev) => mergeChatHistory(prev, history.reverse()));
                } catch (error) {
                    console.error("Failed to fetch history", error);
                } finally {
                    setIsLoading(false);
                }
                return;
            }

            if (!standId) return;

            try {
                const room = await apiClient.post<ChatRoom>(ENDPOINTS.CHAT.START(standId));
                const actualRoomId = room._id || (room as any).id;
                setRoomId(actualRoomId);
                const history = await apiClient.get<any[]>(ENDPOINTS.CHAT.HISTORY(actualRoomId));
                setMessages((prev) => mergeChatHistory(prev, history.reverse()));
            } catch (error) {
                console.error("Failed to init chat", error);
            } finally {
                setIsLoading(false);
            }
        };
        initChat();
    }, [standId, initialRoomId, isAuthenticated, setMessages]);

    /* ---- Scroll to bottom ---- */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !isConnected || (!disableMessageLimit && limitReached)) return;
        sendMessage(input);
        setInput('');
    };

    const handleMeetingRequest = () => {
        if (onMeetingOpen) {
            onClose();
            setTimeout(() => onMeetingOpen(), 150);
        } else {
            window.dispatchEvent(new CustomEvent('open-meeting-request', { detail: { standId } }));
        }
    };

    const remaining = MAX_VISITOR_MESSAGES - myMessageCount;

    /* ===================== NOT AUTHENTICATED ===================== */
    if (!isAuthenticated) {
        if (isEmbedded) {
            return (
                <div className="flex flex-col h-full bg-white w-full">
                    <div className="p-4 border-b flex justify-between items-center text-white" style={{ backgroundColor: themeColor }}>
                        <h3 className="font-bold">Chat with {standName}</h3>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-6 text-center text-gray-500">
                        Please log in to chat.
                    </div>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex justify-between items-center text-white" style={{ backgroundColor: themeColor }}>
                        <h3 className="font-bold">Chat with {standName}</h3>
                        <button onClick={onClose} className="hover:opacity-80 p-1 rounded transition-colors"><X size={20} /></button>
                    </div>
                    <div className="flex items-center justify-center p-12 text-center text-gray-500">
                        Please log in to chat.
                    </div>
                </div>
            </div>
        );
    }

    /* ===================== EMBEDDED MODE ===================== */
    if (isEmbedded) {
        return (
            <div className="flex flex-col h-full bg-white w-full transition-all">
                {renderHeader(false)}
                {renderBody()}
                {renderInput()}
            </div>
        );
    }

    /* ===================== MODAL MODE (centered) ===================== */
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: 'min(85vh, 680px)' }}
                onClick={e => e.stopPropagation()}
            >
                {renderHeader(true)}
                {renderBody()}
                {renderInput()}
            </div>
        </div>
    );

    /* ===================== RENDER HELPERS ===================== */

    function renderHeader(showClose: boolean) {
        return (
            <>
            <div
                className="px-5 py-3.5 border-b flex justify-between items-center text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${themeColor}, rgba(${r},${g},${b},0.85))` }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                        <MessageSquare size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Chat with {standName}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-white/70 mt-0.5">
                            <span className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-green-400" : "bg-red-400")} />
                            {isConnected ? 'Online' : 'Connecting...'}
                            {!disableMessageLimit && !limitReached && myMessageCount > 0 && (
                                <span className="ml-2 text-white/50">
                                    · {remaining} message{remaining !== 1 ? 's' : ''} left
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {showClose && (
                    <button onClick={onClose} className="hover:bg-white/20 p-1.5 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                )}
            </div>
            {/* Announcement banner (visitor only) */}
            {!disableMessageLimit && !limitReached && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 text-amber-800">
                    <AlertCircle size={14} className="shrink-0 text-amber-500" />
                    <p className="text-[11px] leading-snug">
                        This chat is limited to <span className="font-semibold">{MAX_VISITOR_MESSAGES} messages</span>. For extended discussions, please request a meeting.
                    </p>
                </div>
            )}
            </>
        );
    }

    function renderBody() {
        return (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/80" style={{ minHeight: 200 }}>
                {error && !isConnected && (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-700 mb-2">
                        Live sync is reconnecting. You can keep typing and send when the connection returns.
                    </div>
                )}
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin" style={{ color: themeColor }} />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm mt-10">
                        <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
                        No messages yet. Say hello!
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.sender_id === userId;
                        return (
                            <div key={idx} className={clsx("flex", isMe ? "justify-end" : "justify-start gap-2")}>
                                {!isMe && (
                                    <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1"
                                        style={{ backgroundColor: avatarBg ?? '#ffffff', border: '1px solid #e5e7eb' }}
                                    >
                                        <User size={14} className="text-gray-500" />
                                    </div>
                                )}
                                <div className="flex flex-col max-w-[80%]">
                                    <div
                                        className={clsx(
                                            "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                            isMe ? "text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
                                        )}
                                        style={isMe ? { backgroundColor: themeColor } : undefined}
                                    >
                                        {!isMe && msg.sender_name && (
                                            <div className="text-[10px] font-bold mb-0.5" style={{ color: themeColor }}>
                                                {msg.sender_name}
                                            </div>
                                        )}
                                        {msg.content}
                                    </div>
                                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Limit-reached banner (visitor only) */}
                {!disableMessageLimit && limitReached && (
                    <div
                        className="rounded-2xl p-5 text-center border animate-in fade-in slide-in-from-bottom-2 duration-500"
                        style={{ backgroundColor: `rgba(${r},${g},${b},0.06)`, borderColor: `rgba(${r},${g},${b},0.15)` }}
                    >
                        <AlertCircle size={26} className="mx-auto mb-2" style={{ color: themeColor }} />
                        <h4 className="text-sm font-bold text-gray-900">Message Limit Reached</h4>
                        <p className="text-xs text-gray-600 mt-1 mb-3 leading-relaxed">
                            You&apos;ve used all {MAX_VISITOR_MESSAGES} messages in this chat.
                            To continue the conversation, request a formal meeting with the stand team.
                        </p>
                        <Button
                            size="sm"
                            className="text-xs h-8 text-white"
                            style={{ backgroundColor: themeColor }}
                            onClick={handleMeetingRequest}
                        >
                            <Calendar size={14} className="mr-1.5" />
                            Request a Meeting
                        </Button>
                    </div>
                )}

                {/* Low-message warning (visitor only) */}
                {!disableMessageLimit && !limitReached && remaining <= 5 && remaining > 0 && myMessageCount > 0 && (
                    <div className="text-center py-1">
                        <span className="text-[11px] text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                            {remaining} message{remaining !== 1 ? 's' : ''} remaining
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        );
    }

    function renderInput() {
        if (!disableMessageLimit && limitReached) {
            return (
                <div className="p-3 border-t bg-gray-50 text-center">
                    <p className="text-xs text-gray-500">Chat limit reached —</p>
                    <button
                        onClick={handleMeetingRequest}
                        className="text-xs font-semibold mt-0.5 hover:underline"
                        style={{ color: themeColor }}
                    >
                        Request a meeting instead →
                    </button>
                </div>
            );
        }

        return (
            <div className="p-3 border-t bg-white">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isConnected ? 'Type a message...' : 'Connection is recovering...'}
                        className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                        style={{ ['--tw-ring-color' as string]: `${themeColor}66` }}
                        disabled={!isConnected}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || !isConnected}
                        className="text-white p-2.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
                        style={{ backgroundColor: themeColor }}
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        );
    }
}
