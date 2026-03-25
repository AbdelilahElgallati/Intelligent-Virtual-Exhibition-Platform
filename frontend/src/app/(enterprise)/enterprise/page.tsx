"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { http } from '@/lib/http';
import { formatInUserTZ } from '@/lib/timezone';
import {
    Package,
    MessageSquare,
    Calendar,
    ChevronRight,
    Users,
    BarChart3,
    TrendingUp,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    Settings,
    Eye,
    Zap,
    Globe,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, color, sub, href }: any) {
    const inner = (
        <div className={`relative overflow-hidden rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${href ? 'cursor-pointer' : ''}`}>
            <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-10 ${color}`} />
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{title}</p>
                    <h3 className="mt-2 text-4xl font-black text-zinc-900">{value ?? '—'}</h3>
                    {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
                </div>
                <div className={`rounded-2xl p-3.5 ${color} text-white shadow-lg`}>
                    <Icon size={22} />
                </div>
            </div>
            {href && (
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-indigo-600">
                    View details <ChevronRight size={13} />
                </div>
            )}
        </div>
    );
    return href ? <Link href={href}>{inner}</Link> : inner;
}

function QuickLink({ href, icon: Icon, label, desc, color }: any) {
    return (
        <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-100">
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${color} text-white shadow-md transition-transform group-hover:scale-110`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <p className="font-semibold text-zinc-900 text-sm">{label}</p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{desc}</p>
            </div>
            <ArrowUpRight size={15} className="ml-auto text-zinc-300 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
        </Link>
    );
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
    approved:       { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    guest_approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending_payment:{ label: 'Pay Fee',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending_admin_approval: { label: 'Awaiting', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    rejected:       { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EnterpriseDashboardPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [prodData, evData, reqData, profData] = await Promise.allSettled([
                    http.get<any>('/enterprise/products'),
                    http.get<any[]>('/enterprise/events'),
                    http.get<any[]>('/enterprise/product-requests'),
                    http.get<any>('/enterprise/profile'),
                ]);

                if (prodData.status === 'fulfilled') setProducts(prodData.value?.products || []);
                if (evData.status === 'fulfilled') setEvents(Array.isArray(evData.value) ? evData.value : []);
                if (reqData.status === 'fulfilled') setRequests(Array.isArray(reqData.value) ? reqData.value : []);
                if (profData.status === 'fulfilled') setProfile(profData.value);
            } catch (e) {
                console.error('Dashboard load error', e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // Derived stats
    const myEvents = events.filter(ev => ev.participation);
    const approvedEvents = myEvents.filter(ev =>
        ev.participation?.status === 'approved' || ev.participation?.status === 'guest_approved'
    );
    const pendingRequests = requests.filter(r => r.status === 'PENDING');
    const liveEvents = myEvents.filter(ev => ev.state === 'live');
    const upcomingEvents = myEvents.filter(ev => ev.state === 'approved' || ev.state === 'payment_done');
    const serviceCount = products.filter(p => p.type === 'service').length;
    const productCount = products.filter(p => p.type !== 'service').length;

    const orgName = profile?.name || profile?.organization_name || 'Your Enterprise';
    const totalStands = approvedEvents.length;

    // Recent events to show in the panel (latest 4)
    const recentEvents = [...myEvents]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 4);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── Hero Banner ─────────────────────────────────────────── */}
            <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#4f46e5_100%)] p-8 text-white shadow-2xl shadow-indigo-900/20">
                {/* Decorative blobs */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 right-48 h-48 w-48 rounded-full bg-purple-500/20 blur-2xl" />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">Enterprise Workspace</p>
                        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                            Welcome back,{' '}
                            <span className="text-indigo-300">{orgName}</span>
                        </h1>
                        <p className="mt-2 text-sm leading-6 text-indigo-200 max-w-xl">
                            You have <strong className="text-white">{totalStands} active stand{totalStands !== 1 ? 's' : ''}</strong>, <strong className="text-white">{products.length} catalog items</strong>, and <strong className="text-white">{pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}</strong> awaiting your attention.
                        </p>
                    </div>
                    {/* Live / Upcoming pills */}
                    <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
                        <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-sm font-bold">{liveEvents.length} Live</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
                            <Calendar size={14} className="text-indigo-300" />
                            <span className="text-sm font-bold">{upcomingEvents.length} Upcoming</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── KPI Row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatCard
                    title="Catalog Items"
                    value={products.length}
                    icon={Package}
                    color="bg-indigo-600"
                    sub={`${productCount} products · ${serviceCount} services`}
                    href="/enterprise/products"
                />
                <StatCard
                    title="Active Stands"
                    value={totalStands}
                    icon={Globe}
                    color="bg-emerald-600"
                    sub={`across ${myEvents.length} event${myEvents.length !== 1 ? 's' : ''}`}
                    href="/enterprise/events"
                />
                <StatCard
                    title="Pending Requests"
                    value={pendingRequests.length}
                    icon={Clock}
                    color="bg-amber-500"
                    sub={`${requests.length} total inquiries`}
                    href="/enterprise/product-requests"
                />
                <StatCard
                    title="Total Inquiries"
                    value={requests.length}
                    icon={MessageSquare}
                    color="bg-purple-600"
                    sub={`${requests.length - pendingRequests.length} handled`}
                    href="/enterprise/product-requests"
                />
            </div>

            {/* ── Middle Row: Events + Quick Actions ──────────────────── */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.9fr]">

                {/* Recent Event Participations */}
                <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-500" />
                            <h2 className="font-bold text-zinc-900 text-sm">My Event Participations</h2>
                        </div>
                        <Link href="/enterprise/events" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            View all <ChevronRight size={13} />
                        </Link>
                    </div>
                    {recentEvents.length === 0 ? (
                        <div className="py-16 text-center text-zinc-400">
                            <Globe size={36} className="mx-auto mb-3 text-zinc-200" />
                            <p className="text-sm font-medium">No event participations yet</p>
                            <Link href="/enterprise/events" className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold">
                                Browse events <ArrowUpRight size={12} />
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-50">
                            {recentEvents.map(ev => {
                                const evId = ev.id || ev._id;
                                const s = ev.participation?.status;
                                const style = STATUS_STYLE[s] || { label: s || 'Unknown', cls: 'bg-zinc-50 text-zinc-500 border-zinc-200' };
                                const isApproved = s === 'approved' || s === 'guest_approved';
                                const isLive = ev.state === 'live';
                                return (
                                    <div key={evId} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50/60 transition-colors group">
                                        {/* Status dot */}
                                        <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${isLive ? 'bg-emerald-500 shadow-sm shadow-emerald-300 animate-pulse' : isApproved ? 'bg-indigo-500' : 'bg-zinc-300'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-zinc-900 text-sm truncate">{ev.title}</p>
                                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                                <Calendar size={10} />
                                                {ev.start_date ? formatInUserTZ(ev.start_date, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-GB') : 'TBD'}
                                            </p>
                                        </div>
                                        <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.cls}`}>
                                            {style.label}
                                        </span>
                                        {isApproved && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link href={`/enterprise/events/${evId}/stand`} title="Configure Stand">
                                                    <div className="p-1.5 rounded-lg hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600 transition-colors">
                                                        <Settings size={13} />
                                                    </div>
                                                </Link>
                                                <Link href={`/enterprise/events/${evId}/analytics`} title="Analytics">
                                                    <div className="p-1.5 rounded-lg hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600 transition-colors">
                                                        <BarChart3 size={13} />
                                                    </div>
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-6">
                    {/* Quick Actions */}
                    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-zinc-100">
                            <Zap size={15} className="text-amber-500" />
                            <h2 className="font-bold text-zinc-900 text-sm">Quick Actions</h2>
                        </div>
                        <div className="p-4 grid gap-2">
                            <QuickLink href="/enterprise/events" icon={Calendar} label="Browse Events" desc="Join new events & manage stands" color="bg-indigo-600" />
                            <QuickLink href="/enterprise/products" icon={Package} label="Manage Catalog" desc="Add products & services" color="bg-emerald-600" />
                            <QuickLink href="/enterprise/analytics" icon={BarChart3} label="View Analytics" desc="Stand performance & visitor data" color="bg-purple-600" />
                            <QuickLink href="/enterprise/communications" icon={MessageSquare} label="Communications" desc="B2B chat & follow-ups" color="bg-blue-600" />
                            <QuickLink href="/enterprise/leads" icon={Users} label="Leads & Contacts" desc="Visitor interactions & leads" color="bg-rose-500" />
                        </div>
                    </div>

                    {/* Pending Requests alert */}
                    {pendingRequests.length > 0 && (
                        <Link href="/enterprise/product-requests">
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow text-white">
                                    <AlertCircle size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-amber-900 text-sm">{pendingRequests.length} Request{pendingRequests.length !== 1 ? 's' : ''} Awaiting Response</p>
                                    <p className="text-xs text-amber-700 mt-0.5">Visitors are enquiring about your products. Respond promptly to convert leads.</p>
                                    <p className="mt-2 text-xs font-bold text-amber-600 flex items-center gap-1">Handle now <ArrowUpRight size={12} /></p>
                                </div>
                            </div>
                        </Link>
                    )}

                    {/* All caught up */}
                    {pendingRequests.length === 0 && requests.length > 0 && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-center gap-4 shadow-sm">
                            <div className="flex-shrink-0 w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow text-white">
                                <CheckCircle2 size={18} />
                            </div>
                            <div>
                                <p className="font-bold text-emerald-900 text-sm">All caught up!</p>
                                <p className="text-xs text-emerald-700 mt-0.5">{requests.length} inquir{requests.length > 1 ? 'ies' : 'y'} handled. Great work.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Performance Snapshot ─────────────────────────────────── */}
            <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-indigo-500" />
                        <h2 className="font-bold text-zinc-900 text-sm">Catalog Health</h2>
                    </div>
                    <Link href="/enterprise/products" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                        Manage <ChevronRight size={13} />
                    </Link>
                </div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                        <Package size={20} className="mx-auto text-indigo-500 mb-2" />
                        <p className="text-2xl font-black text-indigo-900">{productCount}</p>
                        <p className="text-xs text-indigo-600 font-semibold mt-1">Products</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-amber-50 border border-amber-100">
                        <Zap size={20} className="mx-auto text-amber-500 mb-2" />
                        <p className="text-2xl font-black text-amber-900">{serviceCount}</p>
                        <p className="text-xs text-amber-600 font-semibold mt-1">Services</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <Eye size={20} className="mx-auto text-emerald-500 mb-2" />
                        <p className="text-2xl font-black text-emerald-900">{totalStands}</p>
                        <p className="text-xs text-emerald-600 font-semibold mt-1">Active Stands</p>
                    </div>
                    <div className="text-center p-4 rounded-2xl bg-purple-50 border border-purple-100">
                        <MessageSquare size={20} className="mx-auto text-purple-500 mb-2" />
                        <p className="text-2xl font-black text-purple-900">{requests.length}</p>
                        <p className="text-xs text-purple-600 font-semibold mt-1">Inquiries</p>
                    </div>
                </div>
            </div>

        </div>
    );
}
