import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { X, Send, User, Loader2, Calendar, MessageSquare, AlertCircle, ArrowLeft } from 'lucide-react';
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
    eventTimeZone?: string;
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

export function ChatPanel({ standId, standName, onClose, avatarBg, initialRoomId, isEmbedded, themeColor = '#4f46e5', onMeetingOpen, disableMessageLimit = false, eventTimeZone = 'UTC' }: ChatPanelProps) {
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
    const viewerTimeZone = getUserTimezone();

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
    const initializedStandRef = useRef<string | null>(null);

    useEffect(() => {
        const initChat = async () => {
            if (!isAuthenticated) return;

            // Handle pre-set rooms mapping
            if (initialRoomId) {
                if (initializedStandRef.current === initialRoomId) return;
                initializedStandRef.current = initialRoomId;
                
                setIsLoading(true);
                setInput('');
                setMessages([]);
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
            
            // Abort if already starting init for this stand (fixes React 18 strict mode duplicate API triggers)
            if (initializedStandRef.current === standId) return;
            initializedStandRef.current = standId;

            setIsLoading(true);
            setInput('');
            setMessages([]);

            try {
                const room = await apiClient.post<ChatRoom>(ENDPOINTS.CHAT.START(standId));
                const actualRoomId = room._id || (room as any).id;
                setRoomId(actualRoomId);
                const history = await apiClient.get<any[]>(ENDPOINTS.CHAT.HISTORY(actualRoomId));
                setMessages((prev) => mergeChatHistory(prev, history.reverse()));
            } catch (error) {
                console.error("Failed to init chat", error);
                initializedStandRef.current = null; // allow retry on failure
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
                <div
                    className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border"
                    style={{ borderColor: `rgba(${r},${g},${b},0.24)` }}
                    onClick={e => e.stopPropagation()}
                >
                    <div
                        className="p-4 border-b flex justify-between items-center text-white"
                        style={{
                            background: `linear-gradient(135deg, ${themeColor}, rgba(${r},${g},${b},0.85))`,
                            borderBottomColor: `rgba(${r},${g},${b},0.18)`,
                        }}
                    >
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
                className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300 transform-gpu"
                style={{
                    maxHeight: 'min(88vh, 760px)',
                    borderColor: `rgba(${r},${g},${b},0.26)`,
                    boxShadow: `0 20px 60px -26px rgba(${r},${g},${b},0.48), 0 8px 24px -16px rgba(15,23,42,0.45)`,
                }}
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
                className="px-5 py-4 border-b flex justify-between items-center"
                style={{
                    borderBottomColor: `rgba(${r},${g},${b},0.16)`,
                    background: `linear-gradient(180deg, rgba(${r},${g},${b},0.12) 0%, rgba(255,255,255,0.98) 75%)`,
                }}
            >
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    {/* Back Button for mobile when embedded */}
                    {isEmbedded && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClose(); }} 
                            className="md:hidden p-2 -ml-2 rounded-full hover:bg-zinc-100 text-zinc-500 transition-all active:scale-90"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    
                    <div
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full border flex items-center justify-center shadow-sm shrink-0"
                        style={{
                            backgroundColor: `rgba(${r},${g},${b},0.14)`,
                            borderColor: `rgba(${r},${g},${b},0.24)`,
                        }}
                    >
                        <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: themeColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-xs md:text-sm font-bold leading-none mb-1 text-zinc-900 truncate">
                            Chat with {standName}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-zinc-600">
                            <span className={clsx("w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shadow-sm", isConnected ? "bg-emerald-500" : "bg-red-500")} />
                            {isConnected ? 'Sync Active' : 'Connecting...'}
                            {!disableMessageLimit && !limitReached && myMessageCount > 0 && (
                                <span className="ml-1 opacity-70">
                                    · {remaining} left
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {showClose && (
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition-all active:scale-90">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>
            {/* Announcement banner (visitor only) */}
            {!disableMessageLimit && !limitReached && (
                <div
                    className="flex items-center gap-2 px-4 py-2 border-b"
                    style={{
                        backgroundColor: `rgba(${r},${g},${b},0.08)`,
                        borderBottomColor: `rgba(${r},${g},${b},0.16)`,
                        color: '#4b5563',
                    }}
                >
                    <AlertCircle size={14} className="shrink-0" style={{ color: themeColor }} />
                    <p className="text-[11px] leading-snug">
                        Limited to <span className="font-semibold">{MAX_VISITOR_MESSAGES} messages</span>. Request a meeting for longer discussion.
                    </p>
                </div>
            )}
            </>
        );
    }

    function renderBody() {
        return (
            <div
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{
                    minHeight: 200,
                    background: `linear-gradient(180deg, rgba(${r},${g},${b},0.06) 0%, #f8fafc 38%, #f8fafc 100%)`,
                }}
            >
                {error && !isConnected && (
                    <div className="px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-[11px] font-medium text-amber-700 text-center animate-pulse">
                        Connecting to sync service...
                    </div>
                )}
                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin" style={{ color: themeColor }} />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 flex flex-col items-center justify-center py-16 bg-white/80 rounded-2xl border border-dashed"
                        style={{ borderColor: `rgba(${r},${g},${b},0.22)` }}>
                        <MessageSquare size={32} className="mb-4 opacity-20" />
                        <p className="text-xs font-medium">No messages yet</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.sender_id === userId;
                        return (
                            <div key={idx} className={clsx("flex", isMe ? "justify-end" : "justify-start gap-4")}>
                                {!isMe && (
                                    <div
                                        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border"
                                        style={{
                                            backgroundColor: avatarBg ?? `rgba(${r},${g},${b},0.12)`,
                                            borderColor: `rgba(${r},${g},${b},0.20)`,
                                        }}
                                    >
                                        <User size={16} className="text-gray-400" />
                                    </div>
                                )}
                                <div className="flex flex-col max-w-[85%]">
                                    {!isMe && msg.sender_name && (
                                        <div className="text-[10px] font-semibold tracking-wide mb-1.5 ml-1 text-gray-500">
                                            {msg.sender_name}
                                        </div>
                                    )}
                                    <div
                                        className={clsx(
                                            "rounded-2xl px-4 py-2.5 text-[13px] font-medium leading-relaxed shadow-sm",
                                            isMe 
                                                ? "text-white rounded-tr-sm shadow-xl" 
                                                : "text-gray-800 border rounded-tl-sm"
                                        )}
                                        style={isMe
                                            ? {
                                                backgroundColor: themeColor,
                                                boxShadow: `0 10px 24px -8px ${themeColor}6e`,
                                            }
                                            : {
                                                backgroundColor: `rgba(255,255,255,0.88)`,
                                                borderColor: `rgba(${r},${g},${b},0.18)`,
                                            }}
                                    >
                                        {msg.content}
                                    </div>
                                    <span className={clsx(
                                        "text-[10px] text-gray-400 mt-1.5 opacity-70",
                                        isMe ? "text-right mr-1" : "ml-1"
                                    )}>
                                        {formatInTZ(msg.timestamp, viewerTimeZone, 'h:mm a')}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Limit-reached banner (visitor only) */}
                {!disableMessageLimit && limitReached && (
                    <div
                        className="rounded-2xl p-8 text-center border bg-white/85 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-xl"
                        style={{ borderColor: `${themeColor}22` }}
                    >
                        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={32} className="text-amber-500" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Limit Reached</h4>
                        <p className="text-xs text-gray-500 leading-relaxed mb-6 px-4">
                            You&apos;ve used all {MAX_VISITOR_MESSAGES} messages.
                            Request a formal meeting to continue the discussion with our team.
                        </p>
                        <button
                            className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 rounded-xl text-white text-xs font-semibold shadow-lg transition-all duration-300 transform-gpu active:scale-95 hover:brightness-110"
                            style={{ 
                                backgroundColor: themeColor,
                                boxShadow: `0 12px 32px -8px ${themeColor}aa`
                            }}
                            onClick={handleMeetingRequest}
                        >
                            <Calendar size={14} />
                            Request Meeting
                        </button>
                    </div>
                )}

                {/* Low-message warning (visitor only) */}
                {!disableMessageLimit && !limitReached && remaining <= 5 && remaining > 0 && myMessageCount > 0 && (
                    <div className="text-center py-1">
                        <span
                            className="text-[11px] px-3 py-1 rounded-full border"
                            style={{
                                color: themeColor,
                                backgroundColor: `rgba(${r},${g},${b},0.10)`,
                                borderColor: `rgba(${r},${g},${b},0.22)`,
                            }}
                        >
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
                <div className="p-5 border-t border-zinc-200 bg-white text-center">
                    <p className="text-xs font-medium text-gray-500 mb-1">Chat limit reached</p>
                    <button
                        onClick={handleMeetingRequest}
                        className="text-xs font-semibold hover:underline underline-offset-4"
                        style={{ color: themeColor }}
                    >
                        Request a meeting instead →
                    </button>
                </div>
            );
        }

        return (
            <div
                className="p-4 border-t bg-white"
                style={{ borderTopColor: `rgba(${r},${g},${b},0.16)` }}
            >
                <form onSubmit={handleSend} className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isConnected ? 'Type something...' : 'Reconnecting...'}
                            className="w-full bg-white border rounded-xl px-4 py-3 text-sm font-normal focus:outline-none focus:ring-4 transition-all"
                            style={{
                                borderColor: `rgba(${r},${g},${b},0.22)`,
                                ['--tw-ring-color' as string]: `${themeColor}26`,
                            }}
                            disabled={!isConnected}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || !isConnected}
                        className="w-11 h-11 flex items-center justify-center rounded-xl text-white shadow-lg border border-white/20 disabled:opacity-30 disabled:grayscale transition-all duration-300 transform-gpu active:scale-90 hover:brightness-110"
                        style={{ 
                            backgroundColor: themeColor,
                            boxShadow: `0 8px 16px -4px ${themeColor}88`
                         }}
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        );
    }
}
