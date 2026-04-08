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
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    function getRegisterErrorMessage(err: any): string {
        const detail = err.message || '';
        
        if (detail.includes('already exists'))
            return 'An account with this email already exists. Try logging in instead.';
        if (detail.includes('valid email'))
            return 'Please enter a valid email address.';
        
        return 'Registration failed. Please check your information and try again.';
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setError(null);
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.username || !formData.email || !formData.password) {
            setError('Please fill in all required fields.');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (formData.password !== formData.confirm_password) {
            setError('Passwords do not match. Please check and try again.');
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
                setRegistrationSuccess(true);
            }
        } catch (err: any) {
            setError(getRegisterErrorMessage(err));
        }
    };

    const isOrganizer = formData.role === 'organizer';
    const isEnterprise = formData.role === 'enterprise';

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
                                <div className="flex items-start gap-3 rounded-lg border border-red-200
                                                bg-red-50 px-4 py-3 text-sm text-red-700">
                                    <span className="mt-0.5 shrink-0">⚠️</span>
                                    <span>{error}</span>
                                </div>
                            )}

                            {registrationSuccess && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start gap-3 rounded-lg border border-green-200
                                                    bg-green-50 px-4 py-3 text-sm text-green-700">
                                        <span className="mt-0.5 shrink-0">✅</span>
                                        <span>
                                            Registration successful! Your account is pending admin approval.
                                            You will receive an email notification once it is activated.
                                        </span>
                                    </div>
                                    <Link href="/auth/login" className="w-full">
                                        <Button type="button" variant="primary" className="w-full">
                                            Go to Login
                                        </Button>
                                    </Link>
                                </div>
                            )}

                            {!registrationSuccess && (
                                <>
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
                                                    onClick={() => {
                                                        setError(null);
                                                        setFormData(p => ({ ...p, role: r }));
                                                    }}
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

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-zinc-700">
                                            Password *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                required
                                                autoComplete="new-password"
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
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-zinc-700">
                                            Confirm password *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                name="confirm_password"
                                                value={formData.confirm_password}
                                                onChange={handleChange}
                                                required
                                                autoComplete="new-password"
                                                className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-all pr-10"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(prev => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showConfirmPassword ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                                        {isLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Creating account...
                                            </span>
                                        ) : 'Create Account'}
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
                                </>
                            )}
                        </form>
                    </CardContent>
                </Card>
            </Container>
        </div>
    );
}
