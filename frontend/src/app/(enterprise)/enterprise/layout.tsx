'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/LoadingState';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import {
    LayoutDashboard,
    CalendarCheck,
    Users,
    CreditCard,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    User,
    Package,
    MessageSquare,
    Calendar,
    BarChart3,
    Bell,
    ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
    { labelKey: 'layout.enterprise.sidebar.dashboard', href: '/enterprise', icon: LayoutDashboard },
    { labelKey: 'layout.enterprise.sidebar.events', href: '/enterprise/events', icon: Calendar },
    { labelKey: 'layout.enterprise.sidebar.requests', href: '/enterprise/product-requests', icon: MessageSquare },
    { labelKey: 'layout.enterprise.sidebar.analytics', href: '/enterprise/analytics', icon: BarChart3 },
    { labelKey: 'layout.enterprise.sidebar.products', href: '/enterprise/products', icon: Package },
    { labelKey: 'layout.enterprise.sidebar.profile', href: '/enterprise/profile', icon: User },
    { labelKey: 'layout.enterprise.sidebar.notifications', href: '/enterprise/notifications', icon: Bell },
];

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [languageOpen, setLanguageOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const languageDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) router.push('/auth/login');
            else if (user?.role !== 'enterprise') router.push('/');
        }
    }, [isAuthenticated, user, isLoading, router]);

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
    if (isLoading || !isAuthenticated || user?.role !== 'enterprise') {
        return <LoadingState message={translate('layout.enterprise.loading')} />;
    }

    const initials = (user?.full_name || user?.email || 'EN')
        .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const currentNav = NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/enterprise' && pathname.startsWith(item.href)));
    const pageLabel = currentNav ? translate(currentNav.labelKey) : translate('layout.enterprise.workspace');
    const currentLanguage = ((mounted ? i18n.resolvedLanguage : 'en') || 'en').split('-')[0] as 'en' | 'fr' | 'ar';
    const languageCodeLabel: Record<'en' | 'fr' | 'ar', string> = { en: 'EN', fr: 'FR', ar: 'AR' };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f4f7fb_100%)]">
            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar (always fixed) ───────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-zinc-200
                flex flex-col
                transform transition-transform duration-200 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0
            `}>
                {/* Logo */}
                <div className="flex items-center justify-between h-16 px-5 border-b border-zinc-200 flex-shrink-0">
                    <Link href="/enterprise" className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        <div>
                            <span className="block text-base font-bold text-zinc-900">{translate('layout.enterprise.sidebar.title')}</span>
                            <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{translate('layout.enterprise.sidebar.subtitle')}</span>
                        </div>
                    </Link>
                    <button
                        className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation — grows and scrolls */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                    {NAV_ITEMS.map(({ labelKey, href, icon: Icon }) => {
                        const isActive = pathname === href || (href !== '/enterprise' && pathname.startsWith(href));
                        return (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`} />
                                {translate(labelKey)}
                            </Link>
                        );
                    })}
                </nav>

                {/* ── Footer: sign-out — pinned to bottom ───────────────── */}
                <div className="border-t border-zinc-200 px-3 py-4 flex-shrink-0">
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <LogOut className="w-4 h-4 text-zinc-400" />
                        {translate('layout.enterprise.sidebar.signOut')}
                    </button>
                </div>
            </aside>

            {/* ── Main content (offset by fixed sidebar) ───────────────── */}
            <div className="lg:ml-64 flex min-h-screen flex-col">
                {/* Mobile topbar */}
                <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-zinc-200">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-zinc-900">{translate('layout.enterprise.sidebar.title')}</span>
                </header>

                <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between border-b border-white/70 bg-white/75 px-8 py-4 backdrop-blur-xl">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                            <span>{translate('layout.enterprise.breadcrumb')}</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span>{pageLabel}</span>
                        </div>
                        <h1 className="mt-1 text-xl font-bold text-zinc-900">{pageLabel}</h1>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
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
                        <div className="text-right">
                            <p className="text-sm font-semibold text-zinc-900">{user?.full_name || translate('layout.enterprise.fallbackUser')}</p>
                            <p className="text-xs text-zinc-500">{user?.role}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-bold text-indigo-700">
                            {initials}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
