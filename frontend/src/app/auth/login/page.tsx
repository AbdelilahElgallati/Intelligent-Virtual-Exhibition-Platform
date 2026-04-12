"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Container } from '@/components/common/Container';

export default function LoginPage() {
    const { login, isLoading } = useAuth();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    function getLoginErrorMessage(err: any): string {
        const detail = err.message || '';

        if (detail.includes('Incorrect password'))
            return 'The password you entered is incorrect. Please try again.';
        if (detail.includes('No account found'))
            return 'No account found with this email address.';
        if (detail.includes('pending admin approval'))
            return 'Your account is pending admin approval. You will be notified by email once it is activated.';
        if (detail.includes('rejected'))
            return 'Your account registration was rejected. Please contact support.';
        if (detail.includes('suspended'))
            return 'Your account has been suspended. Please contact support for assistance.';
        if (detail.includes('not active'))
            return 'Your account is not active. Please contact support.';
        if (detail.includes('Unauthorized'))
            return 'Invalid email or password. Please check your credentials and try again.';

        return 'Something went wrong. Please try again.';
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.email || !formData.password) {
            setError('Please fill in all fields.');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address.');
            return;
        }

        try {
            await login(formData);
        } catch (err: any) {
            setError(getLoginErrorMessage(err));
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 bg-zinc-50">
            <Container className="max-w-md">
                <Card className="shadow-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-3xl font-bold text-indigo-600">Login</CardTitle>
                        <p className="text-zinc-500 mt-2">Welcome back to IVEP</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            {error && (
                                <div className="flex items-start gap-3 rounded-lg border border-red-200
                                                bg-red-50 px-4 py-3 text-sm text-red-700">
                                    <span className="mt-0.5 shrink-0">⚠️</span>
                                    <span>{error}</span>
                                </div>
                            )}

                            <Input
                                label="Email"
                                name="email"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-zinc-700">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(prev => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                                isLoading={isLoading}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </Button>

                            <div className="text-center text-sm text-zinc-600">
                                Don't have an account?{' '}
                                <Link href="/auth/register" className="text-indigo-600 font-semibold hover:underline">
                                    Register here
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </Container>
        </div>
    );
}
