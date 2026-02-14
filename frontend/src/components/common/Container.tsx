import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ContainerProps {
    children: React.ReactNode;
    className?: string;
    fluid?: boolean;
}

export const Container: React.FC<ContainerProps> = ({ children, className, fluid = false }) => {
    return (
        <div className={cn(
            "mx-auto px-4 sm:px-6 lg:px-8",
            fluid ? "w-full" : "max-w-7xl",
            className
        )}>
            {children}
        </div>
    );
};
