import React, { useState } from 'react';
import { Send, Smile, Paperclip } from 'lucide-react';

interface ChatInputProps {
    onSendMessage: (content: string) => void;
    disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled }) => {
    const [content, setContent] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (content.trim()) {
            onSendMessage(content);
            setContent('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t bg-white flex items-center gap-2">
            <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                <Paperclip size={20} />
            </button>
            <div className="flex-1 relative">
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type a message..."
                    disabled={disabled}
                    className="w-full py-2 px-4 pr-10 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600">
                    <Smile size={18} />
                </button>
            </div>
            <button
                type="submit"
                disabled={disabled || !content.trim()}
                className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
                <Send size={18} />
            </button>
        </form>
    );
};
