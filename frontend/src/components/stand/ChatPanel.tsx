import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { X, Send, User, Loader2, Calendar } from 'lucide-react';
import clsx from 'clsx';

interface ChatPanelProps {
    standId?: string;
    standName: string;
    onClose: () => void;
    avatarBg?: string;
    initialRoomId?: string;
    isEmbedded?: boolean;
}

interface ChatRoom {
    _id: string;
    members: string[];
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

export function ChatPanel({ standId, standName, onClose, avatarBg, initialRoomId, isEmbedded }: ChatPanelProps) {
    const { user, isAuthenticated } = useAuth();
    const [roomId, setRoomId] = useState<string | null>(initialRoomId || null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(!initialRoomId);

    // Connect to WS
    const { messages, setMessages, isConnected, error, sendMessage } = useChatWebSocket(roomId);
    const [visitorMessageCount, setVisitorMessageCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Update visitor message count
    useEffect(() => {
        if (!user) return;
        const count = messages.filter(m => m.sender_id !== (user.id || (user as any)._id)).length;
        setVisitorMessageCount(count);
    }, [messages, user]);

    // 1. Initialize Chat (Get Room or use initialRoomId)
    useEffect(() => {
        const initChat = async () => {
            if (!isAuthenticated) return;

            setIsLoading(true);
            setInput('');
            setMessages([]);

            if (initialRoomId) {
                setRoomId(initialRoomId);
                // Fetch History for initialRoomId
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

                // 2. Fetch History
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

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !isConnected) return;
        sendMessage(input);
        setInput('');
    };

    const containerClasses = isEmbedded
        ? "flex flex-col h-full bg-white w-full transition-all"
        : "flex flex-col h-full bg-white shadow-xl border-l border-gray-200 w-80 sm:w-96 fixed right-0 bottom-0 top-0 z-50 transition-transform";

    if (!isAuthenticated) {
        return (
            <div className={containerClasses}>
                <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white">
                    <h3 className="font-bold">Chat with {standName}</h3>
                    {!isEmbedded && <button onClick={onClose}><X size={20} /></button>}
                </div>
                <div className="flex-1 flex items-center justify-center p-6 text-center text-gray-500">
                    Please log in to chat.
                </div>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white shadow-sm">
                <div>
                    <h3 className="font-bold text-sm">Conversation with {standName}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-100 mt-0.5">
                        <span className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-green-400" : "bg-red-400")} />
                        {isConnected ? 'Connected' : 'Reconnecting...'}
                    </div>
                </div>
                {!isEmbedded && <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded transition-colors"><X size={20} /></button>}
            </div>

            {error && !isConnected && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-700">
                    Live sync is reconnecting. You can keep typing and send when the connection returns.
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm mt-10">No messages yet. Say hello!</div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.sender_id === (user?.id || (user as any)?._id);
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
                                <div className="flex flex-col">
                                    <div className={clsx(
                                        "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                        isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                                    )}>
                                        {!isMe && msg.sender_name && (
                                            <div className="text-[10px] font-bold text-indigo-500 mb-0.5">
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
                {visitorMessageCount >= 15 && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <Calendar size={24} className="mx-auto text-indigo-600 mb-2" />
                        <h4 className="text-sm font-bold text-indigo-900">Highly Engaged!</h4>
                        <p className="text-[11px] text-indigo-700 mb-3">You've had a great conversation. Would you like to schedule a formal meeting to discuss further?</p>
                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8"
                            onClick={() => {
                                // Logic to trigger meeting request modal or navigation
                                window.dispatchEvent(new CustomEvent('open-meeting-request', { detail: { standId } }));
                            }}
                        >
                            Request Formal Meeting
                        </Button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t bg-white">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isConnected ? "Type a message..." : "Connection is recovering..."}
                        className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || !isConnected}
                        className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
