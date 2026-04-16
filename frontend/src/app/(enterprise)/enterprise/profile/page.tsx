"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import { resolveMediaUrl } from '@/lib/media';
import { useAuth } from '@/context/AuthContext';
import {
    Mail, User, Shield, Building2, MapPin, Globe,
    Linkedin, Save, CheckCircle2, Phone,
    Upload, X, Camera, Briefcase
} from 'lucide-react';
import ChangePassword from '@/components/common/ChangePassword';
import { t } from 'i18next';
const ENTERPRISE_CATEGORY_OPTIONS = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Logistics',
    'Energy',
    'Telecommunications',
    'Consulting',
    'Media & Marketing',
    'Tourism & Hospitality',
    'Government & Public Services',
    'Non-Profit',
    'Other',
];
const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
    Technology: 'enterprise.profile.categories.technology',
    Healthcare: 'enterprise.profile.categories.healthcare',
    Finance: 'enterprise.profile.categories.finance',
    Education: 'enterprise.profile.categories.education',
    Manufacturing: 'enterprise.profile.categories.manufacturing',
    Retail: 'enterprise.profile.categories.retail',
    Logistics: 'enterprise.profile.categories.logistics',
    Energy: 'enterprise.profile.categories.energy',
    Telecommunications: 'enterprise.profile.categories.telecommunications',
    Consulting: 'enterprise.profile.categories.consulting',
    'Media & Marketing': 'enterprise.profile.categories.mediaMarketing',
    'Tourism & Hospitality': 'enterprise.profile.categories.tourismHospitality',
    'Government & Public Services': 'enterprise.profile.categories.governmentPublicServices',
    'Non-Profit': 'enterprise.profile.categories.nonProfit',
    Other: 'enterprise.profile.categories.other',
};

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-4 py-3 border-b border-zinc-50 last:border-0">
            <div className="w-9 h-9 bg-zinc-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-indigo-500" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-medium text-zinc-900 truncate">{value}</p>
            </div>
        </div>
    );
}

export default function EnterpriseProfilePage() {
    const { t: tEnterprise } = useTranslation('enterprise');
    const { t: tCommon } = useTranslation('common');
    const { user, refreshUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [tagsInput, setTagsInput] = useState('');
    const [accountTimezone, setAccountTimezone] = useState('UTC');

    const timezoneOptions =
        typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
            ? (Intl.supportedValuesOf('timeZone') as string[])
            : ['UTC', 'Africa/Casablanca', 'Europe/Paris', 'Europe/London', 'America/New_York'];

    const [profile, setProfile] = useState({
        name: '',
        description: '',
        category: '',
        industry: '',
        country: '',
        city: '',
        company_size: '',
        professional_email: '',
        website: '',
        linkedin: '',
        theme_color: '#4f46e5',
        branding_theme: 'Modern',
        contact_email: '',
        contact_phone: '',
        avatar_gender: 'male',
        tags: [] as string[],
        logo_url: '',
        banner_url: ''
    });

    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const normalizeTags = (value: unknown): string[] => {
        const source = Array.isArray(value)
            ? value.map((v) => String(v))
            : typeof value === 'string'
                ? value.split(/[;,]/g)
                : [];
        const seen = new Set<string>();
        const normalized: string[] = [];
        for (const raw of source) {
            const tag = raw.trim();
            if (!tag) continue;
            const key = tag.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            normalized.push(tag);
        }
        return normalized;
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const myOrg = await http.get<any>('/enterprise/profile');

                if (myOrg) {
                    const normalizedTags = normalizeTags(myOrg.tags);
                    setProfile({
                        name: myOrg.name || '',
                        description: myOrg.description || '',
                        category: myOrg.category || '',
                        industry: myOrg.industry || '',
                        country: myOrg.country || '',
                        city: myOrg.city || '',
                        company_size: myOrg.company_size || '',
                        professional_email: myOrg.professional_email || '',
                        website: myOrg.website || '',
                        linkedin: myOrg.linkedin || '',
                        theme_color: myOrg.theme_color || '#4f46e5',
                        branding_theme: myOrg.branding_theme || 'Modern',
                        contact_email: myOrg.contact_email || '',
                        contact_phone: myOrg.contact_phone || '',
                        avatar_gender: myOrg.avatar_gender || 'male',
                        tags: normalizedTags,
                        logo_url: myOrg.logo_url || '',
                        banner_url: myOrg.banner_url || ''
                    });
                    setTagsInput(normalizedTags.join(', '));
                }
            } catch (err) {
                console.error("Failed to fetch organization details", err);
            }
        };
        if (user) fetchProfile();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        setAccountTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setTagsInput(raw);
        setProfile(prev => ({ ...prev, tags: normalizeTags(raw) }));
    };

    const handleFileUpload = async (type: 'logo' | 'banner', file: File) => {
        setIsUploading(prev => ({ ...prev, [type]: true }));
        const formData = new FormData();
        formData.append('file', file);

        try {
            const data = await http.post<any>(`/enterprise/profile/${type}`, formData);
            const url = type === 'logo' ? data.logo_url : data.banner_url;

            setProfile(prev => ({ ...prev, [`${type}_url`]: url }));
            setMessage({ type: 'success', text: tEnterprise(type === 'logo' ? 'enterprise.profile.messages.logoUploaded' : 'enterprise.profile.messages.bannerUploaded') });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || tEnterprise('enterprise.profile.messages.uploadFailed') });
        } finally {
            setIsUploading(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const normalizedTags = normalizeTags(tagsInput);
            await http.patch('/enterprise/profile', {
                ...profile,
                tags: normalizedTags,
            });
            await http.put('/users/me', { timezone: accountTimezone });
            // Ensure the selected timezone is available immediately in localStorage
            // so live schedule pages use the correct viewer timezone without reload.
            try {
                if (typeof window !== 'undefined') {
                    const raw = localStorage.getItem('auth_user');
                    const parsed = raw ? (JSON.parse(raw) as any) : {};
                    localStorage.setItem(
                        'auth_user',
                        JSON.stringify({ ...parsed, timezone: accountTimezone })
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
                    localStorage.setItem('auth_user', JSON.stringify({ ...parsed, timezone: accountTimezone }));
                }
            } catch {
                // Best-effort only.
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('ivep:auth-user-updated'));
            }
            setProfile(prev => ({ ...prev, tags: normalizedTags }));
            setTagsInput(normalizedTags.join(', '));
            setMessage({ type: 'success', text: tEnterprise('enterprise.profile.messages.profileUpdated') });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || tEnterprise('enterprise.profile.messages.profileUpdateFailed') });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Hero Header with Banner */}
            <div className="relative group rounded-[2.5rem] overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm h-48 sm:h-72">
                {profile.banner_url ? (
                    <img
                        src={resolveMediaUrl(profile.banner_url)}
                        alt="Banner"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 opacity-90 animate-gradient-xy" />
                )}

                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <Button
                        onClick={() => bannerInputRef.current?.click()}
                        className="bg-white/90 text-indigo-600 hover:bg-white border-none gap-2 shadow-2xl scale-95 group-hover:scale-100 transition-all font-bold"
                        isLoading={isUploading.banner}
                    >
                        <Camera size={18} /> {tEnterprise('enterprise.profile.updateCoverPhoto')}
                    </Button>
                    <input
                        ref={bannerInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('banner', e.target.files[0])}
                    />
                </div>

                {/* Logo Overlay */}
                <div className="absolute -bottom-12 left-8 sm:left-12">
                    <div className="relative group/logo">
                        <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-[2rem] bg-white p-1.5 shadow-2xl border border-white/80 backdrop-blur-md">
                            <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-white flex items-center justify-center relative shadow-inner">
                                {profile.logo_url ? (
                                    <img
                                        src={resolveMediaUrl(profile.logo_url)}
                                        alt={tEnterprise('enterprise.profile.logoAlt')}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/logo:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-indigo-200">
                                        <Building2 size={48} />
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => logoInputRef.current?.click()}
                            title={tEnterprise('enterprise.profile.updateLogo')}
                            aria-label={tEnterprise('enterprise.profile.updateLogo')}
                            className="absolute inset-0 bg-black/50 rounded-[2rem] opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[1px]"
                        >
                            <Upload size={24} />
                        </button>
                        <input
                            ref={logoInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload('logo', e.target.files[0])}
                        />
                    </div>
                </div>
            </div>

            {/* Profile Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12 sm:pt-16">

                {/* Left Sidebar: Fixed Account Info */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-zinc-200 shadow-sm overflow-hidden">
                        <CardHeader className="bg-zinc-50/50 border-b border-zinc-100 px-6 py-4">
                            <CardTitle className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                <Shield size={16} className="text-indigo-500" /> {tEnterprise('enterprise.profile.accountVerified')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-1">
                                <InfoRow icon={User} label={tEnterprise('enterprise.profile.primaryContact')} value={user?.full_name} />
                                <InfoRow icon={Mail} label={tEnterprise('enterprise.profile.accountEmail')} value={user?.email} />
                                <InfoRow icon={Building2} label={tEnterprise('enterprise.profile.registeredEntity')} value={profile.name || user?.org_name} />
                                <InfoRow icon={MapPin} label={tEnterprise('enterprise.profile.baseLocation')} value={[profile.city || user?.org_city, profile.country || user?.org_country].filter(Boolean).join(', ') || tEnterprise('enterprise.profile.global')} />
                                <InfoRow icon={Briefcase} label={tEnterprise('enterprise.profile.sector')} value={profile.industry || user?.org_type} />
                                <div className="pt-4 text-center">
                                    <p className="text-[10px] text-zinc-400">{tEnterprise('enterprise.profile.memberSince', { year: user?.created_at ? new Date(user.created_at).getFullYear() : '2024' })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-indigo-100 bg-indigo-50/30">
                        <CardContent className="p-6">
                            <h4 className="text-sm font-bold text-indigo-900 mb-2">{t('enterprise.profile.completionStatus.title')}</h4>
                            <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden mb-3">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-1000"
                                    style={{ width: `${Object.values(profile).filter(v => v && v.length > 0).length * 10}%` }}
                                />
                            </div>
                            <p className="text-xs text-indigo-600">{t('enterprise.profile.completionStatus.description')}</p>
                        </CardContent>
                    </Card>

                    <ChangePassword />
                </div>

                {/* Main Content: Editable Form */}
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

                        {/* General Info */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="border-b border-zinc-100 px-8 py-5">
                                <CardTitle className="text-lg font-bold text-zinc-900">{tEnterprise('enterprise.profile.aboutCompany')}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.companyName')}</label>
                                        <Input
                                            name="name"
                                            value={profile.name}
                                            onChange={handleChange}
                                            placeholder={tEnterprise('enterprise.profile.placeholders.companyName')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.industry')}</label>
                                        <Input
                                            name="industry"
                                            value={profile.industry}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.industry')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.country')}</label>
                                        <Input
                                            name="country"
                                            value={profile.country}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.country')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.city')}</label>
                                        <Input
                                            name="city"
                                            value={profile.city}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.city')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.companySize')}</label>
                                        <Input
                                            name="company_size"
                                            value={profile.company_size}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.companySize')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.professionalEmail')}</label>
                                        <Input
                                            name="professional_email"
                                            value={profile.professional_email}
                                            onChange={handleChange}
                                            type="email"
                                            placeholder={t('enterprise.profile.placeholders.professionalEmail')}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700 flex items-center justify-between">
                                        {t('enterprise.profile.companyBio')}
                                        <span className="text-[10px] text-zinc-400 font-normal">{t('enterprise.profile.displayedOnBooth')}</span>
                                    </label>
                                    <textarea
                                        name="description"
                                        value={profile.description}
                                        onChange={handleChange}
                                        className="w-full min-h-[120px] p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none shadow-inner"
                                        placeholder={t('enterprise.profile.companyBioPlaceholder')}
                                    ></textarea>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.category.label')}</label>
                                    <select
                                        name="category"
                                        value={profile.category}
                                        onChange={handleChange}
                                        className="w-full h-12 rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">{t('enterprise.profile.category.selectPlaceholder')}</option>
                                        {profile.category && !ENTERPRISE_CATEGORY_OPTIONS.includes(profile.category) && (
                                            <option value={profile.category}>{profile.category}</option>
                                        )}
                                        {ENTERPRISE_CATEGORY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{t(CATEGORY_TRANSLATION_KEYS[option] || 'enterprise.profile.categories.other')}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">{t('enterprise.profile.businessTags')}</label>
                                    <div className="relative">
                                        <Input
                                            value={tagsInput}
                                            onChange={handleTagsChange}
                                            placeholder={t('enterprise.profile.placeholders.businessTags')}
                                            className="pl-10"
                                        />
                                        <Briefcase className="absolute left-3.5 top-3 text-zinc-400" size={16} />
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {normalizeTags(tagsInput).map(t => (
                                            <span key={t} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100 uppercase tracking-tighter">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                        <Globe size={14} className="text-indigo-500" /> {t('enterprise.profile.accountTimezone')}
                                    </label>
                                    <select
                                        value={accountTimezone}
                                        onChange={(e) => setAccountTimezone(e.target.value)}
                                        className="w-full h-12 rounded-xl border border-zinc-300 bg-white px-4 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {timezoneOptions.map((tz) => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-zinc-500">{t('enterprise.profile.accountTimezoneHelp')}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contact & Links */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="border-b border-zinc-100 px-8 py-5">
                                <CardTitle className="text-lg font-bold text-zinc-900">{tEnterprise('enterprise.profile.contactPresence')}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Mail size={14} className="text-indigo-500" /> {t('enterprise.profile.publicBusinessEmail')}
                                        </label>
                                        <Input
                                            name="contact_email"
                                            value={profile.contact_email}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.contactEmail')}
                                            type="email"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Phone size={14} className="text-indigo-500" /> {t('enterprise.profile.phoneNumber')}
                                        </label>
                                        <Input
                                            name="contact_phone"
                                            value={profile.contact_phone}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.contactPhone')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Globe size={14} className="text-indigo-500" /> {t('enterprise.profile.corporateWebsite')}
                                        </label>
                                        <Input
                                            name="website"
                                            value={profile.website}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.website')}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Linkedin size={14} className="text-indigo-500" /> {t('enterprise.profile.linkedinProfile')}
                                        </label>
                                        <Input
                                            name="linkedin"
                                            value={profile.linkedin}
                                            onChange={handleChange}
                                            placeholder={t('enterprise.profile.placeholders.linkedin')}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Submit */}
                        <div className="pt-6 flex justify-end sticky bottom-0 z-10">
                            <Button type="submit" className="min-w-[220px] h-14 rounded-2xl text-lg font-bold shadow-2xl shadow-indigo-200 flex items-center gap-3 active:scale-95 transition-transform" isLoading={isLoading}>
                                <Save size={20} /> {tCommon('common.actions.saveAll')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
