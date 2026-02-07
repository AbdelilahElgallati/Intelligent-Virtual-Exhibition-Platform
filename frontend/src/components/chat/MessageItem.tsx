import React from 'react';

interface Message {
    id: string;
    sender_name: string;
    content: string;
    timestamp: string;
    sender_id: string;
}

interface MessageProps {
    message: Message;
    isOwn: boolean;
}

export const MessageItem: React.FC<MessageProps> = ({ message, isOwn }) => {
    return (
        <div className={`flex flex-col mb-4 ${isOwn ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${isOwn ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                {!isOwn && <p className="text-xs font-semibold mb-1 opacity-70">{message.sender_name}</p>}
                <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
            <span className="text-[10px] mt-1 text-gray-400">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
};
