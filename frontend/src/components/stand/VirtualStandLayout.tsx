'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Stand } from '@/lib/api/types';
import {
    ArrowLeft,
    Building2,
    MessageSquare,
    CalendarDays,
    Info,
    Heart,
    Sparkles,
    FileText,
    ShoppingBag,
    X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */
interface VirtualStandLayoutProps {
    stand: Stand;
    themeColor: string;
    avatarBg: string;
    backHref: string;
    /* action callbacks */
    onChatOpen: () => void;
    onMeetingOpen: () => void;
    onAssistantOpen: () => void;
    onFavoriteToggle: () => void;
    favoriteId: string | null;
    /* marketplace */
    onProductsOpen?: () => void;
    hasProducts?: boolean;
    /* tab state (owned by parent) */
    activeTab: 'resources' | 'about';
    onTabChange: (tab: 'resources' | 'about') => void;
    /* rendered tab content */
    children: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 30;
    const g = parseInt(h.substring(2, 4), 16) || 41;
    const b = parseInt(h.substring(4, 6), 16) || 59;
    return { r, g, b };
}

/* ------------------------------------------------------------------ */
/*  Booth scene images (curated office / showroom backdrops)           */
/* ------------------------------------------------------------------ */
const BOOTH_SCENES = [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1920&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1920&q=80',
];

function hashStandId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/* ------------------------------------------------------------------ */
/*  VirtualStandLayout                                                 */
/* ------------------------------------------------------------------ */
export function VirtualStandLayout({
    stand,
    themeColor,
    avatarBg,
    backHref,
    onChatOpen,
    onMeetingOpen,
    onAssistantOpen,
    onFavoriteToggle,
    favoriteId,
    onProductsOpen,
    hasProducts,
    activeTab,
    onTabChange,
    children,
}: VirtualStandLayoutProps) {
    const [showPanel, setShowPanel] = useState(false);
    const { r, g, b } = hexToRgb(themeColor);
    const standId = stand.id || (stand as any)._id || stand.name || '';
    const sceneUrl = BOOTH_SCENES[hashStandId(standId) % BOOTH_SCENES.length];

    const handleTabClick = (tab: 'resources' | 'about') => {
        if (activeTab === tab && showPanel) {
            setShowPanel(false);
        } else {
            onTabChange(tab);
            setShowPanel(true);
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden select-none bg-gray-900">

            {/* ================ SCENE BACKGROUND ================ */}

            {/* Booth scene image */}
            <img
                src={sceneUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {/* CSS gradient fallback (behind image) */}
            <div
                className="absolute inset-0 -z-[1]"
                style={{
                    background: `linear-gradient(180deg,
                        rgba(${r},${g},${b},0.85) 0%,
                        rgba(${r},${g},${b},0.55) 55%,
                        #b5a584 56%,
                        #a99a78 100%)`,
                }}
            />
            {/* Theme-color tint + cinematic grading */}
            <div
                className="absolute inset-0 z-[1] pointer-events-none"
                style={{
                    background: `linear-gradient(180deg,
                        rgba(${r},${g},${b},0.20) 0%,
                        rgba(${r},${g},${b},0.06) 40%,
                        rgba(0,0,0,0.30) 100%)`,
                }}
            />
            {/* Vignette */}
            <div
                className="absolute inset-0 pointer-events-none z-[1]"
                style={{ boxShadow: 'inset 0 0 100px 30px rgba(0,0,0,0.20)' }}
            />

            {/* ================ BRANDING OVERLAYS ================ */}

            {/* Center banner frame (visible when stand has bg image) */}
            {stand.stand_background_url && (
                <div className="absolute top-5 sm:top-7 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative w-[280px] sm:w-[420px] lg:w-[540px] aspect-[16/7] rounded-lg overflow-hidden shadow-2xl ring-4 ring-white/20">
                        <img
                            src={stand.stand_background_url}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <div className="absolute bottom-2.5 left-3.5 right-3.5">
                            <p className="text-white font-bold text-xs sm:text-sm lg:text-base drop-shadow-lg truncate">
                                {stand.name}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Welcome text (shows when NO banner, so the wall isn't empty) */}
            {!stand.stand_background_url && (
                <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
                    <p className="text-white/70 text-base sm:text-lg font-light tracking-widest uppercase">
                        Welcome to
                    </p>
                    <p className="text-white font-bold text-2xl sm:text-4xl drop-shadow-lg mt-1">
                        {stand.name}
                    </p>
                </div>
            )}

            {/* Left wall panel — Logo & Company Info */}
            <div className="absolute top-[22%] sm:top-[20%] left-3 sm:left-5 lg:left-12 z-10 w-40 sm:w-48 lg:w-56 hidden md:block">
                <div className="bg-white/[0.93] backdrop-blur rounded-2xl shadow-2xl p-4 lg:p-5 border border-white/60">
                    {/* Logo */}
                    <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto mb-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shadow-inner">
                        {stand.logo_url ? (
                            <img
                                src={stand.logo_url}
                                alt={stand.name}
                                className="w-full h-full object-cover rounded-xl"
                                draggable={false}
                            />
                        ) : (
                            <Building2 className="w-7 h-7 text-gray-400" />
                        )}
                    </div>
                    {/* Name */}
                    <h2 className="text-center font-bold text-gray-900 text-xs lg:text-sm leading-tight mb-1 line-clamp-2">
                        {stand.name}
                    </h2>
                    {stand.stand_type === 'sponsor' && (
                        <div className="flex justify-center mb-1">
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full text-amber-700 bg-amber-100">
                                ★ SPONSOR
                            </span>
                        </div>
                    )}
                    {stand.category && (
                        <p className="text-center text-[10px] text-gray-500 mb-1">{stand.category}</p>
                    )}
                    {/* Tags */}
                    {stand.tags && stand.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-2">
                            {stand.tags.slice(0, 4).map((tag, i) => (
                                <span
                                    key={i}
                                    className="px-1.5 py-0.5 text-[9px] rounded-full bg-gray-100 text-gray-600"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right wall panel — Description */}
            <div className="absolute top-[22%] sm:top-[20%] right-3 sm:right-5 lg:right-12 z-10 w-40 sm:w-48 lg:w-56 hidden md:block">
                <div className="bg-white/[0.88] backdrop-blur rounded-2xl shadow-2xl p-4 lg:p-5 border border-white/60">
                    <h3 className="font-semibold text-gray-800 mb-2 text-[10px] uppercase tracking-wider">
                        Welcome
                    </h3>
                    <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-6">
                        {stand.description ||
                            'Welcome to our virtual stand. Explore our resources and connect with our team.'}
                    </p>
                    {stand.website_url && (
                        <a
                            href={stand.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] mt-3 inline-block font-medium hover:underline"
                            style={{ color: themeColor }}
                        >
                            Visit website →
                        </a>
                    )}
                </div>
            </div>

            {/* ================ PRESENTER ================ */}
            {stand.presenter_avatar_url && (
                <div className="absolute bottom-[5%] right-[6%] sm:right-[12%] lg:right-[18%] z-10 flex flex-col items-center">
                    <img
                        src={stand.presenter_avatar_url}
                        alt={stand.presenter_name ?? 'Presenter'}
                        className="h-48 sm:h-60 lg:h-72 w-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                        draggable={false}
                    />
                    {stand.presenter_name && (
                        <div
                            className="mt-1.5 px-3.5 py-1 rounded-full shadow-lg text-center backdrop-blur-sm"
                            style={{ backgroundColor: `${themeColor}dd` }}
                        >
                            <p className="text-[11px] sm:text-xs font-medium text-white whitespace-nowrap">
                                {stand.presenter_name}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ================ UI OVERLAY ================ */}

            {/* Back button */}
            <Link
                href={backHref}
                className="absolute top-3.5 left-3.5 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 backdrop-blur-md shadow-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors border border-white/50"
            >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Event</span>
            </Link>

            {/* Favorite button */}
            <button
                onClick={onFavoriteToggle}
                className={`absolute top-3.5 right-3.5 z-30 inline-flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-md shadow-lg text-sm font-medium transition-all border ${favoriteId
                    ? 'bg-amber-50/95 text-amber-700 border-amber-200 shadow-amber-200/40'
                    : 'bg-white/90 text-gray-700 border-white/50 hover:bg-white'
                    }`}
            >
                <Heart
                    className={`w-4 h-4 transition-colors ${favoriteId ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                />
                <span className="hidden sm:inline">
                    {favoriteId ? 'Favorited' : 'Favorite'}
                </span>
            </button>

            {/* Mobile-only stand name pill */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 md:hidden max-w-[45%]">
                <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-white/50">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">
                        {stand.name}
                    </p>
                </div>
            </div>

            {/* ---------- Content drawer ---------- */}
            <div
                className={`absolute inset-x-0 bottom-[68px] z-20 flex justify-center px-3 transition-all duration-300 ease-out ${showPanel
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-6 pointer-events-none'
                    }`}
            >
                <div className="w-full max-w-3xl bg-white/[0.96] backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden">
                    {/* Drawer header */}
                    <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-100 bg-gray-50/60">
                        <h3 className="text-sm font-semibold text-gray-700">
                            {activeTab === 'resources' ? 'Documents & Resources' : 'About Us'}
                        </h3>
                        <button
                            onClick={() => setShowPanel(false)}
                            className="p-1 rounded-full hover:bg-gray-200/70 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Drawer body */}
                    <div className="p-5 max-h-[42vh] overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>

            {/* ---------- Bottom action bar ---------- */}
            <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-3">
                <div className="flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 rounded-2xl bg-white/[0.95] backdrop-blur-xl shadow-2xl border border-white/60">
                    {/* Resources */}
                    <ActionBarBtn
                        active={activeTab === 'resources' && showPanel}
                        themeColor={themeColor}
                        onClick={() => handleTabClick('resources')}
                        icon={<FileText className="w-4 h-4" />}
                        label="Resources"
                    />
                    {/* About */}
                    <ActionBarBtn
                        active={activeTab === 'about' && showPanel}
                        themeColor={themeColor}
                        onClick={() => handleTabClick('about')}
                        icon={<Info className="w-4 h-4" />}
                        label="About"
                    />

                    {/* Shop (only visible when stand has products) */}
                    {hasProducts && onProductsOpen && (
                        <ActionBarBtn
                            themeColor={themeColor}
                            onClick={onProductsOpen}
                            icon={<ShoppingBag className="w-4 h-4" />}
                            label="Shop"
                        />
                    )}

                    {/* Divider */}
                    <div className="w-px h-7 bg-gray-200 mx-0.5 sm:mx-1 shrink-0" />

                    {/* Chat (accent) */}
                    <ActionBarBtn
                        accent
                        themeColor={themeColor}
                        onClick={onChatOpen}
                        icon={<MessageSquare className="w-4 h-4" />}
                        label="Chat"
                    />
                    {/* Meeting */}
                    <ActionBarBtn
                        themeColor={themeColor}
                        onClick={onMeetingOpen}
                        icon={<CalendarDays className="w-4 h-4" />}
                        label="Meeting"
                    />
                    {/* Assistant */}
                    <ActionBarBtn
                        themeColor={themeColor}
                        onClick={onAssistantOpen}
                        icon={<Sparkles className="w-4 h-4" />}
                        label="Assistant"
                    />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Action-bar button                                                  */
/* ------------------------------------------------------------------ */
function ActionBarBtn({
    icon,
    label,
    onClick,
    active,
    accent,
    themeColor,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    accent?: boolean;
    themeColor: string;
}) {
    const base =
        'inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap';

    if (active || accent) {
        return (
            <button
                onClick={onClick}
                className={`${base} text-white shadow-md hover:opacity-90`}
                style={{ backgroundColor: themeColor }}
            >
                {icon}
                <span className="hidden sm:inline">{label}</span>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className={`${base} text-gray-600 hover:bg-gray-100`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}


