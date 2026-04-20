'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/LoadingState';
import {
    LayoutDashboard,
    Calendar,
    User,
    LogOut,
    Menu,
    Bell,
    ChevronRight,
} from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [languageOpen, setLanguageOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const languageDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) router.push('/auth/login');
            else if (user?.role !== 'organizer') router.push('/');
        }
    }, [isAuthenticated, user, isLoading, router]);

    // Fetch unread notification count
    useEffect(() => {
        if (!isAuthenticated || user?.role !== 'organizer') return;
        notificationsApi
            .getNotifications()
            .then((list) => setUnreadCount(list.filter((n: any) => !n.is_read).length))
            .catch(() => { });
    }, [isAuthenticated, user]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
                setLanguageOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    const translate = mounted ? t : i18n.getFixedT('en');
    const NAV_ITEMS = [
        { label: translate('organizer.layout.nav.dashboard'), href: '/organizer', icon: LayoutDashboard },
        { label: translate('organizer.layout.nav.myEvents'), href: '/organizer/events', icon: Calendar },
        { label: translate('organizer.layout.nav.profile'), href: '/organizer/profile', icon: User },
    ];

    if (isLoading || !isAuthenticated || user?.role !== 'organizer') {
        return <LoadingState message={translate('organizer.layout.authChecking')} />;
    }

    const initials = (user?.full_name || user?.email || 'OR')
        .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const currentNav = NAV_ITEMS.find((item) => item.href === '/organizer'
        ? pathname === '/organizer'
        : pathname.startsWith(item.href));
    const pageLabel = currentNav?.label || translate('organizer.layout.workspace');
    const currentLanguage = ((mounted ? i18n.resolvedLanguage : 'en') || 'en').split('-')[0] as 'en' | 'fr' | 'ar';
    const languageCodeLabel: Record<'en' | 'fr' | 'ar', string> = { en: 'EN', fr: 'FR', ar: 'AR' };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">

            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ── fixed, no scrolling */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
                    flex flex-col overflow-hidden
                    transform transition-transform duration-200 ease-in-out lg:translate-x-0
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Logo — pinned top */}
                <div className="shrink-0 p-6 border-b border-gray-100">
                    <Link href="/organizer" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                            I
                        </div>
                        <span className="font-bold text-xl tracking-tight">
                            IVEP <span className="text-indigo-600 text-sm font-medium">ORG</span>
                        </span>
                    </Link>
                </div>

                {/* Nav — expands to fill, no overflow scroll */}
                <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1 text-sm font-medium">
                    {NAV_ITEMS.map((item) => {
                        const isActive =
                            item.href === '/organizer'
                                ? pathname === '/organizer'
                                : pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`
                                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                                    ${isActive
                                        ? 'bg-indigo-50 text-indigo-700'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                `}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout — pinned bottom */}
                <div className="shrink-0 border-t border-gray-100 p-4">
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        {translate('organizer.layout.nav.signOut')}
                    </button>
                </div>
            </aside>

            {/* ── Main area (offset by sidebar width on desktop) ── */}
            <div className="flex-1 flex flex-col min-w-0 lg:ml-64">

                {/* Topbar */}
                <header className="shrink-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            className="p-2 -ml-2 text-gray-400 lg:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="min-w-0">
                            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                                <span>{translate('organizer.layout.breadcrumbOrganizer')}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                                <span>{pageLabel}</span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 lg:text-xl lg:font-bold truncate">{pageLabel}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative" ref={languageDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setLanguageOpen((prev) => !prev)}
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                                aria-haspopup="true"
                                aria-expanded={languageOpen}
                            >
                                <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c4.97 0 9 4.03 9 9s-4.03 9-9 9-9-4.03-9-9 4.03-9 9-9Zm0 0c2.3 2.5 3.5 5.55 3.5 9S14.3 18.5 12 21m0-18c-2.3 2.5-3.5 5.55-3.5 9S9.7 18.5 12 21m-8.25-9h16.5" />
                                </svg>
                                {languageCodeLabel[currentLanguage] || 'EN'}
                                <svg className={`h-3 w-3 transition-transform ${languageOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                                </svg>
                            </button>
                            {languageOpen && (
                                <div className="absolute right-0 mt-1 w-36 rounded-md border border-zinc-200 bg-white shadow-lg z-50 py-1">
                                    <button
                                        type="button"
                                        onClick={() => { i18n.changeLanguage('en'); setLanguageOpen(false); }}
                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 ${currentLanguage === 'en' ? 'font-semibold text-indigo-600' : 'text-zinc-700'}`}
                                    >
                                        {translate('common.languages.english')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { i18n.changeLanguage('fr'); setLanguageOpen(false); }}
                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 ${currentLanguage === 'fr' ? 'font-semibold text-indigo-600' : 'text-zinc-700'}`}
                                    >
                                        {translate('common.languages.french')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { i18n.changeLanguage('ar'); setLanguageOpen(false); }}
                                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 ${currentLanguage === 'ar' ? 'font-semibold text-indigo-600' : 'text-zinc-700'}`}
                                    >
                                        {translate('common.languages.arabic')}
                                    </button>
                                </div>
                            )}
                        </div>
                        <Link
                            href="/organizer/notifications"
                            className="relative p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                            title={translate('organizer.layout.notifications')}
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Link>

                        <div className="flex items-center gap-3 pl-3 border-l border-gray-100">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-medium text-gray-900 leading-none">{user.full_name}</div>
                                <div className="text-xs text-gray-500 capitalize mt-0.5">{user.role}</div>
                            </div>
                            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 shrink-0">
                                {initials}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-gray-50/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
