import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SectionTitleProps {
    title: string;
    subtitle?: string;
    className?: string;
    align?: 'left' | 'center' | 'right';
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
    title,
    subtitle,
    className,
    align = 'center',
}) => {
    const alignments = {
        left: 'text-left items-start',
        center: 'text-center items-center',
        right: 'text-right items-end',
    };

    return (
        <div className={cn("flex flex-col gap-2 mb-10", alignments[align], className)}>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                {title}
            </h2>
            {subtitle && (
                <p className="max-w-2xl text-lg text-zinc-600">
                    {subtitle}
                </p>
            )}
        </div>
    );
};
