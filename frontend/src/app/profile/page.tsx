'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { User, ProfileUpdatePayload } from '@/types/user';
import { Container } from '@/components/common/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ChangePassword from '@/components/common/ChangePassword';
import { useTranslation } from 'react-i18next';

// ── Constants ────────────────────────────────────────────────────────

const INTEREST_OPTIONS = ['AI', 'Tech', 'Education', 'Healthcare', 'Sustainability', 'Finance', 'Startups'];
const EVENT_TYPE_OPTIONS = ['Webinar', 'Exhibition', 'Networking', 'Workshop'];
const LANGUAGE_OPTIONS = ['English', 'French', 'Arabic', 'Spanish', 'German', 'Chinese', 'Japanese'];
const NETWORKING_OPTIONS = ['Partnerships', 'Investors', 'Clients', 'Knowledge', 'Jobs'];
const EXPERIENCE_LEVELS = ['Junior', 'Mid', 'Senior', 'Executive'];
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

// ── Helper: Multi-select chip component ─────────────────────────────

function ChipSelect({
    options,
    selected,
    onChange,
    allowCustom = false,
    getLabel,
    customPlaceholder,
    addButtonLabel,
}: {
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
    allowCustom?: boolean;
    getLabel?: (value: string) => string;
    customPlaceholder?: string;
    addButtonLabel?: string;
}) {
    const [customValue, setCustomValue] = useState('');

    const toggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((v) => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const addCustom = () => {
        const trimmed = customValue.trim();
        if (trimmed && !selected.includes(trimmed)) {
            onChange([...selected, trimmed]);
            setCustomValue('');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(opt)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${selected.includes(opt)
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-zinc-600 border-zinc-300 hover:border-indigo-400 hover:text-indigo-600'
                            }`}
                    >
                        {getLabel ? getLabel(opt) : opt}
                    </button>
                ))}
                {/* Show custom values not in the predefined list */}
                {selected
                    .filter((v) => !options.includes(v))
                    .map((v) => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => toggle(v)}
                            className="px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-600 text-white border border-indigo-600 shadow-sm transition-all"
                        >
                            {(getLabel ? getLabel(v) : v)} ×
                        </button>
                    ))}
            </div>
            {allowCustom && (
                <div className="flex gap-2 items-end max-w-xs">
                    <Input
                        placeholder={customPlaceholder}
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addCustom}>
                        {addButtonLabel}
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Helper: Toggle switch ────────────────────────────────────────────

function Toggle({
    label,
    enabled,
    onChange,
}: {
    label: string;
    enabled: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm font-medium text-zinc-700 group-hover:text-zinc-900 transition-colors">{label}</span>
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${enabled ? 'bg-indigo-600' : 'bg-zinc-300'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </label>
    );
}

// ── Section wrapper ──────────────────────────────────────────────────

function ProfileSection({
    icon,
    title,
    description,
    children,
}: {
    icon: string;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="overflow-visible">
            <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">{icon}</span>
                    <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
                </div>
                {description && <p className="text-sm text-zinc-500 ml-10 mb-6">{description}</p>}
                {!description && <div className="mb-6" />}
                {children}
            </div>
        </Card>
    );
}

// ── Main Profile Page ────────────────────────────────────────────────

export default function ProfilePage() {
    const { t } = useTranslation();
    const { user: authUser, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
    const [profile, setProfile] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const topRef = useRef<HTMLDivElement>(null);

    // Form state
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [language, setLanguage] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [jobTitle, setJobTitle] = useState('');
    const [industry, setIndustry] = useState('');
    const [company, setCompany] = useState('');
    const [experienceLevel, setExperienceLevel] = useState('');
    const [interests, setInterests] = useState<string[]>([]);
    const [eventTypes, setEventTypes] = useState<string[]>([]);
    const [eventLanguages, setEventLanguages] = useState<string[]>([]);
    const [eventRegions, setEventRegions] = useState<string[]>([]);
    const [networkingGoals, setNetworkingGoals] = useState<string[]>([]);
    const [recommendationsEnabled, setRecommendationsEnabled] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);

    const interestKeyMap: Record<string, string> = {
        AI: 'ai',
        Tech: 'tech',
        Education: 'education',
        Healthcare: 'healthcare',
        Sustainability: 'sustainability',
        Finance: 'finance',
        Startups: 'startups',
    };
    const eventTypeKeyMap: Record<string, string> = {
        Webinar: 'webinar',
        Exhibition: 'exhibition',
        Networking: 'networking',
        Workshop: 'workshop',
    };
    const languageKeyMap: Record<string, string> = {
        English: 'english',
        French: 'french',
        Arabic: 'arabic',
        Spanish: 'spanish',
        German: 'german',
        Chinese: 'chinese',
        Japanese: 'japanese',
    };
    const networkingGoalKeyMap: Record<string, string> = {
        Partnerships: 'partnerships',
        Investors: 'investors',
        Clients: 'clients',
        Knowledge: 'knowledge',
        Jobs: 'jobs',
    };
    const experienceLevelKeyMap: Record<string, string> = {
        Junior: 'junior',
        Mid: 'mid',
        Senior: 'senior',
        Executive: 'executive',
    };
    const regionKeyMap: Record<string, string> = {
        'North America': 'northAmerica',
        Europe: 'europe',
        Asia: 'asia',
        'Middle East': 'middleEast',
        Africa: 'africa',
        'Latin America': 'latinAmerica',
    };

    const getLocalizedFromMap = (value: string, map: Record<string, string>, keyRoot: string): string => {
        const key = map[value];
        return key ? t(`${keyRoot}.${key}`) : value;
    };

    const populateForm = useCallback((user: User) => {
        setFullName(user.full_name || '');
        setBio(user.bio || '');
        setLanguage(user.language || '');
        setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        setJobTitle(user.professional_info?.job_title || '');
        setIndustry(user.professional_info?.industry || '');
        setCompany(user.professional_info?.company || '');
        setExperienceLevel(user.professional_info?.experience_level || '');
        setInterests(user.interests || []);
        setEventTypes(user.event_preferences?.types || []);
        setEventLanguages(user.event_preferences?.languages || []);
        setEventRegions(user.event_preferences?.regions || []);
        setNetworkingGoals(user.networking_goals || []);
        setRecommendationsEnabled(user.engagement_settings?.recommendations_enabled ?? true);
        setEmailNotifications(user.engagement_settings?.email_notifications ?? true);
    }, []);

    useEffect(() => {
        if (!isAuthenticated && !authLoading) return;

        const fetchProfile = async () => {
            try {
                const data = await apiClient.get<User>(ENDPOINTS.USERS.ME);
                setProfile(data);
                populateForm(data);
            } catch (err) {
                console.error('Failed to fetch profile:', err);
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated) fetchProfile();
    }, [isAuthenticated, authLoading, populateForm]);

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage(null);

        const payload: ProfileUpdatePayload = {
            full_name: fullName || undefined,
            bio: bio || undefined,
            language: language || undefined,
            timezone: timezone || undefined,
            professional_info: {
                job_title: jobTitle || undefined,
                industry: industry || undefined,
                company: company || undefined,
                experience_level: experienceLevel || undefined,
            },
            interests: interests.length > 0 ? interests : undefined,
            event_preferences: {
                types: eventTypes.length > 0 ? eventTypes : undefined,
                languages: eventLanguages.length > 0 ? eventLanguages : undefined,
                regions: eventRegions.length > 0 ? eventRegions : undefined,
            },
            networking_goals: networkingGoals.length > 0 ? networkingGoals : undefined,
            engagement_settings: {
                recommendations_enabled: recommendationsEnabled,
                email_notifications: emailNotifications,
            },
        };

        try {
            const updated = await apiClient.put<User>(ENDPOINTS.USERS.ME, payload);
            setProfile(updated);
            populateForm(updated);
            setSaveMessage({ type: 'success', text: t('profile.visitor.success.message') });
            // Ensure the user's timezone preference is immediately applied across the app.
            try {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('auth_user', JSON.stringify({ ...(JSON.parse(localStorage.getItem('auth_user') || '{}') || {}), timezone }));
                }
            } catch {
                // Best-effort only.
            }
            await refreshUser?.();
            // `refreshUser()` may overwrite `auth_user` with the backend response (which can lag).
            // Re-apply the selected timezone to guarantee schedule rendering matches the profile selection.
            try {
                if (typeof window !== 'undefined') {
                    localStorage.setItem(
                        'auth_user',
                        JSON.stringify({
                            ...(JSON.parse(localStorage.getItem('auth_user') || '{}') || {}),
                            timezone,
                        })
                    );
                }
            } catch {
                // Best-effort only.
            }
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('ivep:auth-user-updated'));
            }
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => setSaveMessage(null), 5000);
        } catch (err: any) {
            setSaveMessage({ type: 'error', text: err.message || t('profile.visitor.error.message') });
            topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } finally {
            setSaving(false);
        }
    };

    // ── Auth guard ─────────────────────────────────────────────────────
    if (authLoading || loading) {
        return (
            <Container className="py-16">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-10 w-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                        <p className="text-zinc-500 text-sm">{t('profile.loading')}</p>
                    </div>
                </div>
            </Container>
        );
    }

    if (!isAuthenticated) {
        return (
            <Container className="py-16">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-zinc-900">{t('profile.visitor.authRequired.title')}</h2>
                    <p className="text-zinc-500 mt-2">{t('profile.visitor.authRequired.message')}</p>
                </div>
            </Container>
        );
    }

    const initials = (fullName || authUser?.username || 'U')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div ref={topRef} className="bg-gradient-to-b from-indigo-50/50 via-white to-white min-h-screen">
            {/* Header / Hero area */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 pb-24 pt-12">
                <Container>
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            {initials}
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white">{fullName || authUser?.username}</h1>
                            <p className="text-indigo-100 text-sm mt-1">{profile?.email}</p>
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="relative -mt-16 pb-16">
                <div className="space-y-6">
                    {/* ── Save confirmation toast ────────────────────────── */}
                    {saveMessage && (
                        <div
                            className={`rounded-xl px-5 py-4 shadow-lg border transition-all animate-in fade-in slide-in-from-top-4 duration-300 flex items-start gap-3 ${saveMessage.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-red-50 border-red-200'
                                }`}
                        >
                            {/* Icon */}
                            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${saveMessage.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'
                                }`}>
                                {saveMessage.type === 'success' ? (
                                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>
                            {/* Text */}
                            <div className="flex-1 pt-0.5">
                                <p className={`text-sm font-semibold ${saveMessage.type === 'success' ? 'text-emerald-900' : 'text-red-900'
                                    }`}>
                                    {saveMessage.type === 'success' ? t('profile.visitor.success.title') : t('profile.visitor.error.title')}
                                </p>
                                <p className={`text-sm mt-0.5 ${saveMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'
                                    }`}>
                                    {saveMessage.text}
                                </p>
                            </div>
                            {/* Dismiss button */}
                            <button
                                onClick={() => setSaveMessage(null)}
                                className={`flex-shrink-0 p-1 rounded-md transition-colors ${saveMessage.type === 'success'
                                        ? 'text-emerald-500 hover:bg-emerald-100'
                                        : 'text-red-500 hover:bg-red-100'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* ── 1. Basic Information ───────────────────────────── */}
                    <ProfileSection icon="👤" title={t('profile.visitor.basicInfo.title')} description={t('profile.visitor.basicInfo.description')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <Input label={t('profile.visitor.basicInfo.fullName.label')} id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('profile.visitor.basicInfo.fullName.placeholder')} />
                            <Input label={t('profile.visitor.basicInfo.email')} id="email" value={profile?.email || ''} disabled className="bg-zinc-50 cursor-not-allowed" />
                            <div className="flex flex-col gap-1.5 w-full">
                                <label htmlFor="language" className="text-sm font-medium text-zinc-700">{t('profile.visitor.basicInfo.language.label')}</label>
                                <select
                                    id="language"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                >
                                    <option value="">{t('profile.visitor.basicInfo.language.placeholder')}</option>
                                    {LANGUAGE_OPTIONS.map((l) => (
                                        <option key={l} value={l}>{getLocalizedFromMap(l, languageKeyMap, 'profile.common.languages')}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                                <label htmlFor="timezone" className="text-sm font-medium text-zinc-700">{t('profile.visitor.basicInfo.timezone.label')}</label>
                                <select
                                    id="timezone"
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                >
                                    {TIMEZONE_OPTIONS.map((tz) => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <div className="flex flex-col gap-1.5 w-full">
                                    <label htmlFor="bio" className="text-sm font-medium text-zinc-700">{t('profile.visitor.basicInfo.bio.label')}</label>
                                    <textarea
                                        id="bio"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        rows={3}
                                        placeholder={t('profile.visitor.basicInfo.bio.placeholder')}
                                        className="flex w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </ProfileSection>

                    {/* ── 2. Professional Information ────────────────────── */}
                    <ProfileSection icon="🎯" title={t('profile.visitor.professionalInfo.title')} description={t('profile.visitor.professionalInfo.description')}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <Input label={t('profile.visitor.professionalInfo.jobTitle.label')} id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder={t('profile.visitor.professionalInfo.jobTitle.placeholder')} />
                            <Input label={t('profile.visitor.professionalInfo.industry.label')} id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder={t('profile.visitor.professionalInfo.industry.placeholder')} />
                            <Input label={t('profile.visitor.professionalInfo.company.label')} id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('profile.visitor.professionalInfo.company.placeholder')} />
                            <div className="flex flex-col gap-1.5 w-full">
                                <label htmlFor="experienceLevel" className="text-sm font-medium text-zinc-700">{t('profile.visitor.professionalInfo.experienceLevel.label')}</label>
                                <select
                                    id="experienceLevel"
                                    value={experienceLevel}
                                    onChange={(e) => setExperienceLevel(e.target.value)}
                                    className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                >
                                    <option value="">{t('profile.visitor.professionalInfo.experienceLevel.placeholder')}</option>
                                    {EXPERIENCE_LEVELS.map((l) => (
                                        <option key={l} value={l}>{getLocalizedFromMap(l, experienceLevelKeyMap, 'profile.common.experienceLevels')}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </ProfileSection>

                    {/* ── 3. Interests ───────────────────────────────────── */}
                    <ProfileSection icon="🌍" title={t('profile.visitor.interests.title')} description={t('profile.visitor.interests.description')}>
                        <ChipSelect
                            options={INTEREST_OPTIONS}
                            selected={interests}
                            onChange={setInterests}
                            allowCustom
                            getLabel={(value) => getLocalizedFromMap(value, interestKeyMap, 'profile.common.interests')}
                            customPlaceholder={t('profile.visitor.interests.addCustom')}
                            addButtonLabel={t('profile.visitor.interests.addButton')}
                        />
                    </ProfileSection>

                    {/* ── 4. Event Preferences ───────────────────────────── */}
                    <ProfileSection icon="🎪" title={t('profile.visitor.eventPreferences.title')} description={t('profile.visitor.eventPreferences.description')}>
                        <div className="space-y-6">
                            <div>
                                <p className="text-sm font-medium text-zinc-700 mb-3">{t('profile.visitor.eventPreferences.types')}</p>
                                <ChipSelect options={EVENT_TYPE_OPTIONS} selected={eventTypes} onChange={setEventTypes} getLabel={(value) => getLocalizedFromMap(value, eventTypeKeyMap, 'profile.common.eventTypes')} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-700 mb-3">{t('profile.visitor.eventPreferences.languages')}</p>
                                <ChipSelect options={LANGUAGE_OPTIONS} selected={eventLanguages} onChange={setEventLanguages} getLabel={(value) => getLocalizedFromMap(value, languageKeyMap, 'profile.common.languages')} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-zinc-700 mb-3">{t('profile.visitor.eventPreferences.regions')}</p>
                                <ChipSelect
                                    options={['North America', 'Europe', 'Asia', 'Middle East', 'Africa', 'Latin America']}
                                    selected={eventRegions}
                                    onChange={setEventRegions}
                                    allowCustom
                                    getLabel={(value) => getLocalizedFromMap(value, regionKeyMap, 'profile.common.regions')}
                                    customPlaceholder={t('profile.visitor.interests.addCustom')}
                                    addButtonLabel={t('profile.visitor.interests.addButton')}
                                />
                            </div>
                        </div>
                    </ProfileSection>

                    {/* ── 5. Networking Goals ─────────────────────────────── */}
                    <ProfileSection icon="🤝" title={t('profile.visitor.networking.title')} description={t('profile.visitor.networking.description')}>
                        <ChipSelect options={NETWORKING_OPTIONS} selected={networkingGoals} onChange={setNetworkingGoals} getLabel={(value) => getLocalizedFromMap(value, networkingGoalKeyMap, 'profile.common.networkingGoals')} />
                    </ProfileSection>

                    {/* ── 6. Engagement Settings ──────────────────────────── */}
                    <ProfileSection icon="📊" title={t('profile.visitor.engagement.title')} description={t('profile.visitor.engagement.description')}>
                        <div className="space-y-5 max-w-md">
                            <Toggle label={t('profile.visitor.notifications.recommendations')} enabled={recommendationsEnabled} onChange={setRecommendationsEnabled} />
                            <Toggle label={t('profile.visitor.notifications.emailNotifications')} enabled={emailNotifications} onChange={setEmailNotifications} />
                        </div>
                    </ProfileSection>

                    {/* ── Save button ─────────────────────────────────────── */}
                    <div className="space-y-6">
                        <ChangePassword />
                        <div className="flex justify-end pt-2">
                            <Button size="lg" onClick={handleSave} isLoading={saving} className="px-10">
                                {saving ? t('profile.visitor.saving') : t('profile.visitor.save')}
                            </Button>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}
