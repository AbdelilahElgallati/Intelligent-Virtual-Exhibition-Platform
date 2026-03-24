'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QAItem } from '@/types/conference';
import { http } from '@/lib/http';

interface QAPanelProps {
    conferenceId: string;
    isSpeaker?: boolean;
}

function formatRelativeTime(value?: string) {
    if (!value) return 'just now';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'just now';

    const diffMs = Date.now() - date.getTime();
    const diffSeconds = Math.max(1, Math.floor(diffMs / 1000));
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return `${diffSeconds}s ago`;
}

export default function QAPanel({ conferenceId, isSpeaker = false }: QAPanelProps) {
    const [questions, setQuestions] = useState<QAItem[]>([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const loadQuestions = useCallback(async () => {
        try {
            const data = await http.get<QAItem[]>(`/conferences/${conferenceId}/qa`);
            setQuestions(data);
        } catch { }
    }, [conferenceId]);

    useEffect(() => {
        loadQuestions();
        const interval = setInterval(loadQuestions, 5000);
        return () => clearInterval(interval);
    }, [loadQuestions]);

    const submitQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim()) return;
        setSubmitting(true);
        try {
            await http.post(`/conferences/${conferenceId}/qa`, { question: newQuestion });
            setNewQuestion('');
            loadQuestions();
        } finally {
            setSubmitting(false);
        }
    };

    const upvote = async (qaId: string) => {
        await http.post(`/conferences/${conferenceId}/qa/${qaId}/upvote`, {});
        loadQuestions();
    };

    const answerQuestion = async (qaId: string, answer: string) => {
        await http.patch(`/conferences/${conferenceId}/qa/${qaId}/answer`, { answer });
        loadQuestions();
    };

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Minimal Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Q&A</span>
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{questions.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
                {questions.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-2 opacity-40">
                        <div className="w-10 h-px bg-zinc-700" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No questions yet</p>
                        <div className="w-10 h-px bg-zinc-700" />
                    </div>
                )}
                {questions.map((q) => (
                    <SpeakerQAItem
                        key={q._id}
                        item={q}
                        isSpeaker={isSpeaker}
                        onUpvote={() => upvote(q._id)}
                        onAnswer={(answer) => answerQuestion(q._id, answer)}
                    />
                ))}
            </div>

            {!isSpeaker && (
                <div className="p-4 bg-black/20 backdrop-blur-sm border-t border-white/5">
                    <form onSubmit={submitQuestion} className="space-y-3">
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all font-medium"
                            rows={3}
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            placeholder="Type your question here..."
                        />
                        <button
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:grayscale text-white text-xs font-black uppercase tracking-widest rounded-xl py-3.5 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                            disabled={submitting || !newQuestion.trim()}
                        >
                            {submitting ? 'Sending...' : 'Post Question'}
                        </button>
                    </form>
                </div>
            )}

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
            `}</style>
        </div>
    );
}

function SpeakerQAItem({
    item,
    isSpeaker,
    onUpvote,
    onAnswer,
}: {
    item: QAItem;
    isSpeaker: boolean;
    onUpvote: () => void;
    onAnswer: (a: string) => void;
}) {
    const [answerText, setAnswerText] = useState('');
    const [showing, setShowing] = useState(false);

    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.05] hover:border-white/10 group">
            <p className="text-sm text-zinc-200 font-medium leading-relaxed">{item.question}</p>
            
            <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500 border border-white/5">
                        {item.user_name?.charAt(0) || '?'}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-bold tracking-tight">{item.user_name}</span>
                </div>
                
                <span className="text-[10px] text-zinc-600 font-medium">{formatRelativeTime(item.created_at)}</span>
                
                <div className="flex-1" />

                <button
                    onClick={onUpvote}
                    className="flex items-center gap-1.5 text-[10px] font-black text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg px-2.5 py-1.5 transition-all group-hover:scale-110 active:scale-90"
                >
                    <span className="text-[8px]">▲</span> {item.upvotes}
                </button>
                
                {item.is_answered && (
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 tracking-widest uppercase">Resolved</span>
                )}
            </div>

            {item.is_answered && item.answer && (
                <div className="mt-4 relative pl-4 border-l-2 border-emerald-500/30">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Speaker's Answer
                    </p>
                    <p className="text-[13px] text-zinc-400 font-medium leading-relaxed italic">
                        "{item.answer}"
                    </p>
                </div>
            )}

            {isSpeaker && !item.is_answered && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    {!showing ? (
                        <button
                            onClick={() => setShowing(true)}
                            className="w-full text-[10px] font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 transition-all uppercase tracking-widest"
                        >
                            Reply to Question
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
                                value={answerText}
                                autoFocus
                                onChange={(e) => setAnswerText(e.target.value)}
                                placeholder="Type answer..."
                            />
                            <button
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl px-5 py-2 transition-all active:scale-95"
                                onClick={() => { if(answerText.trim()) onAnswer(answerText); setShowing(false); }}
                            >
                                Send
                            </button>
                            <button
                                className="text-zinc-500 hover:text-white px-2 transition-colors"
                                onClick={() => setShowing(false)}
                            >
                                <span className="text-xl">×</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
