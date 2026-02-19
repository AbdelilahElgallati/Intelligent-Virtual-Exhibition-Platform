"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Container } from '@/components/common/Container';

export default function RegisterPage() {
    const { register, isLoading } = useAuth();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'visitor'
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.username || !formData.email || !formData.password) {
            setError('Please fill in all required fields.');
            return;
        }

        try {
            await register(formData);
        } catch (err: any) {
            setError(err.message || 'Registration failed. Try a different username or email.');
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
                        <CardTitle className="text-3xl font-bold text-indigo-600">Register</CardTitle>
                        <p className="text-zinc-500 mt-2">Join the IVEP platform</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Full Name"
                                name="full_name"
                                placeholder="John Doe"
                                value={formData.full_name}
                                onChange={handleChange}
                            />

                            <Input
                                label="Username *"
                                name="username"
                                placeholder="johndoe"
                                value={formData.username}
                                onChange={handleChange}
                                required
                            />

                            <Input
                                label="Email *"
                                name="email"
                                type="email"
                                placeholder="john@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700">I am a:</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, role: 'visitor' }))}
                                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${formData.role === 'visitor'
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                                            }`}
                                    >
                                        Visitor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, role: 'organizer' }))}
                                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${formData.role === 'organizer'
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                                            }`}
                                    >
                                        Organizer
                                    </button>
                                </div>
                            </div>

                            <Input
                                label="Password *"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />

                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Create Account
                            </Button>

                            <div className="text-center text-sm text-zinc-600">
                                Already have an account?{' '}
                                <Link href="/auth/login" className="text-indigo-600 font-semibold hover:underline">
                                    Sign In
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </Container>
        </div>
    );
}
