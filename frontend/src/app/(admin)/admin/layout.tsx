'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/LoadingState';
import {
    LayoutDashboard,
    CalendarCheck,
    Users,
    Building2,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    BarChart3,
    Activity,
    ScrollText,
    AlertTriangle,
    UserCheck,
    Briefcase,
    Wallet,
    ChevronRight,
    User,
} from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Events', href: '/admin/events', icon: CalendarCheck },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Organizations', href: '/admin/organizations', icon: Building2 },
    { label: 'Enterprises', href: '/admin/enterprises', icon: Briefcase },
    { label: 'Organizer Approvals', href: '/admin/organizer-registrations', icon: UserCheck },
    { label: 'Enterprise Approvals', href: '/admin/event-join-requests', icon: Briefcase },
    { label: 'Finance', href: '/admin/finance', icon: Wallet },
    { label: 'Monitoring', href: '/admin/monitoring', icon: Activity },
    { label: 'Audit Logs', href: '/admin/audit', icon: ScrollText },
    { label: 'Incidents', href: '/admin/incidents', icon: AlertTriangle },
    { label: 'Profile', href: '/admin/profile', icon: User },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) router.push('/auth/login');
            else if (user?.role !== 'admin') router.push('/');
        }
    }, [isAuthenticated, user, isLoading, router]);

    if (isLoading || !isAuthenticated || user?.role !== 'admin') {
        return <LoadingState message="Checking authorization..." />;
    }

    const initials = (user?.full_name || user?.email || 'AD')
        .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    const currentNav = NAV_ITEMS.find((item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)));
    const pageLabel = currentNav?.label || 'Admin Workspace';

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f3f6fb_100%)]">
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
                    <Link href="/admin" className="flex items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        <span className="text-base font-bold text-zinc-900">Admin Panel</span>
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
                    {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                        const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href));
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
                                {label}
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
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* ── Main content (offset by fixed sidebar) ───────────────── */}
            <div className="lg:ml-64 flex flex-col min-h-screen">
                {/* Mobile topbar */}
                <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white border-b border-zinc-200">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-zinc-900">Admin Panel</span>
                </header>

                <header className="hidden lg:flex sticky top-0 z-20 items-center justify-between border-b border-white/70 bg-white/75 px-8 py-4 backdrop-blur-xl">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                            <span>Admin</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span>{pageLabel}</span>
                        </div>
                        <h1 className="mt-1 text-xl font-bold text-zinc-900">{pageLabel}</h1>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                        <div className="text-right">
                            <p className="text-sm font-semibold text-zinc-900">{user?.full_name || 'Administrator'}</p>
                            <p className="text-xs text-zinc-500">{user?.role}</p>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sm font-bold text-sky-700">
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
