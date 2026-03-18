"use client";

import React, { useState, useEffect } from 'react';
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
    Globe,
    Clock
} from 'lucide-react';
import { Container } from '@/components/common/Container';

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

import clsx from 'clsx';

export default function EnterpriseAnalyticsPage() {
    const [stands, setStands] = useState<Stand[]>([]);
    const [analytics, setAnalytics] = useState<Record<string, StandAnalytics>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStand, setSelectedStand] = useState<string>('all');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Events
            const events = await http.get<any[]>('/enterprise/events');
            const approvedEvents = events.filter(
                ev => ev.participation?.status === 'approved' || ev.participation?.status === 'guest_approved'
            );

            // 2. Fetch stands
            const standPromises = approvedEvents.map(ev =>
                http.get<Stand>(`/enterprise/events/${ev.id || ev._id}/stand`).catch(() => null)
            );
            const standResults = (await Promise.all(standPromises)).filter(s => s !== null) as Stand[];
            setStands(standResults);

            // 3. Fetch Analytics for each stand
            const analyticsMap: Record<string, StandAnalytics> = {};
            await Promise.all(standResults.map(async (s) => {
                try {
                    try {
                        const liveData = await http.get<any>(`/analytics/live/stands/${s.id}`);
                        analyticsMap[s.id] = mapDashboardToStandAnalytics(liveData);
                    } catch {
                        const data = await http.get<any>(`/analytics/stand/${s.id}`);
                        analyticsMap[s.id] = mapDashboardToStandAnalytics(data);
                    }
                } catch (e) {
                    analyticsMap[s.id] = { total_visits: 0, unique_visitors: 0, interaction_count: 0, interaction_breakdown: {} };
                }
            }));
            setAnalytics(analyticsMap);

        } catch (err) {
            console.error('Failed to fetch analytics', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Aggregate stats
    const aggregated = Object.values(analytics).reduce((acc, curr) => ({
        total_visits: acc.total_visits + curr.total_visits,
        unique_visitors: acc.unique_visitors + curr.unique_visitors,
        interaction_count: acc.interaction_count + curr.interaction_count,
    }), { total_visits: 0, unique_visitors: 0, interaction_count: 0 });

    const currentStats = selectedStand === 'all'
        ? aggregated
        : analytics[selectedStand] || { total_visits: 0, unique_visitors: 0, interaction_count: 0 };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Stand Performance</h2>
                    <p className="text-sm text-zinc-500">Real-time insights across your virtual exhibition presence.</p>
                </div>
                <div className="flex gap-3">
                    <select
                        className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedStand}
                        onChange={e => setSelectedStand(e.target.value)}
                    >
                        <option value="all">Combined Overview</option>
                        {stands.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <Button variant="outline" className="border-zinc-200 shadow-sm" onClick={fetchData}>
                        <Clock size={16} />
                    </Button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title="Impressions"
                    value={currentStats.total_visits}
                    subValue="Total Views"
                    icon={Eye}
                    trend={12}
                    color="bg-indigo-600"
                />
                <MetricCard
                    title="Engagement"
                    value={currentStats.interaction_count}
                    subValue="Interactions"
                    icon={MousePointer2}
                    trend={5}
                    color="bg-emerald-600"
                />
                <MetricCard
                    title="Unique Leads"
                    value={currentStats.unique_visitors}
                    subValue="Visitors"
                    icon={Users}
                    trend={-2}
                    color="bg-purple-600"
                />
            </div>

            {/* Charts Section Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader className="border-b border-zinc-50 bg-zinc-50/30">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Interaction Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-48 h-48 rounded-full border-8 border-indigo-50 flex items-center justify-center relative">
                            <div className="text-center">
                                <p className="text-3xl font-black text-zinc-900">{currentStats.interaction_count}</p>
                                <p className="text-[10px] text-zinc-400 font-bold uppercase">Total</p>
                            </div>
                            {/* Simple visual indicator */}
                            <div className="absolute inset-0 rounded-full border-8 border-indigo-500 border-t-transparent animate-pulse-slow" />
                        </div>
                        <div className="grid grid-cols-2 gap-8 w-full max-w-xs mt-6">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-xs font-bold text-zinc-600">Chats</span>
                                </div>
                                <p className="text-lg font-black text-zinc-900">42%</p>
                            </div>
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-xs font-bold text-zinc-600">Product Inquiries</span>
                                </div>
                                <p className="text-lg font-black text-zinc-900">38%</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader className="border-b border-zinc-50 bg-zinc-50/30">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500">Visitors Over Time</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="h-64 flex flex-col justify-between">
                            <div className="flex items-end justify-between h-full gap-2 px-4 pb-4">
                                {[30, 45, 25, 60, 75, 50, 40].map((h, i) => (
                                    <div key={i} className="flex-1 group relative">
                                        <div
                                            className="bg-indigo-600/10 group-hover:bg-indigo-600 transition-all rounded-t-lg mx-auto w-Full"
                                            style={{ height: `${h}%` }}
                                        />
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                            {h + 10} views
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between border-t border-zinc-100 pt-4 px-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <span key={d} className="text-[10px] font-bold text-zinc-400 uppercase">{d}</span>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
