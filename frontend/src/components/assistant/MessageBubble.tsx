import React from 'react';
import clsx from 'clsx';
import { AssistantMessage } from '@/services/assistant.service';

interface MessageBubbleProps {
    message: AssistantMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const isUser = message.role === 'user';

    return (
        <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
            <div className={clsx(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm whitespace-pre-wrap leading-relaxed',
                isUser ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
            )}>
                {message.content || (isUser ? '' : '…')}
            </div>
        </div>
    );
};
