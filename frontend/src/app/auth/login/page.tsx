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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.email || !formData.password) {
            setError('Please fill in all fields.');
            return;
        }

        try {
            await login(formData);
        } catch (err: any) {
            setError(err.message || 'Login failed. Please check your credentials.');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Email"
                                name="email" // Changed from username
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />

                            <Input
                                label="Password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />

                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Sign In
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
