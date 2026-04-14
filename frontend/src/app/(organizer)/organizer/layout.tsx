'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
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

const NAV_ITEMS = [
    { labelKey: 'layout.organizer.sidebar.dashboard', href: '/organizer', icon: LayoutDashboard },
    { labelKey: 'layout.organizer.sidebar.myEvents', href: '/organizer/events', icon: Calendar },
    { labelKey: 'layout.organizer.sidebar.profile', href: '/organizer/profile', icon: User },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

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

    if (isLoading || !isAuthenticated || user?.role !== 'organizer') {
        return <LoadingState message={t('layout.organizer.checkingAuth')} />;
    }

    const initials = (user?.full_name || user?.email || 'OR')
        .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const currentNav = NAV_ITEMS.find((item) => item.href === '/organizer'
        ? pathname === '/organizer'
        : pathname.startsWith(item.href));
    const pageLabel = currentNav ? t(currentNav.labelKey) : t('layout.organizer.workspace');

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
                            {t('layout.organizer.sidebar.brand')} <span className="text-indigo-600 text-sm font-medium">{t('layout.organizer.sidebar.suffix')}</span>
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
                                {t(item.labelKey)}
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
                        {t('layout.organizer.sidebar.signOut')}
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
                                <span>{t('layout.organizer.breadcrumb')}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                                <span>{pageLabel}</span>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 lg:text-xl lg:font-bold truncate">{pageLabel}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/organizer/notifications"
                            className="relative p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                            title={t('layout.organizer.notifications')}
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
                                <div className="text-sm font-medium text-gray-900 leading-none">{user?.full_name}</div>
                                <div className="text-xs text-gray-500 capitalize mt-0.5 uppercase tracking-tighter">{user?.role}</div>
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
