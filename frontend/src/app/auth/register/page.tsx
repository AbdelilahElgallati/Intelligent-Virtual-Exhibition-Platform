"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Container } from '@/components/common/Container';

const ORG_TYPES = ['company', 'ngo', 'university', 'government', 'startup', 'association', 'other'];

export default function RegisterPage() {
    const { t } = useTranslation();
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
            return t('auth.register.error.emailExists');
        if (detail.includes('valid email'))
            return t('auth.register.error.invalidEmail');
        if (detail.includes('Company name'))
            return t('auth.register.error.companyNameRequired');
        if (detail.includes('Registration failed'))
            return t('auth.register.error.registrationFailed');

        return t('auth.register.error.generic');
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setError(null);
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.username || !formData.email || !formData.password) {
            setError(t('auth.register.error.allFields'));
            return;
        }
        if (formData.password.length < 8) {
            setError(t('auth.register.error.passwordMinLength'));
            return;
        }
        if (formData.password !== formData.confirm_password) {
            setError(t('auth.register.error.passwordMismatch'));
            return;
        }
        if (formData.role === 'enterprise' && !formData.company_name) {
            setError(t('auth.register.error.companyNameRequired'));
            return;
        }
        if (formData.role === 'organizer' && !formData.org_name) {
            setError(t('auth.register.error.orgNameRequired'));
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
                        <CardTitle className="text-3xl font-bold text-indigo-600">
                            {t('auth.register.title')}
                        </CardTitle>
                        <p className="text-zinc-500 mt-2">
                            {t('auth.register.subtitle')}
                        </p>
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
                                            {t('auth.register.success.title')} {t('auth.register.success.message')}
                                        </span>
                                    </div>
                                    <Link href="/auth/login" className="w-full">
                                        <Button type="button" variant="primary" className="w-full">
                                            {t('auth.register.success.goToLogin')}
                                        </Button>
                                    </Link>
                                </div>
                            )}

                            {!registrationSuccess && (
                                <>
                                    <Input label={t('auth.register.fullName.label')} name="full_name" placeholder={t('auth.register.fullName.placeholder')}
                                        value={formData.full_name} onChange={handleChange} />

                                    <Input label={t('auth.register.username.label')} name="username" placeholder={t('auth.register.username.placeholder')}
                                        value={formData.username} onChange={handleChange} required />

                                    <Input label={t('auth.register.email.label')} name="email" type="email" placeholder={t('auth.register.email.placeholder')}
                                        value={formData.email} onChange={handleChange} required />

                                    {/* Role selector */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700">{t('auth.register.roleLabel')}</label>
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
                                                    {t(`auth.register.roles.${r}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── ORGANIZER FIELDS ─────────────────────── */}
                                    {isOrganizer && (
                                        <div className="space-y-4 p-4 bg-amber-50/60 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                                                {t('auth.register.organizer.title')}
                                            </p>
                                            <p className="text-xs text-amber-600">
                                                {t('auth.register.organizer.approvalNote')}
                                            </p>

                                            <Input label={t('auth.register.organizer.orgName.label')} name="org_name"
                                                placeholder={t('auth.register.organizer.orgName.placeholder')} onChange={handleChange} required />

                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-zinc-700">
                                                    {t('auth.register.organizer.orgType.label')}
                                                </label>
                                                <select name="org_type" onChange={handleChange}
                                                    className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                                    <option value="">{t('auth.register.organizer.orgType.placeholder')}</option>
                                                    {ORG_TYPES.map(typeKey => (
                                                        <option key={typeKey} value={t(`auth.register.organizer.orgTypes.${typeKey}`)}>
                                                            {t(`auth.register.organizer.orgTypes.${typeKey}`)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <Input label={t('auth.register.organizer.professionalEmail.label')} name="org_professional_email"
                                                type="email" placeholder={t('auth.register.organizer.professionalEmail.placeholder')}
                                                onChange={handleChange} required />

                                            <div className="grid grid-cols-2 gap-4">
                                                <Input label={t('auth.register.organizer.country.label')} name="org_country" placeholder={t('auth.register.organizer.country.placeholder')}
                                                    onChange={handleChange} required />
                                                <Input label={t('auth.register.organizer.city.label')} name="org_city" placeholder={t('auth.register.organizer.city.placeholder')}
                                                    onChange={handleChange} required />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <Input label={t('auth.register.organizer.phone.label')} name="org_phone" placeholder={t('auth.register.organizer.phone.placeholder')}
                                                    onChange={handleChange} />
                                                <Input label={t('auth.register.organizer.website.label')} name="org_website" placeholder={t('auth.register.organizer.website.placeholder')}
                                                    onChange={handleChange} />
                                            </div>
                                        </div>
                                    )}

                                    {/* ── ENTERPRISE FIELDS ────────────────────── */}
                                    {isEnterprise && (
                                        <div className="space-y-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                                                {t('auth.register.enterprise.title')}
                                            </p>
                                            <p className="text-xs text-indigo-600">
                                                {t('auth.register.enterprise.approvalNote')}
                                            </p>

                                            <Input label={t('auth.register.enterprise.companyName.label')} name="company_name"
                                                placeholder={t('auth.register.enterprise.companyName.placeholder')} onChange={handleChange} required />

                                            <Input label={t('auth.register.enterprise.professionalEmail.label')} name="professional_email"
                                                type="email" placeholder={t('auth.register.enterprise.professionalEmail.placeholder')}
                                                onChange={handleChange} required />

                                            <div className="grid grid-cols-2 gap-4">
                                                <Input label={t('auth.register.enterprise.industry.label')} name="industry" placeholder={t('auth.register.enterprise.industry.placeholder')}
                                                    onChange={handleChange} required />
                                                <Input label={t('auth.register.enterprise.country.label')} name="country" placeholder={t('auth.register.enterprise.country.placeholder')}
                                                    onChange={handleChange} required />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <Input label={t('auth.register.enterprise.city.label')} name="city" placeholder={t('auth.register.enterprise.city.placeholder')}
                                                    onChange={handleChange} required />
                                                <Input label={t('auth.register.enterprise.companySize.label')} name="company_size" placeholder={t('auth.register.enterprise.companySize.placeholder')}
                                                    onChange={handleChange} required />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-zinc-700">
                                            {t('auth.register.password.label')}
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
                                                placeholder={t('auth.register.password.placeholder')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(prev => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                                aria-label={showPassword ? t('auth.register.hidePassword') : t('auth.register.showPassword')}
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

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-zinc-700">
                                            {t('auth.register.confirmPassword.label')}
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
                                                placeholder={t('auth.register.confirmPassword.placeholder')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(prev => !prev)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                                                aria-label={showConfirmPassword ? t('auth.register.hidePassword') : t('auth.register.showPassword')}
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
                                        {isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
                                    </Button>

                                    {(isOrganizer || isEnterprise) && (
                                        <p className="text-xs text-center text-amber-600">
                                            ⏳ {t('auth.register.approvalNotice', { role: isOrganizer ? t('auth.register.roles.organizer') : t('auth.register.roles.enterprise') })}
                                        </p>
                                    )}

                                    <div className="text-center text-sm text-zinc-600">
                                        {t('auth.register.hasAccount')}{' '}
                                        <Link href="/auth/login" className="text-indigo-600 font-semibold hover:underline">
                                            {t('auth.register.signInLink')}
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
