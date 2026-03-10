"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { http } from '@/lib/http';
import {
    BarChart3,
    TrendingUp,
    Users,
    Eye,
    MessageSquare,
    MousePointer2,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ArrowLeft,
    Clock,
    Loader2
} from 'lucide-react';
import clsx from 'clsx';

interface StandAnalytics {
    total_visits: number;
    unique_visitors: number;
    interaction_count: number;
    interaction_breakdown: Record<string, number>;
}

interface Stand {
    id: string;
    name: string;
    event_id: string;
}

const MetricCard = ({ title, value, subValue, icon: Icon, trend, color }: any) => (
    <Card className="border-zinc-200 shadow-sm overflow-hidden group">
        <div className={`h-1 w-full ${color}`} />
        <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${color} bg-opacity-10 text-zinc-900 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} />
                </div>
                {trend != null && (
                    <div className={clsx(
                        "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                        trend >= 0 ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"
                    )}>
                        {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-zinc-900">
                        {isNaN(Number(value)) ? 0 : value}
                    </h3>
                    {subValue && <span className="text-xs text-zinc-400 font-medium">{subValue}</span>}
                </div>
            </div>
        </CardContent>
    </Card>
);

export default function EventAnalyticsPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.eventId as string;

    const [stand, setStand] = useState<Stand | null>(null);
    const [analytics, setAnalytics] = useState<StandAnalytics | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch stand for this event
            const standData = await http.get<Stand>(`/enterprise/events/${eventId}/stand`);
            setStand(standData);

            // 2. Fetch Analytics for this stand
            const data = await http.get<StandAnalytics>(`/analytics/stand/${standData.id}`);
            setAnalytics(data);
        } catch (err) {
            console.error('Failed to fetch event analytics', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { if (eventId) fetchData(); }, [eventId]);

    if (isLoading && !stand) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    const stats = analytics || { total_visits: 0, unique_visitors: 0, interaction_count: 0, interaction_breakdown: {} };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
                            {stand?.name} Analytics
                        </h2>
                        <p className="text-sm text-zinc-500">Performance insights for this specific event.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <Clock size={16} />
                    </Button>
                    <Button size="sm" onClick={() => router.push(`/enterprise/events/${eventId}/manage`)}>
                        Manage Hub
                    </Button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Impressions"
                    value={stats.total_visits}
                    subValue="Total Views"
                    icon={Eye}
                    trend={8}
                    color="bg-indigo-600"
                />
                <MetricCard
                    title="Engagement"
                    value={stats.interaction_count}
                    subValue="Interactions"
                    icon={MousePointer2}
                    trend={4}
                    color="bg-emerald-600"
                />
                <MetricCard
                    title="Unique Leads"
                    value={stats.unique_visitors}
                    subValue="Visitors"
                    icon={Users}
                    trend={-1}
                    color="bg-purple-600"
                />
            </div>

            {/* Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-zinc-200">
                    <CardHeader className="border-b border-zinc-50 bg-zinc-50/30">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Interaction Status</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-48 h-48 rounded-full border-8 border-emerald-50 flex items-center justify-center relative">
                            <div className="text-center">
                                <p className="text-3xl font-black text-zinc-900">{stats.interaction_count}</p>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">Actions</p>
                            </div>
                            <div className="absolute inset-0 rounded-full border-8 border-emerald-500 border-t-transparent animate-pulse-slow" />
                        </div>
                        <p className="text-xs text-zinc-500 max-w-[200px]">Total interactions captured at your stand during this event.</p>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200">
                    <CardHeader className="border-b border-zinc-50 bg-zinc-50/30">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Real-time Visitor Pulse</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-64 flex flex-col justify-between">
                            <div className="flex items-end justify-between h-full gap-2 px-4 pb-4">
                                {[20, 35, 65, 40, 80, 55, 30].map((h, i) => (
                                    <div key={i} className="flex-1 group relative">
                                        <div
                                            className="bg-emerald-600/10 group-hover:bg-emerald-600 transition-all rounded-t-lg mx-auto w-full"
                                            style={{ height: `${h}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between border-t border-zinc-100 pt-4 px-2">
                                {['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'].map(t => (
                                    <span key={t} className="text-[10px] font-bold text-zinc-400">{t}</span>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
