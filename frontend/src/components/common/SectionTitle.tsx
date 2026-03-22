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
        <div className={cn("flex flex-col gap-2 md:gap-3 mb-8 sm:mb-10 w-full", alignments[align], className)}>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl lg:text-4xl">
                {title}
            </h2>
            {subtitle && (
                <p className="max-w-2xl text-sm sm:text-base text-zinc-600">
                    {subtitle}
                </p>
            )}
        </div>
    );
};
