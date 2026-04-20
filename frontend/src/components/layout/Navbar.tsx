"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/common/Container';

// ── Per-role top nav links ────────────────────────────────────────────────────

type NavLink = { label: string; href: string };

const GUEST_NAV: NavLink[] = [
    { label: 'common.navigation.home', href: '/' },
    { label: 'common.navigation.events', href: '/events' },
];

const VISITOR_NAV: NavLink[] = [
    { label: 'common.navigation.home', href: '/' },
    { label: 'common.navigation.events', href: '/events' },
    // { label: 'Webinars', href: '/webinars' },
    { label: 'common.navigation.orders', href: '/dashboard/orders' },
    { label: 'common.navigation.favorites', href: '/favorites' },
];

const ORGANIZER_NAV: NavLink[] = [
    // { label: 'Home', href: '/' },
    // { label: 'Events', href: '/events' },
    // { label: 'Organizer Panel', href: '/organizer' },
];

const ADMIN_NAV: NavLink[] = [
    { label: 'common.navigation.home', href: '/' },
    { label: 'common.navigation.events', href: '/events' },
    { label: 'common.navigation.adminPanel', href: '/admin' },
];

const ENTERPRISE_NAV: NavLink[] = [
    { label: 'common.navigation.dashboard', href: '/enterprise' },
    { label: 'common.navigation.myEvents', href: '/enterprise/events' },
    { label: 'common.navigation.products', href: '/enterprise/products' },
    { label: 'common.navigation.requests', href: '/enterprise/product-requests' },
    { label: 'common.navigation.leads', href: '/enterprise/leads' },
];

// ── Per-role dropdown menu items ──────────────────────────────────────────────

type DropdownItem = { label: string; href: string; icon: React.ReactNode };

const ProfileIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);
const DashboardIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
);
const FavIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.48 3.499-.866 1.756a1 1 0 0 1-.753.547l-1.94.282a1 1 0 0 0-.554 1.706l1.404 1.369a1 1 0 0 1 .287.885l-.331 1.929a1 1 0 0 0 1.452 1.054l1.732-.91a1 1 0 0 1 .931 0l1.732.91a1 1 0 0 0 1.452-1.054l-.331-1.93a1 1 0 0 1 .287-.884l1.404-1.368a1 1 0 0 0-.554-1.706l-1.94-.282a1 1 0 0 1-.753-.547l-.866-1.756a1 1 0 0 0-1.793 0Z" />
    </svg>
);
const ReceiptIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25h6m-6 3h6M9 8.25h6M7.5 3.75h9A2.25 2.25 0 0 1 18.75 6v14.25l-2.625-1.5-2.625 1.5-2.625-1.5-2.625 1.5V6A2.25 2.25 0 0 1 7.5 3.75Z" />
    </svg>
);
const CalendarIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
);
const ShieldIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
);

function getDropdownItems(role?: string): DropdownItem[] {
    if (role === 'visitor') {
        return [
            { label: 'common.navigation.myProfile', href: '/profile', icon: ProfileIcon },
            { label: 'common.navigation.dashboard', href: '/dashboard', icon: DashboardIcon },
            { label: 'common.navigation.myOrders', href: '/dashboard/orders', icon: ReceiptIcon },
            { label: 'common.navigation.favorites', href: '/favorites', icon: FavIcon },
        ];
    }
    if (role === 'enterprise') {
        return [
            { label: 'common.navigation.myProfile', href: '/enterprise/profile', icon: ProfileIcon },
            { label: 'common.navigation.dashboard', href: '/enterprise', icon: DashboardIcon },
            { label: 'common.navigation.manageProducts', href: '/enterprise/products', icon: ReceiptIcon },
            { label: 'common.navigation.allRequests', href: '/enterprise/product-requests', icon: FavIcon },
        ];
    }
    if (role === 'organizer') {
        return [
            { label: 'common.navigation.myProfile', href: '/organizer/profile', icon: ProfileIcon },
            { label: 'common.navigation.organizerPanel', href: '/organizer', icon: CalendarIcon },
        ];
    }
    if (role === 'admin') {
        return [
            { label: 'common.navigation.myProfile', href: '/profile', icon: ProfileIcon },
            { label: 'common.navigation.adminPanel', href: '/admin', icon: ShieldIcon },
        ];
    }
    return [{ label: 'common.navigation.myProfile', href: '/profile', icon: ProfileIcon }];
}

function getNavLinks(role?: string): NavLink[] {
    if (role === 'visitor') return VISITOR_NAV;
    if (role === 'enterprise') return ENTERPRISE_NAV;
    if (role === 'organizer') return ORGANIZER_NAV;
    if (role === 'admin') return ADMIN_NAV;
    return GUEST_NAV;
}

// ── Role badge colours ─────────────────────────────────────────────────────────

const roleBadge: Record<string, string> = {
    visitor: 'bg-sky-50 text-sky-700',
    enterprise: 'bg-amber-50 text-amber-700',
    organizer: 'bg-indigo-50 text-indigo-700',
    admin: 'bg-rose-50 text-rose-700',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const Navbar: React.FC = () => {
    const { t } = useTranslation();
    const { isAuthenticated, user, logout } = useAuth();
    const pathname = usePathname();
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const role = user?.role;
    const navLinks = isAuthenticated ? getNavLinks(role) : GUEST_NAV;
    const dropdownItems = getDropdownItems(role);

    const initials = (user?.full_name || user?.username || 'U')
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
            <Container>
                <div className="flex h-16 items-center justify-between">
                    {/* Logo + Nav links */}
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2">
                            <span className="text-xl font-bold tracking-tight text-indigo-600">{t('common.brand')}</span>
                        </Link>

                        <div className="hidden md:flex items-center gap-6">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`text-sm font-medium transition-colors ${isActive
                                                ? 'text-indigo-600 border-b-2 border-indigo-600 pb-0.5'
                                                : 'text-zinc-600 hover:text-indigo-600'
                                            }`}
                                    >
                                        {t(link.label)}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => i18n.changeLanguage('en')}
                                title={t('common.languages.english')}
                                className={`text-xs ${i18n.resolvedLanguage === 'en' ? 'font-bold' : ''}`}
                            >
                                EN
                            </button>
                            <span className="text-zinc-300">|</span>
                            <button
                                type="button"
                                onClick={() => i18n.changeLanguage('fr')}
                                title={t('common.languages.french')}
                                className={`text-xs ${i18n.resolvedLanguage === 'fr' ? 'font-bold' : ''}`}
                            >
                                FR
                            </button>
                            <span className="text-zinc-300">|</span>
                            <button
                                type="button"
                                onClick={() => i18n.changeLanguage('ar')}
                                title={t('common.languages.arabic')}
                                className={`text-xs ${i18n.resolvedLanguage === 'ar' ? 'font-bold' : ''}`}
                            >
                                AR
                            </button>
                        </div>
                        {isAuthenticated ? (
                            <div className="relative" ref={dropdownRef}>
                                {/* Avatar trigger */}
                                <button
                                    onClick={() => setProfileOpen((prev) => !prev)}
                                    className="flex items-center gap-3 rounded-full pl-3 pr-1 py-1 hover:bg-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    aria-expanded={profileOpen}
                                    aria-haspopup="true"
                                >
                                    <span className="text-sm text-zinc-600 hidden sm:inline-block">
                                        {user?.full_name || user?.username}
                                    </span>
                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-white">
                                        {initials}
                                    </div>
                                </button>

                                {/* Dropdown */}
                                {profileOpen && (
                                    <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-zinc-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* Header */}
                                        <div className="px-4 py-3 border-b border-zinc-100">
                                            <div className="flex items-center gap-3">
                                                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                    {initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-zinc-900 truncate">
                                                        {user?.full_name || user?.username}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                                                    <span className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-medium rounded-full capitalize ${roleBadge[role ?? ''] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                                        {role ? t(`common.roles.${role}`) : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Menu items */}
                                        <div className="py-1">
                                            {dropdownItems.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={() => setProfileOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                                >
                                                    {item.icon}
                                                    {t(item.label)}
                                                </Link>
                                            ))}
                                        </div>

                                        {/* Logout */}
                                        <div className="border-t border-zinc-100 pt-1">
                                            <button
                                                onClick={() => { setProfileOpen(false); logout(); }}
                                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                                </svg>
                                                {t('common.buttons.signOut')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link href="/auth/login">
                                    <Button variant="ghost" size="sm">{t('common.buttons.login')}</Button>
                                </Link>
                                <Link href="/auth/register">
                                    <Button size="sm">{t('common.buttons.register')}</Button>
                                </Link>
                            </div>
                        )}
                        {/* Mobile menu toggle */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="flex md:hidden items-center justify-center p-2 rounded-md text-zinc-600 hover:text-indigo-600 hover:bg-zinc-100"
                            aria-expanded={mobileMenuOpen}
                        >
                            <span className="sr-only">{t('common.navigation.openMenu')}</span>
                            {mobileMenuOpen ? (
                                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Expansion */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-zinc-100 py-3 space-y-1">
                        {navLinks.map((link) => {
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block px-3 py-2 rounded-md text-base font-medium ${isActive
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600'
                                        }`}
                                >
                                    {t(link.label)}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </Container>
        </nav>
    );
};
