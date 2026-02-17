import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { X, Send, User, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface ChatPanelProps {
    standId: string;
    standName: string;
    onClose: () => void;
}

interface ChatRoom {
    _id: string;
    members: string[];
}

export function ChatPanel({ standId, standName, onClose }: ChatPanelProps) {
    const { user, isAuthenticated } = useAuth();
    const [roomId, setRoomId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Connect to WS
    const { messages, setMessages, isConnected, sendMessage } = useChatWebSocket(roomId);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Initialize Chat (Get Room)
    useEffect(() => {
        const initChat = async () => {
            if (!isAuthenticated) return;
            try {
                const room = await apiClient.post<ChatRoom>(ENDPOINTS.CHAT.START(standId));
                const actualRoomId = room._id || (room as any).id;
                setRoomId(actualRoomId);

                // 2. Fetch History
                const history = await apiClient.get<any[]>(ENDPOINTS.CHAT.HISTORY(actualRoomId));
                // Reverse history to show oldest first if API returns newest first, 
                // but usually chat UI wants chronological. 
                // Our repo sorts timestamp -1 (newest first).
                // So we need to reverse for display (bottom is newest).
                setMessages(history.reverse());
            } catch (error) {
                console.error("Failed to init chat", error);
            } finally {
                setIsLoading(false);
            }
        };
        initChat();
    }, [standId, isAuthenticated]);

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

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col h-full bg-white shadow-xl border-l border-gray-200 w-80 fixed right-0 bottom-0 top-0 z-50">
                <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white">
                    <h3 className="font-bold">Chat with {standName}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                <div className="flex-1 flex items-center justify-center p-6 text-center text-gray-500">
                    Please log in to chat with the exhibitor.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white shadow-xl border-l border-gray-200 w-80 sm:w-96 fixed right-0 bottom-0 top-0 z-50 transition-transform">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white shadow-sm">
                <div>
                    <h3 className="font-bold text-sm">Chat with {standName}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-indigo-100 mt-0.5">
                        <span className={clsx("w-2 h-2 rounded-full", isConnected ? "bg-green-400" : "bg-red-400")} />
                        {isConnected ? 'Online' : 'Connecting...'}
                    </div>
                </div>
                <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded transition-colors"><X size={20} /></button>
            </div>

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
                            <div key={idx} className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
                                <div className={clsx(
                                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                                    isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                                )}>
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 px-1">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })
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
                        placeholder="Type a message..."
                        className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={!isConnected}
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
