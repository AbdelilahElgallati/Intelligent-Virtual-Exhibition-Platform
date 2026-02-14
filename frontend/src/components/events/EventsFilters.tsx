"use client";

import React from 'react';
import { Input as CustomInput } from '@/components/ui/Input';

interface EventsFiltersProps {
    onSearchChange: (value: string) => void;
    onCategoryChange: (value: string) => void;
}

export const EventsFilters: React.FC<EventsFiltersProps> = ({
    onSearchChange,
    onCategoryChange,
}) => {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
            <div className="w-full md:max-w-md">
                <CustomInput
                    placeholder="Search events by title or description..."
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <div className="flex items-center gap-4">
                <div className="min-w-[200px]">
                    <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">
                        Category
                    </label>
                    <select
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onChange={(e) => onCategoryChange(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="technology">Technology</option>
                        <option value="business">Business</option>
                        <option value="education">Education</option>
                        <option value="art">Art & Culture</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
