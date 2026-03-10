// "use client";

// import React from 'react';
// import Link from 'next/link';
// import { usePathname } from 'next/navigation';
// import {
//     LayoutDashboard,
//     User,
//     Package,
//     MessageSquare,
//     LogOut,
//     Building2,
//     Calendar
// } from 'lucide-react';
// import { useAuth } from '@/context/AuthContext';

// const NAV_ITEMS = [
//     { label: 'Dashboard', href: '/enterprise', icon: LayoutDashboard },
//     { label: 'Events', href: '/enterprise/events', icon: Calendar },
//     { label: 'Profile', href: '/enterprise/profile', icon: User },
//     { label: 'Products', href: '/enterprise/products', icon: Package },
//     { label: 'Requests', href: '/enterprise/product-requests', icon: MessageSquare },
// ];


// export default function EnterpriseLayout({
//     children,
// }: {
//     children: React.ReactNode;
// }) {
//     const pathname = usePathname();
//     const { logout, user } = useAuth();

//     return (
//         <div className="min-h-screen bg-zinc-50 flex">
//             {/* Sidebar */}
//             <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col sticky top-0 h-screen">
//                 <div className="p-6 border-b border-zinc-100">
//                     <div className="flex items-center gap-3">
//                         <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
//                             <Building2 size={24} />
//                         </div>
//                         <div>
//                             <h2 className="font-bold text-zinc-900 leading-tight">Enterprise</h2>
//                             <p className="text-xs text-zinc-500">Business Portal</p>
//                         </div>
//                     </div>
//                 </div>

//                 <nav className="flex-1 p-4 space-y-1">
//                     {NAV_ITEMS.map((item) => {
//                         const Icon = item.icon;
//                         const isActive = pathname === item.href;
//                         return (
//                             <Link
//                                 key={item.href}
//                                 href={item.href}
//                                 className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
//                                     ? 'bg-indigo-50 text-indigo-700 shadow-sm'
//                                     : 'text-zinc-600 hover:bg-zinc-50 hover:text-indigo-600'
//                                     }`}
//                             >
//                                 <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-zinc-400'} />
//                                 {item.label}
//                             </Link>
//                         );
//                     })}
//                 </nav>

//                 <div className="p-4 border-t border-zinc-100">
//                     <div className="bg-zinc-50 rounded-xl p-4 mb-4">
//                         <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Connected as</p>
//                         <p className="text-sm font-bold text-zinc-900 truncate">{user?.full_name}</p>
//                         <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
//                     </div>
//                     <button
//                         onClick={logout}
//                         className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
//                     >
//                         <LogOut size={18} />
//                         Sign Out
//                     </button>
//                 </div>
//             </aside>

//             {/* Main Content */}
//             <main className="flex-1 overflow-auto">
//                 <header className="h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-10 flex items-center justify-between px-8">
//                     <h1 className="text-lg font-bold text-zinc-900">
//                         {NAV_ITEMS.find(i => i.href === pathname)?.label || 'Enterprise Portal'}
//                     </h1>
//                 </header>
//                 <div className="p-8">
//                     {children}
//                 </div>
//             </main>
//         </div>
//     );
// }


// :::::::::::::::::::::::::::::::::::::::::::::::

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
    CreditCard,
    LogOut,
    Menu,
    X,
    ShieldCheck,
    User,
    Package,
    MessageSquare,
    Calendar,
    Bell
} from 'lucide-react';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/enterprise', icon: LayoutDashboard },
    { label: 'Events', href: '/enterprise/events', icon: Calendar },
    { label: 'Communications', href: '/enterprise/communications', icon: MessageSquare },
    { label: 'Leads', href: '/enterprise/leads', icon: Users },
    { label: 'Analytics', href: '/enterprise/analytics', icon: CreditCard },
    { label: 'Products', href: '/enterprise/products', icon: Package },
    { label: 'Profile', href: '/enterprise/profile', icon: User },
    { label: 'Notifications', href: '/enterprise/notifications', icon: Bell },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) router.push('/auth/login');
            else if (user?.role !== 'enterprise') router.push('/');
        }
    }, [isAuthenticated, user, isLoading, router]);

    if (isLoading || !isAuthenticated || user?.role !== 'enterprise') {
        return <LoadingState message="Loading..." />;
    }

    const initials = (user?.full_name || user?.email || 'AD')
        .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="min-h-screen bg-zinc-50">
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
                        <span className="text-base font-bold text-zinc-900">Enterprise Panel</span>
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
                                {label}
                            </Link>
                        );
                    })}
                </nav>

                {/* ── Footer: avatar + sign-out — pinned to bottom ─────── */}
                <div className="border-t border-zinc-200 px-3 py-4 flex-shrink-0 space-y-1">
                    {/* Avatar card */}
                    {/* <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 truncate">{user?.full_name || user?.email}</p>
                            <p className="text-xs text-zinc-500 capitalize">{user?.role}</p>
                        </div>
                    </div> */}
                    {/* Sign out */}
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
                    <span className="text-sm font-semibold text-zinc-900">Enterprise Panel</span>
                </header>

                <main className="flex-1 p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
