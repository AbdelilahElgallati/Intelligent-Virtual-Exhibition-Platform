"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Link from 'next/link';
import { http } from '@/lib/http';
import {
    Package,
    MessageSquare,
    TrendingUp,
    BarChart3,
    Users,
    ArrowUpRight,
    Clock3,
    Calendar,
    ChevronRight,
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <Card className="border-zinc-200/80 bg-white/90 shadow-sm shadow-zinc-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="p-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-zinc-900">{value}</h3>
                    {trend && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-1.5 py-0.5 rounded">
                            <ArrowUpRight size={10} />
                            {trend}
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
                    <Icon size={20} />
                </div>
            </div>
        </CardContent>
    </Card>
);

export default function EnterpriseDashboardPage() {
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalRequests: 0,
        pendingRequests: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [productsData, requestsData] = await Promise.all([
                    http.get<any>('/enterprise/products'),
                    http.get<any[]>('/enterprise/product-requests'),
                ]);

                setStats({
                    totalProducts: productsData.total || 0,
                    totalRequests: requestsData.length || 0,
                    pendingRequests: requestsData.filter(r => r.status === 'PENDING').length || 0,
                });
            } catch (err) {
                console.error('Failed to fetch stats', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="overflow-hidden rounded-[28px] border border-indigo-100 bg-[linear-gradient(135deg,#111827_0%,#312e81_55%,#2563eb_100%)] p-6 text-white shadow-xl shadow-indigo-100 sm:p-8">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-indigo-200">Enterprise Workspace</p>
                        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Run a sharper, more credible exhibition presence.</h1>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
                            Track requests, manage event participation, and keep your commercial journey ready for live activity across desktop, tablet, and mobile.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:min-w-[340px]">
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                            <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Products</p>
                            <p className="mt-2 text-2xl font-bold">{stats.totalProducts}</p>
                        </div>
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                            <p className="text-xs uppercase tracking-[0.18em] text-indigo-200">Pending</p>
                            <p className="mt-2 text-2xl font-bold">{stats.pendingRequests}</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                <StatCard
                    title="Catalog Size"
                    value={stats.totalProducts}
                    icon={Package}
                    color="bg-indigo-600 shadow-indigo-200"
                    trend="+2 items"
                />
                <StatCard
                    title="Total Inquiries"
                    value={stats.totalRequests}
                    icon={MessageSquare}
                    color="bg-emerald-600 shadow-emerald-200"
                    trend="+50% vs last week"
                />
                <StatCard
                    title="Actions Needed"
                    value={stats.pendingRequests}
                    icon={Clock3}
                    color="bg-amber-600 shadow-amber-200"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.95fr]">
                <Card className="border-zinc-200">
                    <CardHeader className="border-b border-zinc-100 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Recent Performance</CardTitle>
                        <BarChart3 size={20} className="text-zinc-400" />
                    </CardHeader>
                    <CardContent className="p-8 text-center text-zinc-400">
                        <div className="h-48 flex items-center justify-center border-2 border-dashed border-zinc-100 rounded-2xl">
                            <div className="space-y-2">
                                <TrendingUp className="mx-auto text-zinc-200" size={40} />
                                <p className="text-sm">Traffic analytics will appear here as visitors interact with your catalog.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6">
                    <Card className="border-zinc-200 bg-white/90">
                        <CardHeader className="border-b border-zinc-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                            <ChevronRight size={18} className="text-zinc-300" />
                        </CardHeader>
                        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                            <Link href="/enterprise/events" className="rounded-2xl border border-zinc-200 p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/60">
                                <Calendar className="mb-3 h-5 w-5 text-indigo-600" />
                                <p className="text-sm font-semibold text-zinc-900">Manage events</p>
                                <p className="mt-1 text-xs text-zinc-500">Review participation, availability, and event access windows.</p>
                            </Link>
                            <Link href="/enterprise/communications" className="rounded-2xl border border-zinc-200 p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/60">
                                <MessageSquare className="mb-3 h-5 w-5 text-indigo-600" />
                                <p className="text-sm font-semibold text-zinc-900">Open communications</p>
                                <p className="mt-1 text-xs text-zinc-500">Stay current with B2B chat, incoming requests, and live follow-ups.</p>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="border-zinc-200">
                        <CardHeader className="border-b border-zinc-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Network Activity</CardTitle>
                            <Users size={20} className="text-zinc-400" />
                        </CardHeader>
                        <CardContent className="p-8 text-center text-zinc-400">
                            <div className="h-48 flex items-center justify-center rounded-2xl border-2 border-dashed border-zinc-100">
                                <div className="space-y-2">
                                    <Users className="mx-auto text-zinc-200" size={40} />
                                    <p className="text-sm">Networking goals and visitor match insights coming soon.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
