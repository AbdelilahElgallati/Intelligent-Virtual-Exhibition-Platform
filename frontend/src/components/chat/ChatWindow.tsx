import React from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useChat } from '../../hooks/useChat';
import { X, Minus, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
    userId: string;
    userName: string;
    roomId?: string;
    onClose?: () => void;
    isMinimized?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
    userId,
    userName,
    roomId,
    onClose,
    isMinimized: initialMinimized = false
}) => {
    const [isMinimized, setIsMinimized] = React.useState(initialMinimized);
    const { messages, isConnected, sendMessage } = useChat(userId, roomId);

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 z-50"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 z-50 animate-in slide-in-from-bottom-5 duration-300">
            {/* Header */}
            <div className="px-5 py-4 bg-indigo-600 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-indigo-400 rounded-full flex items-center justify-center font-bold">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        {isConnected && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-indigo-600 rounded-full"></div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{userName}</h3>
                        <p className="text-[10px] opacity-80">{isConnected ? 'Online' : 'Connecting...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <Minus size={18} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <MessageList messages={messages} currentUserId={userId} />

            {/* Input */}
            <ChatInput onSendMessage={sendMessage} disabled={!isConnected} />
        </div>
    );
};
