import React from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
    variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
    isLoading,
    variant = 'primary'
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-600">{message}</p>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        onClick={onConfirm}
                        isLoading={isLoading}
                        className={variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
