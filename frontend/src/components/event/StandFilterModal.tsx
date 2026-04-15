'use client';

import { useState } from 'react';
import { Tag, ArrowRight, Sparkles } from 'lucide-react';

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

/* ── Interest / topic tags visitors can pick ── */
const INTEREST_TAGS = [
    'AI', 'ML', 'Cloud', 'DevOps', 'Kubernetes', 'IoT', 'Blockchain',
    'HealthTech', 'FinTech', 'EdTech', 'GreenTech', 'Cybersecurity',
    'Big Data', 'SaaS', 'UX/UI', 'HR Tech', 'E-Commerce', 'Robotics',
    'AR/VR', 'Networking', '5G', 'Open Source',
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
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const toggleTag = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onApply({
            category,
            search: selectedTags.join(','),
            tags: selectedTags.join(','),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

            {/* Modal Card */}
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 transform transition-all max-h-[90vh] flex flex-col">
                {/* ── Header with Pattern ── */}
                <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 px-8 py-8 text-center text-white overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:20px_20px]" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-inner ring-1 ring-white/20">
                            <Sparkles className="h-7 w-7 text-indigo-100" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight">Personalize Your Experience</h2>
                        <p className="mt-1.5 text-indigo-100 max-w-sm mx-auto text-sm leading-relaxed">
                            Select your interests to see the most relevant stands.
                        </p>
                    </div>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Category chips */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Domain / Category
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setCategory('')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                    category === ''
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                                }`}
                            >
                                All
                            </button>
                            {STAND_CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(category === cat ? '' : cat)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                        category === cat
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interest tags */}
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                            <Tag className="h-4 w-4 text-gray-400" />
                            Topics you&apos;re interested in
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {INTEREST_TAGS.map((tag) => {
                                const active = selectedTags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                                            active
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                        {selectedTags.length > 0 && (
                            <p className="mt-2 text-xs text-gray-500">
                                {selectedTags.length} topic{selectedTags.length > 1 ? 's' : ''} selected
                            </p>
                        )}
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
