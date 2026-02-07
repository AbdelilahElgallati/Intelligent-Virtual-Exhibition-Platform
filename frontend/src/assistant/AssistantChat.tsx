import React, { useRef, useEffect } from 'react';
import { SessionHistory } from './SessionHistory';
import { MessageBubble } from './MessageBubble';
import { useAssistant } from '../hooks/useAssistant';
import { Send, Upload, Sparkles, AlertCircle } from 'lucide-react';

export const AssistantChat: React.FC = () => {
    const { messages, isLoading, currentResponse, sendMessage, stopGeneration } = useAssistant();
    const [input, setInput] = React.useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, currentResponse]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            sendMessage(input);
            setInput('');
        }
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden font-sans text-gray-900 border border-gray-100 rounded-3xl shadow-2xl m-4">
            {/* Sidebar */}
            <SessionHistory
                sessions={[
                    { id: '1', title: 'How to setup a stand', date: 'Just now' },
                    { id: '2', title: 'Exhibition guidelines', date: 'Yesterday' }
                ]}
                onSelectSession={(id) => console.log('Select', id)}
                onNewChat={() => window.location.reload()}
            />

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative h-full">
                {/* Header */}
                <header className="px-8 py-5 border-b bg-white flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">RAG Assistant</h2>
                            <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                Powered by Llama 3 & Ollama
                            </p>
                        </div>
                    </div>
                </header>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
                    {messages.length === 0 && !isLoading && (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto">
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce shadow-inner">
                                <Sparkles size={40} />
                            </div>
                            <h3 className="text-2xl font-bold mb-3">How can I help you today?</h3>
                            <p className="text-gray-500 leading-relaxed">
                                I can help you navigate the exhibition platform, setup your virtual stand, or answer questions about events and exhibitors.
                            </p>
                            <div className="grid grid-cols-2 gap-3 mt-10 w-full">
                                {['How do I join a webinar?', 'Setup my stand', 'Manage leads', 'Speaker schedule'].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => sendMessage(q)}
                                        className="p-3 text-sm font-medium bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl border border-gray-100 transition-all text-left"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <MessageBubble key={i} role={msg.role} content={msg.content} />
                    ))}

                    {currentResponse && (
                        <MessageBubble role="assistant" content={currentResponse} isStreaming />
                    )}

                    {isLoading && !currentResponse && (
                        <div className="p-6 flex gap-4 bg-gray-50/50">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                <Sparkles size={20} className="animate-spin" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-6 border-t bg-white">
                    <form style={{ maxWidth: '800px' }} className="mx-auto" onSubmit={handleSubmit}>
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-10 group-focus-within:opacity-20 transition duration-1000"></div>
                            <div className="relative flex items-end gap-3 p-3 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus-within:border-indigo-500 transition-all">
                                <button
                                    type="button"
                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-xl transition-all"
                                    title="Upload ingestion"
                                >
                                    <Upload size={20} />
                                </button>
                                <textarea
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                    placeholder="Ask me anything about the exhibition..."
                                    rows={1}
                                    className="flex-1 py-2 px-1 focus:outline-none resize-none max-h-40 bg-transparent text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim()}
                                    className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${isLoading
                                            ? 'bg-gray-100 text-gray-400'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200'
                                        }`}
                                >
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-4 mt-3">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest flex items-center gap-1">
                                <AlertCircle size={10} />
                                AI may make mistakes. Verify important info.
                            </p>
                            {isLoading && (
                                <button
                                    onClick={stopGeneration}
                                    className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
                                >
                                    Stop Generation
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
