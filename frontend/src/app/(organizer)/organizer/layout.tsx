'use client';

import { useEffect, useState } from 'react';
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
    Building2,
} from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/organizer', icon: LayoutDashboard },
    { label: 'My Events', href: '/organizer/events', icon: Calendar },
    { label: 'Profile', href: '/organizer/profile', icon: User },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
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
        return <LoadingState message="Checking authorization..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">

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
                    transform transition-transform duration-200 ease-in-out
                    lg:translate-x-0 lg:static lg:inset-0
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
                <nav className="flex-1 px-4 py-3 space-y-1 text-sm font-medium overflow-hidden">
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
                <div className="shrink-0 p-4 border-t border-gray-100">
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main area ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Topbar */}
                <header className="shrink-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
                    {/* Left: hamburger (mobile) + breadcrumb (desktop) */}
                    <div className="flex items-center gap-4">
                        <button
                            className="p-2 -ml-2 text-gray-400 lg:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                            <span className="font-medium text-gray-900">IVEP Organizer</span>
                        </div>
                    </div>

                    {/* Right: notification bell + user */}
                    <div className="flex items-center gap-3">
                        {/* Bell with unread badge */}
                        <Link
                            href="/organizer/notifications"
                            className="relative p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 border-2 border-white">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Link>

                        {/* Divider + user */}
                        <div className="flex items-center gap-3 pl-3 border-l border-gray-100">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-medium text-gray-900 leading-none">{user.full_name}</div>
                                <div className="text-xs text-gray-500 capitalize mt-0.5">{user.role}</div>
                            </div>
                            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200 shrink-0">
                                {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content — only this scrolls */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-50/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
