import React from 'react';
import { Button } from '@/components/ui/Button';

interface ChatComposerProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop?: () => void;
    onClear?: () => void;
    isStreaming?: boolean;
    disabled?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
    value,
    onChange,
    onSend,
    onStop,
    onClear,
    isStreaming,
    disabled,
}) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (!disabled && !isStreaming) {
                onSend();
            }
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Press Enter to send, Shift+Enter for a new line</span>
                {onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-indigo-600 hover:underline"
                    >
                        Clear chat
                    </button>
                )}
            </div>
            <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
                <textarea
                    className="w-full resize-none rounded-t-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask the assistant..."
                    disabled={disabled}
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                    <div className="text-xs text-gray-400">AI may produce incorrect answers. Verify important info.</div>
                    <div className="flex items-center gap-2">
                        {isStreaming && onStop && (
                            <Button variant="outline" size="sm" onClick={onStop}>
                                Stop
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={onSend}
                            disabled={disabled || !value.trim() || !!isStreaming}
                        >
                            Send
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
