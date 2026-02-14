import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick }) => {
    return (
        <div
            className={cn(
                "rounded-xl border border-zinc-200 bg-white text-zinc-950 shadow-sm transition-all overflow-hidden",
                onClick && "cursor-pointer hover:shadow-md hover:border-zinc-300",
                className
            )}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export const CardHeader: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)}>{children}</h3>
);

export const CardContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <div className={cn("p-6 pt-0", className)}>{children}</div>
);

export const CardFooter: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
    <div className={cn("flex items-center p-6 pt-0", className)}>{children}</div>
);
