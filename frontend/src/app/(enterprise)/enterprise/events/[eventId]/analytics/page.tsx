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
    pulse: { hour: string; value: number }[];
}

interface Stand {
    id: string;
    name: string;
    event_id: string;
}

function mapDashboardToStandAnalytics(payload: any): StandAnalytics {
    const dashboard = payload?.dashboard ?? payload ?? {};
    const kpis = Array.isArray(dashboard.kpis) ? dashboard.kpis : [];
    const byLabel = new Map<string, number>();
    for (const k of kpis) {
        const key = String(k?.label || '').toLowerCase();
        byLabel.set(key, Number(k?.value || 0));
    }

    const totalVisits = byLabel.get('total visits') ?? byLabel.get('stand visits') ?? 0;
    const uniqueVisitors = byLabel.get('unique visitors') ?? 0;
    const distribution = dashboard?.distribution && typeof dashboard.distribution === 'object' ? dashboard.distribution : {};
    const interactionCount = Object.values(distribution).reduce((sum: number, v: any) => sum + Number(v || 0), 0);

    return {
        total_visits: Number(totalVisits || 0),
        unique_visitors: Number(uniqueVisitors || 0),
        interaction_count: Number(interactionCount || 0),
        interaction_breakdown: Object.fromEntries(
            Object.entries(distribution).map(([k, v]) => [k, Number(v || 0)])
        ),
        pulse: Array.isArray(dashboard.pulse_chart) ? dashboard.pulse_chart : [],
    };
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
    const [isForbidden, setIsForbidden] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        setIsForbidden(false);
        try {
            // 1. Fetch stand for this event
            const standData = await http.get<Stand>(`/enterprise/events/${eventId}/stand`);
            setStand(standData);

            // 2. Fetch live analytics for this stand (with fallback)
            try {
                const liveData = await http.get<any>(`/metrics/live/stands/${standData.id}`);
                setAnalytics(mapDashboardToStandAnalytics(liveData));
            } catch {
                const data = await http.get<any>(`/metrics/stand/${standData.id}`);
                setAnalytics(mapDashboardToStandAnalytics(data));
            }
        } catch (err: any) {
            console.error('Failed to fetch event analytics', err);
            if (err.status === 403) {
                setIsForbidden(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!eventId) return;
        fetchData();
        const interval = setInterval(fetchData, 20000);
        return () => clearInterval(interval);
    }, [eventId]);

    if (isLoading && !stand && !isForbidden) {
        return (
            <div className="h-[60vh] flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    if (isForbidden) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
                <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-8">
                    <Clock size={48} className="text-amber-500 animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 mb-4 tracking-tight">Analytics Pending</h2>
                <p className="text-zinc-500 max-w-md leading-relaxed mb-10">
                    Your stand analytics will be available once your participation is approved by the organizers.
                </p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push('/enterprise/events')}>
                        <ArrowLeft size={16} className="mr-2" /> Back to Events
                    </Button>
                    <Button onClick={() => fetchData()}>
                        <Loader2 size={16} className="mr-2" /> Refresh Status
                    </Button>
                </div>
            </div>
        );
    }

    const stats = analytics || { 
        total_visits: 0, 
        unique_visitors: 0, 
        interaction_count: 0, 
        interaction_breakdown: {},
        pulse: []
    };

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
                                {stats.pulse.length > 0 ? (
                                    stats.pulse.map((item, i) => {
                                        const maxVal = Math.max(...stats.pulse.map(p => p.value), 1);
                                        const h = (item.value / maxVal) * 100;
                                        return (
                                            <div key={`${item.hour}-${i}`} className="flex-1 group relative h-full flex items-end">
                                                <div
                                                    className={clsx(
                                                        "transition-all rounded-t-lg mx-auto w-full",
                                                        item.value > 0 ? "bg-emerald-500" : "bg-emerald-500/5"
                                                    )}
                                                    style={{ height: `${Math.max(h, 4)}%` }}
                                                    title={`${item.hour}: ${item.value} visits`}
                                                />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-bold">
                                                    {item.value}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-zinc-300 text-[10px] font-bold uppercase tracking-widest italic">
                                        No recent activity
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between border-t border-zinc-100 pt-4 px-2">
                                {stats.pulse.length > 0 ? (
                                    stats.pulse.filter((_, i) => i % 4 === 0).map((item, i) => (
                                        <span key={`${item.hour}-${i}`} className="text-[10px] font-bold text-zinc-400">{item.hour}</span>
                                    ))
                                ) : (
                                    ['00:00', '06:00', '12:00', '18:00', '00:00'].map((t, i) => (
                                        <span key={`${t}-${i}`} className="text-[10px] font-bold text-zinc-400">{t}</span>
                                    ))
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
