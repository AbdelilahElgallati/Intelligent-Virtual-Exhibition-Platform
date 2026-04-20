'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import {
    User, Building, Mail, Shield, UserCircle,
    Globe, FileText, CheckCircle2, X, Save,
    Settings, Bell
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ChangePassword from '@/components/common/ChangePassword';
import { useTranslation } from 'react-i18next';

const FALLBACK_TIMEZONES = [
    'UTC',
    'Africa/Casablanca',
    'Europe/Paris',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Asia/Tokyo',
];

const TIMEZONE_OPTIONS =
    typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
        ? (Intl.supportedValuesOf('timeZone') as string[])
        : FALLBACK_TIMEZONES;

export default function OrganizerProfile() {
    const { t } = useTranslation();
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [form, setForm] = useState({
        full_name: '',
        bio: '',
        language: '',
        timezone: 'UTC',
        interests: [] as string[]
    });

    useEffect(() => {
        if (user) {
            setForm({
                full_name: user.full_name || '',
                bio: user.bio || '',
                language: user.language || 'English',
                timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                interests: user.interests || []
            });
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            await http.put('/users/me', form);
            // Ensure the selected timezone is available immediately in localStorage,
            // so schedule components can re-render using the correct viewer timezone.
            try {
                if (typeof window !== 'undefined') {
                    const raw = localStorage.getItem('auth_user');
                    const parsed = raw ? (JSON.parse(raw) as any) : {};
                    localStorage.setItem(
                        'auth_user',
                        JSON.stringify({ ...parsed, timezone: form.timezone })
                    );
                }
            } catch {
                // Best-effort only.
            }
            await refreshUser?.();
            // `refreshUser()` may overwrite `auth_user` with the backend response (which can lag).
            // Re-apply the selected timezone to guarantee schedule rendering matches the profile selection.
            try {
                if (typeof window !== 'undefined') {
                    const raw = localStorage.getItem('auth_user');
                    const parsed = raw ? (JSON.parse(raw) as any) : {};
                    localStorage.setItem('auth_user', JSON.stringify({ ...parsed, timezone: form.timezone }));
                }
            } catch {
                // Best-effort only.
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('ivep:auth-user-updated'));
            }
            setMessage({ type: 'success', text: t('organizer.profile.messages.updateSuccess') });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || t('organizer.profile.messages.updateFailed') });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">{t('organizer.profile.title')}</h1>
                    <p className="text-zinc-500 mt-1">{t('organizer.profile.subtitle')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Edit Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {message && (
                            <div className={`flex items-center gap-3 p-4 rounded-2xl border text-sm animate-in fade-in slide-in-from-top-2 ${message.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-red-50 text-red-700 border-red-100'
                                }`}>
                                {message.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                                {message.text}
                            </div>
                        )}

                        <Card className="border-zinc-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-5 px-8">
                                <CardTitle className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                                    <UserCircle size={18} className="text-indigo-500" /> {t('organizer.profile.sections.basicInfo')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">{t('organizer.profile.fullName.label')}</label>
                                    <Input
                                        name="full_name"
                                        value={form.full_name}
                                        onChange={handleChange}
                                        placeholder={t('organizer.profile.fullName.placeholder')}
                                        className="h-11 rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">{t('organizer.profile.email.label')}</label>
                                    <div className="flex items-center gap-3 h-11 px-4 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-500 text-sm">
                                        <Mail size={16} className="text-zinc-400" />
                                        {user?.email}
                                    </div>
                                    <p className="text-[10px] text-zinc-400 italic px-1">{t('organizer.profile.email.hint')}</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">{t('organizer.profile.bio.label')}</label>
                                    <textarea
                                        name="bio"
                                        value={form.bio}
                                        onChange={handleChange}
                                        className="w-full min-h-[100px] p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none shadow-inner"
                                        placeholder={t('organizer.profile.bio.placeholder')}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Globe size={14} className="text-indigo-500" /> {t('organizer.profile.language.label')}
                                        </label>
                                        <select
                                            name="language"
                                            value={form.language}
                                            onChange={(e) => setForm(prev => ({ ...prev, language: e.target.value }))}
                                            className="w-full h-11 px-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                        >
                                            <option>{t('organizer.profile.languages.english')}</option>
                                            <option>{t('organizer.profile.languages.spanish')}</option>
                                            <option>{t('organizer.profile.languages.french')}</option>
                                            <option>{t('organizer.profile.languages.arabic')}</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Globe size={14} className="text-indigo-500" /> {t('organizer.profile.timezone.label')}
                                        </label>
                                        <select
                                            name="timezone"
                                            value={form.timezone}
                                            onChange={(e) => setForm(prev => ({ ...prev, timezone: e.target.value }))}
                                            className="w-full h-11 px-4 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                        >
                                            {TIMEZONE_OPTIONS.map((tz) => (
                                                <option key={tz} value={tz}>{tz}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end">
                            <Button type="submit" className="min-w-[180px] h-12 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center gap-2" isLoading={isLoading}>
                                <Save size={18} /> {t('organizer.profile.actions.update')}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <Card className="border-zinc-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 py-4 px-6 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl mx-auto shadow-xl flex items-center justify-center text-white text-3xl font-bold border-4 border-white mb-2">
                                {user?.full_name?.charAt(0) || 'O'}
                            </div>
                            <CardTitle className="text-sm font-bold text-zinc-900 mt-2">{user?.full_name}</CardTitle>
                            <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-widest">{user?.role}</p>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-3 text-sm text-zinc-600">
                                <Shield size={16} className="text-indigo-500" />
                                <span className="font-medium">{t('organizer.profile.accountVerified')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-600">
                                <Building size={16} className="text-indigo-500" />
                                <span className="font-medium">{user?.org_name || t('organizer.profile.fallbackOrgName')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-600">
                                <FileText size={16} className="text-indigo-500" />
                                <span className="font-medium">{t('organizer.profile.joined', { year: user?.created_at ? new Date(user.created_at).getFullYear() : '2024' })}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-3">
                        <ChangePassword />
                        <Button
                            variant="outline"
                            className="w-full h-11 rounded-xl border-zinc-200 bg-white gap-2 text-zinc-600 hover:bg-zinc-50"
                            onClick={() => router.push('/organizer/notifications')}
                        >
                            <Bell size={16} /> {t('organizer.notifications.title')}
                        </Button>
                    </div>

                    <Card className="p-5 bg-indigo-50/50 border-indigo-100/50">
                        <div className="flex items-start gap-3">
                            <Settings size={20} className="text-indigo-500 mt-1" />
                            <div>
                                <h4 className="text-sm font-bold text-indigo-900">{t('organizer.profile.help.title')}</h4>
                                <p className="text-xs text-indigo-700/70 mt-1 leading-relaxed">
                                    {t('organizer.profile.help.description')}
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
