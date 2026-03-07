import React from 'react';
import { Send, Square } from 'lucide-react';

interface ChatComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop?: () => void;
    isStreaming?: boolean;
    disabled?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
    value,
    onChange,
    onSend,
    onStop,
    isStreaming,
    disabled,
}) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!disabled && !isStreaming) onSend();
        }
    };

    return (
        <div className="px-3 pt-2 pb-3">
            <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-300 transition-all">
                <textarea
                    className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none min-h-[36px] max-h-[120px] py-1 leading-relaxed"
                    rows={1}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        // auto-grow
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask the assistant..."
                    disabled={disabled}
                />
                {isStreaming && onStop ? (
                    <button
                        type="button"
                        onClick={onStop}
                        className="flex-shrink-0 mb-0.5 p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                        aria-label="Stop"
                    >
                        <Square className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={disabled || !value.trim() || !!isStreaming}
                        className="flex-shrink-0 mb-0.5 p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Send"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                Enter to send · Shift+Enter for new line
            </p>
        </div>
    );
};
