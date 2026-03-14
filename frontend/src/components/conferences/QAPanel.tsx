'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { QAItem } from '@/types/conference';
import { http } from '@/lib/http';

interface QAPanelProps {
    conferenceId: string;
    isSpeaker?: boolean;
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
        await http.post(`/conferences/${conferenceId}/qa/${qaId}/upvote`);
        loadQuestions();
    };

    const answerQuestion = async (qaId: string, answer: string) => {
        await http.patch(`/conferences/${conferenceId}/qa/${qaId}/answer`, { answer });
        loadQuestions();
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700">Q&A</span>
                <span className="text-[11px] font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{questions.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
                {questions.length === 0 && (
                    <div className="text-center text-sm text-zinc-400 py-12">
                        No questions yet. Be the first to ask!
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
                <div className="border-t border-zinc-100 p-4">
                    <form onSubmit={submitQuestion}>
                        <textarea
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                            rows={2}
                            value={newQuestion}
                            onChange={(e) => setNewQuestion(e.target.value)}
                            placeholder="Ask a question..."
                        />
                        <button
                            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                            disabled={submitting || !newQuestion.trim()}
                        >
                            {submitting ? 'Sending…' : 'Submit Question'}
                        </button>
                    </form>
                </div>
            )}
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
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg px-3.5 py-3">
            <p className="text-sm text-zinc-800 leading-snug">{item.question}</p>
            <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-zinc-400 font-medium">{item.user_name}</span>
                <button
                    onClick={onUpvote}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded px-2 py-0.5 transition-colors"
                >
                    ▲ {item.upvotes}
                </button>
                {item.is_answered && <span className="text-[11px] font-medium text-emerald-600">✓ Answered</span>}
            </div>
            {item.is_answered && item.answer && (
                <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200/60 rounded-md text-xs text-emerald-700">
                    📢 {item.answer}
                </div>
            )}
            {isSpeaker && !item.is_answered && (
                <div className="mt-2">
                    {!showing ? (
                        <button
                            onClick={() => setShowing(true)}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded px-2.5 py-1 transition-colors"
                        >
                            Answer
                        </button>
                    ) : (
                        <div className="flex gap-1.5">
                            <input
                                className="flex-1 bg-white border border-zinc-200 rounded-md px-2.5 py-1 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                value={answerText}
                                onChange={(e) => setAnswerText(e.target.value)}
                                placeholder="Your answer…"
                            />
                            <button
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md px-3 py-1 transition-colors"
                                onClick={() => { onAnswer(answerText); setShowing(false); }}
                            >
                                Send
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
