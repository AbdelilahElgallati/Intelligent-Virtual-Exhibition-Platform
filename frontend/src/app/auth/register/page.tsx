"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Container } from '@/components/common/Container';

const ORG_TYPES = ['Company', 'NGO', 'University', 'Government', 'Startup', 'Association', 'Other'];

export default function RegisterPage() {
    const { register, isLoading } = useAuth();
    const [formData, setFormData] = useState<Record<string, string>>({
        username: '',
        email: '',
        password: '',
        confirm_password: '',
        full_name: '',
        role: 'visitor',
    });
    const [error, setError] = useState<string | null>(null);
    const [pendingApproval, setPendingApproval] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.username || !formData.email || !formData.password) {
            setError('Please fill in all required fields.');
            return;
        }
        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match.');
            return;
        }
        if (formData.role === 'enterprise' && !formData.company_name) {
            setError('Company name is required for enterprise accounts.');
            return;
        }
        if (formData.role === 'organizer' && !formData.org_name) {
            setError('Organisation name is required for organizer accounts.');
            return;
        }

        try {
            const payload = { ...formData };
            delete payload.confirm_password;
            const result = await register(payload);
            if (result.pendingApproval) {
                setPendingApproval(true);
            }
        } catch (err: any) {
            setError(err.message || 'Registration failed. Try a different username or email.');
        }
    };

    const isOrganizer = formData.role === 'organizer';
    const isEnterprise = formData.role === 'enterprise';

    // ── Pending approval success screen ──────────────────────────────
    if (pendingApproval) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center py-12 bg-zinc-50">
                <Container className="max-w-lg">
                    <Card className="shadow-lg">
                        <CardContent className="p-8 text-center space-y-6">
                            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                                <span className="text-3xl">⏳</span>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-zinc-900">Account Under Review</h2>
                                <p className="text-zinc-600 leading-relaxed">
                                    Your registration has been submitted successfully! An administrator will review
                                    your information. Once your account is approved, you will be able to log in and
                                    access the platform.
                                </p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 text-left space-y-1">
                                <p className="font-semibold">What happens next?</p>
                                <ul className="list-disc list-inside space-y-0.5 text-amber-600">
                                    <li>An admin will review your profile and organisation details</li>
                                    <li>You will be notified once your account is approved</li>
                                    <li>After approval, use the login page to access your dashboard</li>
                                </ul>
                            </div>
                            <Link href="/auth/login">
                                <Button variant="primary" className="w-full mt-2">
                                    Go to Login
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </Container>
            </div>
        );
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center py-12 bg-zinc-50">
            <Container className="max-w-lg">
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

                            <Input label="Full Name" name="full_name" placeholder="John Doe"
                                value={formData.full_name} onChange={handleChange} />

                            <Input label="Username *" name="username" placeholder="johndoe"
                                value={formData.username} onChange={handleChange} required />

                            <Input label="Email *" name="email" type="email" placeholder="john@example.com"
                                value={formData.email} onChange={handleChange} required />

                            {/* Role selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-700">I am a:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['visitor', 'organizer', 'enterprise'] as const).map((r) => (
                                        <button key={r} type="button"
                                            onClick={() => setFormData(p => ({ ...p, role: r }))}
                                            className={`py-2 px-2 rounded-lg border text-xs font-medium capitalize transition-all ${formData.role === r
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'
                                                }`}>
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── ORGANIZER FIELDS ─────────────────────── */}
                            {isOrganizer && (
                                <div className="space-y-4 p-4 bg-amber-50/60 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Organisation Details</p>
                                    <p className="text-xs text-amber-600">Your account will be reviewed by an admin before activation.</p>

                                    <Input label="Organisation Name *" name="org_name"
                                        placeholder="Event Masters Inc." onChange={handleChange} required />

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-zinc-700">Organisation Type *</label>
                                        <select name="org_type" onChange={handleChange}
                                            className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                            <option value="">Select type…</option>
                                            {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>

                                    <Input label="Professional Email *" name="org_professional_email"
                                        type="email" placeholder="contact@eventmasters.com"
                                        onChange={handleChange} required />

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Country *" name="org_country" placeholder="France"
                                            onChange={handleChange} required />
                                        <Input label="City *" name="org_city" placeholder="Paris"
                                            onChange={handleChange} required />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Phone" name="org_phone" placeholder="+33 6 12 34 56 78"
                                            onChange={handleChange} />
                                        <Input label="Website" name="org_website" placeholder="https://eventmasters.com"
                                            onChange={handleChange} />
                                    </div>
                                </div>
                            )}

                            {/* ── ENTERPRISE FIELDS ────────────────────── */}
                            {isEnterprise && (
                                <div className="space-y-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Company Details</p>
                                    <p className="text-xs text-indigo-600">Your account will be reviewed by an admin before activation.</p>

                                    <Input label="Company Name *" name="company_name"
                                        placeholder="Acme Corp" onChange={handleChange} required />

                                    <Input label="Professional Email *" name="professional_email"
                                        type="email" placeholder="contact@acme.com"
                                        onChange={handleChange} required />

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="Industry *" name="industry" placeholder="Tech"
                                            onChange={handleChange} required />
                                        <Input label="Country *" name="country" placeholder="France"
                                            onChange={handleChange} required />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input label="City *" name="city" placeholder="Paris"
                                            onChange={handleChange} required />
                                        <Input label="Company Size *" name="company_size" placeholder="10-50"
                                            onChange={handleChange} required />
                                    </div>
                                </div>
                            )}

                            <Input label="Password *" name="password" type="password"
                                placeholder="••••••••" value={formData.password}
                                onChange={handleChange} required autoComplete="new-password" />

                            <Input label="Confirm password *" name="confirm_password" type="password"
                                placeholder="••••••••" value={formData.confirm_password}
                                onChange={handleChange} required autoComplete="new-password" />

                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Create Account
                            </Button>

                            {(isOrganizer || isEnterprise) && (
                                <p className="text-xs text-center text-amber-600">
                                    ⏳ {isOrganizer ? 'Organizer' : 'Enterprise'} accounts require admin approval before you can log in.
                                </p>
                            )}

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
