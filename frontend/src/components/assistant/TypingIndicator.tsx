import React from 'react';

export const TypingIndicator: React.FC = () => {
    return (
        <div className="inline-flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-gray-500 text-xs">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
            <span className="ml-1">Assistant is typing…</span>
        </div>
    );
};
