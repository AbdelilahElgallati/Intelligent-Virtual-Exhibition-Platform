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
    CreditCard,
    LogOut,
    Menu,
    X,
    Bell,
    Building2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/organizer', icon: LayoutDashboard },
    { label: 'My Events', href: '/organizer/events', icon: Calendar },
    { label: 'Subscription', href: '/organizer/subscription', icon: CreditCard },
    { label: 'Profile', href: '/organizer/profile', icon: User },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.push('/auth/login');
            } else if (user?.role !== 'organizer') {
                router.push('/');
            }
        }
    }, [isAuthenticated, user, isLoading, router]);

    if (isLoading || !isAuthenticated || user?.role !== 'organizer') {
        return <LoadingState message="Checking authorization..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile Sidebar Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="p-6 border-b border-gray-100 mb-4">
                        <Link href="/organizer" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">I</div>
                            <span className="font-bold text-xl tracking-tight">IVEP <span className="text-indigo-600 text-sm font-medium">ORG</span></span>
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 space-y-1 text-sm font-medium">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href;
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
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

                    {/* Logout */}
                    <div className="p-4 border-t border-gray-100">
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Topbar */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8">
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

                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                            <Bell className="w-6 h-6" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                <div className="text-xs text-gray-500 capitalize">{user.role}</div>
                            </div>
                            <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                                {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-gray-50/50">
                    {children}
                </main>
            </div>
        </div>
    );
}
