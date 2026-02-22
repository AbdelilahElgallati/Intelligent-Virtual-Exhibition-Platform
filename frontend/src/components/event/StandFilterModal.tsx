'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, Tag, X, ArrowRight } from 'lucide-react';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* ── Header ── */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-8 text-center text-white">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                        <SlidersHorizontal className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold">What are you looking for?</h2>
                    <p className="mt-1 text-sm text-indigo-100">
                        Tell us your interests so we can show you the most relevant stands.
                    </p>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
