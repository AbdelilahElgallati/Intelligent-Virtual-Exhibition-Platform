'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { resolveMediaUrl } from '@/lib/media';

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
    onShopOpen?: () => void;
    onFavoriteToggle: () => void;
    favoriteId: string | null;
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
/*  Static assets (from /public/stands/)                               */
/* ------------------------------------------------------------------ */
const SCENE_BG = '/stands/office-stand.jpeg';
const PRESENTER_MALE = '/stands/male-presenter.png';
const PRESENTER_FEMALE = '/stands/female-presenter.png';
const STAND_BANNER_FALLBACK = '/stands/stand_background.jpg';

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
    onShopOpen,
    onFavoriteToggle,
    favoriteId,
    activeTab,
    onTabChange,
    children,
}: VirtualStandLayoutProps) {
    const [showPanel, setShowPanel] = useState(false);
    const [favoritePulse, setFavoritePulse] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const panelBodyRef = useRef<HTMLDivElement | null>(null);
    const { r, g, b } = hexToRgb(themeColor);
    const standId = stand.id || (stand as any)._id || stand.name || '';
    const fallbackPresenterImg = hashStandId(standId) % 2 === 0 ? PRESENTER_MALE : PRESENTER_FEMALE;
    const presenterImg = stand.presenter_avatar_url
        ? resolveMediaUrl(stand.presenter_avatar_url) || fallbackPresenterImg
        : fallbackPresenterImg;
    const profileBannerImage = stand.banner_url
        ? resolveMediaUrl(stand.banner_url) || ''
        : '';
    const sceneBgImage = stand.stand_background_url
        ? resolveMediaUrl(stand.stand_background_url) || SCENE_BG
        : SCENE_BG;
    const presenterLabel = hashStandId(standId) % 2 === 0 ? 'male' : 'female';

    const handleTabClick = (tab: 'resources' | 'about') => {
        onTabChange(tab);
        setShowPanel(true);
    };

    useEffect(() => {
        if (!showPanel) return;
        panelBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        panelRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }, [activeTab, showPanel]);

    useEffect(() => {
        if (!favoriteId) return;
        setFavoritePulse(true);
        const timer = window.setTimeout(() => setFavoritePulse(false), 350);
        return () => window.clearTimeout(timer);
    }, [favoriteId]);

    const onFavoriteClick = () => {
        setFavoritePulse(true);
        window.setTimeout(() => setFavoritePulse(false), 250);
        onFavoriteToggle();
    };

    return (
        <div className="relative w-full h-screen overflow-hidden select-none bg-gray-900">

            {/* ================ SCENE BACKGROUND ================ */}

            {/* Booth scene image */}
            <img
                src={sceneBgImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-[center_20%] sm:object-center"
                draggable={false}
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = SCENE_BG;
                }}
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

            {/* Wall banner — positioned on the back wall */}
            <div className="absolute top-[8%] sm:top-[8%] left-1/2 -translate-x-1/2 z-10 w-[240px] sm:w-[300px] lg:w-[380px]">
                <div
                    className="relative w-full rounded-xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-2"
                    style={{ borderColor: `${themeColor}88`, ['--tw-ring-color' as string]: `${themeColor}44` }}
                >
                    {(profileBannerImage || stand.stand_background_url) ? (
                        <img
                            src={profileBannerImage || resolveMediaUrl(stand.stand_background_url) || STAND_BANNER_FALLBACK}
                            alt=""
                            className="w-full aspect-[16/7] object-cover"
                            draggable={false}
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = STAND_BANNER_FALLBACK;
                            }}
                        />
                    ) : (
                        <div
                            className="w-full aspect-[16/7] flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${themeColor}cc, ${themeColor}88)` }}
                        >
                            {stand.logo_url ? (
                                <img
                                    src={resolveMediaUrl(stand.logo_url) || STAND_BANNER_FALLBACK}
                                    alt={stand.name}
                                    className="h-10 sm:h-14 w-auto object-contain"
                                    draggable={false}
                                    onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = STAND_BANNER_FALLBACK;
                                    }}
                                />
                            ) : (
                                <Building2 className="w-8 h-8 text-white/70" />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Left wall panel — Logo & Company Info */}
            <div className="absolute top-[22%] sm:top-[20%] left-3 sm:left-5 lg:left-12 z-10 w-40 sm:w-48 lg:w-56 hidden md:block group">
                <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-5 lg:p-6 border border-white/40 transition-all duration-500 hover:bg-white/90 hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] hover:-translate-y-1">
                    {/* Logo */}
                    <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto mb-4 rounded-2xl bg-white/50 flex items-center justify-center overflow-hidden border border-white/60 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
                        {stand.logo_url ? (
                            <img
                                src={resolveMediaUrl(stand.logo_url) || STAND_BANNER_FALLBACK}
                                alt={stand.name}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                draggable={false}
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = STAND_BANNER_FALLBACK;
                                }}
                            />
                        ) : (
                            <Building2 className="w-7 h-7 text-gray-400" />
                        )}
                    </div>
                    {/* Name */}
                    <h2 className="text-center font-black text-gray-900 text-xs lg:text-sm leading-tight mb-2 line-clamp-2 tracking-tight uppercase">
                        {stand.name}
                    </h2>
                    {stand.stand_type === 'sponsor' && (
                        <div className="flex justify-center mb-2">
                            <span className="px-2.5 py-0.5 text-[9px] font-black rounded-full text-amber-700 bg-amber-500/10 border border-amber-500/20 tracking-widest">
                                ★ SPONSOR
                            </span>
                        </div>
                    )}
                    {stand.category && (
                        <p className="text-center text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-tighter">{stand.category}</p>
                    )}
                    {/* Tags */}
                    {stand.tags && stand.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                            {stand.tags.slice(0, 4).map((tag, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 text-[9px] font-bold rounded-lg bg-black/5 text-gray-500 border border-black/5"
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
                <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_32px_rgba(0,0,0,0.1)] p-5 lg:p-6 border border-white/40 transition-all duration-500 hover:bg-white/90 hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] hover:-translate-y-1">
                    <h3 className="font-black text-gray-500 mb-3 text-[10px] uppercase tracking-widest opacity-60">
                        Welcome
                    </h3>
                    <p className="text-[12px] text-gray-600 font-medium leading-relaxed line-clamp-6">
                        {stand.description ||
                            'Welcome to our virtual stand. Explore our resources and connect with our team.'}
                    </p>
                    {stand.website_url && (
                        <a
                            href={stand.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] mt-4 inline-flex items-center font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                            style={{ color: themeColor }}
                        >
                            Visit website <span className="ml-1 text-xs">→</span>
                        </a>
                    )}
                </div>
            </div>

            {/* Mobile-only welcome card (below banner) */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-10 w-[85%] max-w-xs md:hidden">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-4 border border-white/50">
                    <h4 className="text-xs font-black text-gray-900 line-clamp-1 mb-1 uppercase tracking-tight">{stand.name}</h4>
                    {stand.category && (
                        <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-tighter">{stand.category}</p>
                    )}
                    <p className="text-[11px] text-gray-600 font-medium leading-relaxed line-clamp-3 mb-3">
                        {stand.description ||
                            'Welcome to our virtual stand.'}
                    </p>
                    {stand.website_url && (
                        <a
                            href={stand.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-black uppercase tracking-widest"
                            style={{ color: themeColor }}
                        >
                            Website →
                        </a>
                    )}
                </div>
            </div>

            {/* ================ PRESENTER ================ */}
            <div className="absolute bottom-[2%] right-[6%] sm:right-[12%] lg:right-[18%] z-10 flex flex-col items-center group">
                {/* Name badge ABOVE the presenter */}
                {stand.presenter_name && (
                    <div
                        className="mb-[-4rem] sm:mb-[-0.5rem] px-5 py-2 rounded-full shadow-2xl text-center backdrop-blur-xl border border-white/20 transition-all duration-500 group-hover:scale-105"
                        style={{ backgroundColor: `${themeColor}cc` }}
                    >
                        <p className="text-[10px] sm:text-xs font-black text-white whitespace-nowrap uppercase tracking-widest">
                            {stand.presenter_name}
                        </p>
                    </div>
                )}
                <img
                    src={presenterImg}
                    alt={stand.presenter_name ?? `${presenterLabel} presenter`}
                    className="h-[38rem] sm:h-80 lg:h-[28rem] w-auto object-contain drop-shadow-[0_8px_40px_rgba(0,0,0,0.25)] transition-all duration-700 group-hover:scale-110"
                    draggable={false}
                    onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = fallbackPresenterImg;
                    }}
                />
            </div>

            {/* ================ UI OVERLAY ================ */}

            {/* Back button */}
            <Link
                href={backHref}
                className="absolute top-5 left-5 z-30 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/60 backdrop-blur-xl shadow-lg text-[10px] font-black uppercase tracking-widest text-gray-700 hover:bg-white hover:scale-105 active:scale-95 transition-all border border-white/40"
            >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back to Event</span>
            </Link>

            {/* Favorite button */}
            <button
                onClick={onFavoriteClick}
                className={`absolute top-5 right-5 z-30 inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full backdrop-blur-xl shadow-lg text-[10px] font-black uppercase tracking-widest transition-all border hover:scale-105 active:scale-95 ${favoriteId
                    ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30'
                    : 'bg-white/60 text-gray-700 border-white/40 hover:bg-white'
                    }`}
            >
                <Heart
                    className={`w-3.5 h-3.5 transition-all ${favoritePulse ? 'scale-125' : 'scale-100'} ${favoriteId ? 'fill-current' : ''
                        }`}
                />
                <span className="hidden sm:inline">
                    {favoriteId ? 'Favorited' : 'Favorite'}
                </span>
            </button>

            {/* ---------- Content drawer ---------- */}
            <div
                ref={panelRef}
                className={`absolute inset-x-0 bottom-[100px] z-20 flex justify-center px-4 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${showPanel
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-12 scale-95 pointer-events-none'
                    }`}
            >
                <div className="w-full max-w-3xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_128px_rgba(0,0,0,0.2)] border border-white/60 overflow-hidden transform-gpu">
                    {/* Drawer header */}
                    <div className="flex items-center justify-between px-8 py-5 border-b border-black/5 bg-white/40">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColor }} />
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">
                                {activeTab === 'resources' ? 'Documents & Resources' : 'About Stand'}
                            </h3>
                        </div>
                        <button
                            onClick={() => setShowPanel(false)}
                            className="p-2 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-900 transition-all active:scale-90"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    {/* Drawer body */}
                    <div ref={panelBodyRef} className="p-8 max-h-[45vh] overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                </div>
            </div>

            {/* ---------- Bottom action bar ---------- */}
            <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-fit px-4">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 p-2 rounded-[2rem] bg-white/70 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/40 group/dock">
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

                    {/* Shop */}
                    {onShopOpen && (
                        <ActionBarBtn
                            glow
                            themeColor={themeColor}
                            onClick={onShopOpen}
                            icon={<ShoppingBag className="w-4 h-4" />}
                            label="Shop"
                        />
                    )}

                    {/* Divider */}
                    <div className="w-px h-8 bg-black/5 mx-1 shrink-0" />

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

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.1); }
            `}</style>
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
    glow,
    themeColor,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    accent?: boolean;
    glow?: boolean;
    themeColor: string;
}) {
    const base =
        'flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-[1.25rem] transition-all duration-300 transform-gpu active:scale-95 group/btn';

    if (glow) {
        return (
            <button
                onClick={onClick}
                className={`${base} text-white shadow-xl hover:brightness-110 hover:-translate-y-1 animate-pulse hover:animate-none`}
                style={{
                    backgroundColor: themeColor,
                    boxShadow: `0 8px 16px -4px ${themeColor}88, 0 4px 8px -2px ${themeColor}44`,
                }}
            >
                {icon}
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest leading-none hidden sm:block">{label}</span>
            </button>
        );
    }

    if (active || accent) {
        return (
            <button
                onClick={onClick}
                className={`${base} text-white shadow-lg hover:brightness-110 hover:-translate-y-1`}
                style={{ backgroundColor: themeColor }}
            >
                {icon}
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest leading-none hidden sm:block">{label}</span>
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className={`${base} text-gray-500 hover:bg-black/5 hover:text-gray-900 hover:-translate-y-0.5`}
        >
            <div className="transition-transform group-hover/btn:scale-110 duration-300">
                {icon}
            </div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.1em] leading-none hidden sm:block opacity-60 group-hover/btn:opacity-100 transition-opacity">
                {label}
            </span>
        </button>
    );
}


