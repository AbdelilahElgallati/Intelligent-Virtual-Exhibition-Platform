'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, Tag, X, ArrowRight, Sparkles } from 'lucide-react';

/* ── Category list (mirrors StandsGrid) ── */
const STAND_CATEGORIES = [
    'Technology',
    'Healthcare',
    'Education',
    'Finance',
    'Recruitment',
    'Marketing',
    'Design',
    'Engineering',
    'Sustainability',
    'Other',
] as const;

export interface FilterValues {
    category: string;
    search: string;
    tags: string;
}

interface StandFilterModalProps {
    onApply: (filters: FilterValues) => void;
    onSkip: () => void;
}

export function StandFilterModal({ onApply, onSkip }: StandFilterModalProps) {
    const [category, setCategory] = useState('');
    const [search, setSearch] = useState('');
    const [tags, setTags] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onApply({ category, search, tags });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

            {/* Modal Card */}
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 transform transition-all">
                {/* ── Header with Pattern ── */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 px-8 py-10 text-center text-white overflow-hidden">
                    {/* Decorative pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:20px_20px]" />
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-inner ring-1 ring-white/20">
                            <Sparkles className="h-8 w-8 text-indigo-100" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight">Personalize Your Experience</h2>
                        <p className="mt-2 text-indigo-100 max-w-sm mx-auto text-sm leading-relaxed">
                            Complete your profile preferences to see the most relevant stands tailored just for you.
                        </p>
                    </div>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Domain / Category
                        </label>
                        <div className="relative">
                            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full appearance-none pl-10 pr-8 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                {STAND_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Search by name
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="e.g. Cloud, AI, Recruitment..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>
                    </div>

                    {/* Tags (placeholder — no backend logic) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Tags <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="e.g. ML, DevOps, HR Tech..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-400">Comma-separated keywords to narrow results</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
                        >
                            Explore Stands
                            <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onSkip}
                            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition"
                        >
                            Skip
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
