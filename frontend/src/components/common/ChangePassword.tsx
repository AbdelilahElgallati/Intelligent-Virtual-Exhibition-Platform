'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import { Lock, CheckCircle2, X } from 'lucide-react';

interface ChangePasswordProps {
    onSuccess?: () => void;
}

export default function ChangePassword({ onSuccess }: ChangePasswordProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [form, setForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        if (form.new_password !== form.confirm_password) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            setIsLoading(false);
            return;
        }

        if (form.new_password.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters.' });
            setIsLoading(false);
            return;
        }

        try {
            await http.patch('/users/change-password', {
                current_password: form.current_password,
                new_password: form.new_password,
            });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setForm({ current_password: '', new_password: '', confirm_password: '' });
            onSuccess?.();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to change password.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        setForm({ current_password: '', new_password: '', confirm_password: '' });
        setMessage(null);
    };

    if (!isOpen) {
        return (
            <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-zinc-200 bg-white gap-2 text-zinc-600 hover:bg-zinc-50"
                onClick={() => setIsOpen(true)}
            >
                <Lock size={16} /> Change Password
            </Button>
        );
    }

    return (
        <div className="space-y-3">
            <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-zinc-200 bg-white gap-2 text-zinc-600 hover:bg-zinc-50"
                onClick={handleClose}
            >
                <Lock size={16} /> Hide Change Password
            </Button>

            <Card className="border-zinc-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-5 px-8">
                    <CardTitle className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                        <Lock size={18} className="text-indigo-500" /> Change Password
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    {message && (
                        <div className={`flex items-center gap-3 p-4 mb-5 rounded-2xl border text-sm animate-in fade-in slide-in-from-top-2 ${message.type === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-red-50 text-red-700 border-red-100'
                            }`}>
                            {message.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700">Current Password</label>
                            <Input
                                type="password"
                                value={form.current_password}
                                onChange={(e) => setForm(prev => ({ ...prev, current_password: e.target.value }))}
                                placeholder="Enter your current password"
                                className="h-11 rounded-xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700">New Password</label>
                            <Input
                                type="password"
                                value={form.new_password}
                                onChange={(e) => setForm(prev => ({ ...prev, new_password: e.target.value }))}
                                placeholder="Enter new password (min 6 characters)"
                                className="h-11 rounded-xl"
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-zinc-700">Confirm New Password</label>
                            <Input
                                type="password"
                                value={form.confirm_password}
                                onChange={(e) => setForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                                placeholder="Confirm your new password"
                                className="h-11 rounded-xl"
                                required
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-11 rounded-xl"
                                onClick={handleClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold"
                                isLoading={isLoading}
                            >
                                Update Password
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
