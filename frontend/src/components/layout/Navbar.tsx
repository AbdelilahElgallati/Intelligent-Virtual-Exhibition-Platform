"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/common/Container';

export const Navbar: React.FC = () => {
    const { isAuthenticated, user, logout } = useAuth();

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
            <Container>
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-xl font-bold tracking-tight text-indigo-600">IVEP</span>
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-indigo-600 transition-colors">
                                Home
                            </Link>
                            <Link href="/events" className="text-sm font-medium text-zinc-600 hover:text-indigo-600 transition-colors">
                                Events
                            </Link>
                            {isAuthenticated && (
                                <Link href="/dashboard" className="text-sm font-medium hover:text-indigo-600">
                                    Dashboard
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-zinc-600 hidden sm:inline-block">
                                    Hi, <span className="font-semibold text-zinc-900">{user?.full_name || user?.username}</span>
                                </span>
                                <Button variant="outline" size="sm" onClick={logout}>
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link href="/auth/login">
                                    <Button variant="ghost" size="sm">Login</Button>
                                </Link>
                                <Link href="/auth/register">
                                    <Button size="sm">Register</Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </Container>
        </nav>
    );
};
