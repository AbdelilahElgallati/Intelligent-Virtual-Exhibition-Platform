import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Copy, Check } from 'lucide-react';

interface MessageBubbleProps {
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, isStreaming }) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex gap-4 p-6 ${role === 'assistant' ? 'bg-gray-50/50' : 'bg-white'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${role === 'assistant' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                {role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-900">
                        {role === 'assistant' ? 'RAG Assistant' : 'You'}
                    </span>
                    {role === 'assistant' && !isStreaming && (
                        <button
                            onClick={handleCopy}
                            className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"
                            title="Copy response"
                        >
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                    )}
                </div>

                <div className="prose prose-sm max-w-none prose-indigo prose-headings:mb-2 prose-p:leading-relaxed">
                    <ReactMarkdown
                        components={{
                            code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return !inline && match ? (
                                    <div className="relative group my-4">
                                        <SyntaxHighlighter
                                            style={vscDarkPlus}
                                            language={match[1]}
                                            PreTag="div"
                                            className="rounded-xl !m-0 !bg-gray-900"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, '')}
                                        </SyntaxHighlighter>
                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded leading-none uppercase font-bold">
                                                {match[1]}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <code className="bg-gray-100 px-1 py-0.5 rounded text-indigo-600 font-medium" {...props}>
                                        {children}
                                    </code>
                                );
                            }
                        }}
                    >
                        {content}
                    </ReactMarkdown>
                    {isStreaming && (
                        <span className="inline-block w-2 h-4 ml-1 bg-indigo-600 animate-pulse align-middle" />
                    )}
                </div>
            </div>
        </div>
    );
};
