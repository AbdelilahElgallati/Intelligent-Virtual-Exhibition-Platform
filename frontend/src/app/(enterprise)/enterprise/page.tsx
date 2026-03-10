"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { http } from '@/lib/http';
import {
    Package,
    MessageSquare,
    TrendingUp,
    BarChart3,
    Users,
    ArrowUpRight
} from 'lucide-react';
import { Container } from '@/components/common/Container';

const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
    <Card className="border-zinc-200 shadow-sm shadow-zinc-100 hover:shadow-md transition-shadow">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    icon={Clock}
                    color="bg-amber-600 shadow-amber-200"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

                <Card className="border-zinc-200">
                    <CardHeader className="border-b border-zinc-100 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Network Activity</CardTitle>
                        <Users size={20} className="text-zinc-400" />
                    </CardHeader>
                    <CardContent className="p-8 text-center text-zinc-400">
                        <div className="h-48 flex items-center justify-center border-2 border-dashed border-zinc-100 rounded-2xl">
                            <div className="space-y-2">
                                <Users className="mx-auto text-zinc-200" size={40} />
                                <p className="text-sm">Networking goals and visitor match insights coming soon.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const Clock = ({ size, className }: any) => (
    <div className={className}>
        <TrendingUp size={size} />
    </div>
);
