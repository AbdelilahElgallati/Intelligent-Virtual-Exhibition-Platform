"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { http } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import {
    Mail, User, Shield, Building2, MapPin, Globe, Calendar,
    Linkedin, Palette, Save, CheckCircle2, Phone, UserCircle,
    Upload, X, Camera, Image as ImageIcon, Briefcase
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [profile, setProfile] = useState({
        description: '',
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

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const myOrg = await http.get<any>('/enterprise/profile');

                if (myOrg) {
                    setProfile({
                        description: myOrg.description || '',
                        website: myOrg.website || '',
                        linkedin: myOrg.linkedin || '',
                        theme_color: myOrg.theme_color || '#4f46e5',
                        branding_theme: myOrg.branding_theme || 'Modern',
                        contact_email: myOrg.contact_email || '',
                        contact_phone: myOrg.contact_phone || '',
                        avatar_gender: myOrg.avatar_gender || 'male',
                        tags: myOrg.tags || [],
                        logo_url: myOrg.logo_url || '',
                        banner_url: myOrg.banner_url || ''
                    });
                }
            } catch (err) {
                console.error("Failed to fetch organization details", err);
            }
        };
        if (user) fetchProfile();
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const tagList = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
        setProfile(prev => ({ ...prev, tags: tagList }));
    };

    const handleFileUpload = async (type: 'logo' | 'banner', file: File) => {
        setIsUploading(prev => ({ ...prev, [type]: true }));
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Need to get token manually for fetch-with-FormData
            let token = '';
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) token = JSON.parse(storedTokens).access_token;

            const res = await fetch(`${API_BASE}/api/v1/enterprise/profile/${type}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

            const data = await res.json();
            const url = type === 'logo' ? data.logo_url : data.banner_url;

            setProfile(prev => ({ ...prev, [`${type}_url`]: url }));
            setMessage({ type: 'success', text: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded!` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || `Failed to upload ${type}.` });
        } finally {
            setIsUploading(prev => ({ ...prev, [type]: false }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            await http.patch('/enterprise/profile', profile);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
        } finally {
            setIsLoading(false);
        }
    };

    const initials = (user?.full_name || user?.email || 'EN')
        .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            {/* Hero Header with Banner */}
            <div className="relative group rounded-[2.5rem] overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm h-48 sm:h-72">
                {profile.banner_url ? (
                    <img
                        src={`${API_BASE}${profile.banner_url}`}
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
                        <Camera size={18} /> Update Cover Photo
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
                                        src={`${API_BASE}${profile.logo_url}`}
                                        alt="Logo"
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
                                <Shield size={16} className="text-indigo-500" /> Account Verified
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="space-y-1">
                                <InfoRow icon={User} label="Primary Contact" value={user?.full_name} />
                                <InfoRow icon={Mail} label="Account Email" value={user?.email} />
                                <InfoRow icon={Building2} label="Registered Entity" value={user?.org_name} />
                                <InfoRow icon={MapPin} label="Base Location" value={[user?.org_city, user?.org_country].filter(Boolean).join(', ') || 'Global'} />
                                <InfoRow icon={Briefcase} label="Sector" value={user?.org_type} />
                                <div className="pt-4 text-center">
                                    <p className="text-[10px] text-zinc-400"> Member since {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'} </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-indigo-100 bg-indigo-50/30">
                        <CardContent className="p-6">
                            <h4 className="text-sm font-bold text-indigo-900 mb-2">Completion Status</h4>
                            <div className="w-full bg-indigo-100 h-2 rounded-full overflow-hidden mb-3">
                                <div
                                    className="bg-indigo-600 h-full transition-all duration-1000"
                                    style={{ width: `${Object.values(profile).filter(v => v && v.length > 0).length * 10}%` }}
                                />
                            </div>
                            <p className="text-xs text-indigo-600">Complete your profile to increase your visibility in virtual exhibitions.</p>
                        </CardContent>
                    </Card>
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
                                <CardTitle className="text-lg font-bold text-zinc-900">About Company</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700 flex items-center justify-between">
                                        Company Bio
                                        <span className="text-[10px] text-zinc-400 font-normal">Displayed on your booth</span>
                                    </label>
                                    <textarea
                                        name="description"
                                        value={profile.description}
                                        onChange={handleChange}
                                        className="w-full min-h-[120px] p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none shadow-inner"
                                        placeholder="Tell visitors about your company value proposition..."
                                    ></textarea>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-zinc-700">Business Tags</label>
                                    <div className="relative">
                                        <Input
                                            value={profile.tags.join(', ')}
                                            onChange={handleTagsChange}
                                            placeholder="AI, Blockchain, SaaS, Green Energy (comma separated)"
                                            className="pl-10"
                                        />
                                        <Briefcase className="absolute left-3.5 top-3 text-zinc-400" size={16} />
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {profile.tags.map(t => (
                                            <span key={t} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100 uppercase tracking-tighter">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contact & Links */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="border-b border-zinc-100 px-8 py-5">
                                <CardTitle className="text-lg font-bold text-zinc-900">Contact & Presence</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Mail size={14} className="text-indigo-500" /> Public Business Email
                                        </label>
                                        <Input
                                            name="contact_email"
                                            value={profile.contact_email}
                                            onChange={handleChange}
                                            placeholder="contact@acme.com"
                                            type="email"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Phone size={14} className="text-indigo-500" /> Phone Number
                                        </label>
                                        <Input
                                            name="contact_phone"
                                            value={profile.contact_phone}
                                            onChange={handleChange}
                                            placeholder="+212 600-000000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Globe size={14} className="text-indigo-500" /> Corporate Website
                                        </label>
                                        <Input
                                            name="website"
                                            value={profile.website}
                                            onChange={handleChange}
                                            placeholder="https://acme.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Linkedin size={14} className="text-indigo-500" /> LinkedIn Profile
                                        </label>
                                        <Input
                                            name="linkedin"
                                            value={profile.linkedin}
                                            onChange={handleChange}
                                            placeholder="https://linkedin.com/company/acme"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Branding & Avatar */}
                        <Card className="border-zinc-200 shadow-sm">
                            <CardHeader className="border-b border-zinc-100 px-8 py-5">
                                <CardTitle className="text-lg font-bold text-zinc-900">Visual Identity</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Theme Color */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Palette size={14} className="text-indigo-500" /> Theme Accent
                                        </label>
                                        <div className="flex gap-4 items-center p-3 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-inner">
                                            <input
                                                type="color"
                                                name="theme_color"
                                                value={profile.theme_color}
                                                onChange={handleChange}
                                                className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white p-0.5 bg-white shadow-sm ring-1 ring-zinc-200"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-xs font-mono uppercase tracking-wider text-zinc-900">
                                                    {profile.theme_color}
                                                </span>
                                                <span className="text-[10px] text-zinc-400 italic">Used for buttons & highlights</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Branding Style */}
                                    <div className="space-y-3">
                                        <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                            <Shield size={14} className="text-indigo-500" /> Branding Style
                                        </label>
                                        <select
                                            name="branding_theme"
                                            value={profile.branding_theme}
                                            onChange={handleChange}
                                            className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 shadow-inner"
                                        >
                                            <option>Modern</option>
                                            <option>Classic</option>
                                            <option>Creative</option>
                                            <option>Tech-Focused</option>
                                            <option>Minimalist</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Avatar Selection */}
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-zinc-700 flex items-center gap-2">
                                        <UserCircle size={14} className="text-indigo-500" /> Virtual Representative Gender
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setProfile(p => ({ ...p, avatar_gender: 'male' }))}
                                            className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${profile.avatar_gender === 'male'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md'
                                                : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200'
                                                }`}
                                        >
                                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-xl">👨‍💼</div>
                                            <span className="font-bold text-sm">Male Avatar</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setProfile(p => ({ ...p, avatar_gender: 'female' }))}
                                            className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${profile.avatar_gender === 'female'
                                                ? 'bg-pink-50 border-pink-500 text-pink-700 shadow-md'
                                                : 'bg-white border-zinc-100 text-zinc-500 hover:border-zinc-200'
                                                }`}
                                        >
                                            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-xl">👩‍💼</div>
                                            <span className="font-bold text-sm">Female Avatar</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-400 italic text-center">This chooses the 3D model representing your company in the exhibition hall.</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Submit */}
                        <div className="pt-6 flex justify-end sticky bottom-0 z-10">
                            <Button type="submit" className="min-w-[220px] h-14 rounded-2xl text-lg font-bold shadow-2xl shadow-indigo-200 flex items-center gap-3 active:scale-95 transition-transform" isLoading={isLoading}>
                                <Save size={20} /> Save All Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
