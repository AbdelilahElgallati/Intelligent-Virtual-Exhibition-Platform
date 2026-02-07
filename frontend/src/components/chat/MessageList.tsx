import React, { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';

interface Message {
    id: string;
    sender_name: string;
    content: string;
    timestamp: string;
    sender_id: string;
}

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, currentUserId }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-white">
            {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <span className="text-2xl">💬</span>
                    </div>
                    <p className="text-sm font-medium">No messages yet. Say hi!</p>
                </div>
            ) : (
                messages.map((msg, index) => (
                    <MessageItem
                        key={msg.id || index}
                        message={msg}
                        isOwn={msg.sender_id === currentUserId}
                    />
                ))
            )}
        </div>
    );
};
