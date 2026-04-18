"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { http } from '@/lib/http';
import {
    BarChart3,
    Users,
    Eye,
    MousePointer2,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Calendar,
    TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';

interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}

interface StandAnalytics {
    total_visits: number;
    unique_visitors: number;
    interaction_count: number;
    interaction_breakdown: Record<string, number>;
    main_chart: TimeSeriesPoint[];
}

interface StandEntry {
    id: string;
    name: string;
    event_id: string;
    event_title: string;
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
        main_chart: Array.isArray(dashboard.main_chart) ? dashboard.main_chart.map((p: any) => ({
            timestamp: p.timestamp,
            value: Number(p.value || 0)
        })) : []
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

// Colour palette for breakdown bars
const BAR_COLORS = [
    'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
    'bg-rose-500', 'bg-sky-500',
];

export default function EnterpriseAnalyticsPage() {
    const { t } = useTranslation();
    const [stands, setStands] = useState<StandEntry[]>([]);
    const [analytics, setAnalytics] = useState<Record<string, StandAnalytics>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedStand, setSelectedStand] = useState<string>('all');

    const fetchData = async (quiet = false) => {
        if (quiet) setIsRefreshing(true); else setIsLoading(true);
        try {
            const events = await http.get<any[]>('/enterprise/events');
            const approvedEvents = events.filter(
                ev => ev.participation?.status === 'approved' || ev.participation?.status === 'guest_approved'
            );

            // Fetch each event's stand and attach the event title so the dropdown is meaningful
            const standEntriesRaw = await Promise.all(
                approvedEvents.map(async ev => {
                    try {
                        const s = await http.get<any>(`/enterprise/events/${ev.id || ev._id}/stand`);
                        return {
                            id: s.id || s._id,
                            name: s.name || t('enterprise.analytics.defaults.unnamedStand'),
                            event_id: ev.id || ev._id,
                            event_title: ev.title || t('enterprise.analytics.defaults.unnamedEvent'),
                        } as StandEntry;
                    } catch {
                        return null;
                    }
                })
            );
            const standEntries = standEntriesRaw.filter(Boolean) as StandEntry[];
            setStands(standEntries);

            const analyticsMap: Record<string, StandAnalytics> = {};
            await Promise.all(standEntries.map(async (s) => {
                try {
                    try {
                        const liveData = await http.get<any>(`/metrics/live/stands/${s.id}`);
                        analyticsMap[s.id] = mapDashboardToStandAnalytics(liveData);
                    } catch {
                        const data = await http.get<any>(`/metrics/stand/${s.id}`);
                        analyticsMap[s.id] = mapDashboardToStandAnalytics(data);
                    }
                } catch {
                    analyticsMap[s.id] = { total_visits: 0, unique_visitors: 0, interaction_count: 0, interaction_breakdown: {}, main_chart: [] };
                }
            }));
            setAnalytics(analyticsMap);

        } catch (err) {
            console.error('Failed to fetch analytics', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const aggregated = useMemo(() => {
        const values = Object.values(analytics);
        const result = values.reduce((acc, curr) => ({
            total_visits: acc.total_visits + curr.total_visits,
            unique_visitors: acc.unique_visitors + curr.unique_visitors,
            interaction_count: acc.interaction_count + curr.interaction_count,
            interaction_breakdown: acc.interaction_breakdown,
            main_chart: acc.main_chart,
        }), {
            total_visits: 0,
            unique_visitors: 0,
            interaction_count: 0,
            interaction_breakdown: {} as Record<string, number>,
            main_chart: [] as TimeSeriesPoint[],
        });

        values.forEach(a => {
            Object.entries(a.interaction_breakdown).forEach(([k, v]) => {
                result.interaction_breakdown[k] = (result.interaction_breakdown[k] || 0) + v;
            });
        });

        const chartMap = new Map<string, number>();
        values.forEach(a => {
            a.main_chart.forEach(p => {
                const day = p.timestamp.split('T')[0];
                chartMap.set(day, (chartMap.get(day) || 0) + p.value);
            });
        });
        result.main_chart = Array.from(chartMap.entries())
            .map(([ts, val]) => ({ timestamp: ts, value: val }))
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return result;
    }, [analytics]);

    const currentStats = selectedStand === 'all'
        ? aggregated
        : analytics[selectedStand] || { total_visits: 0, unique_visitors: 0, interaction_count: 0, interaction_breakdown: {}, main_chart: [] };

    const breakdownItems = Object.entries(currentStats.interaction_breakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const maxBreakdown = breakdownItems[0]?.[1] ?? 1;

    // Chart: take last 30 data points
    const chartData = currentStats.main_chart.slice(-30);
    const maxChartValue = Math.max(...chartData.map(p => p.value), 1);

    const selectedStandEntry = stands.find(s => s.id === selectedStand);

    if (isLoading) {
        return (
            <div className="text-center py-20">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">{t('enterprise.analytics.loading')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header + Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{t('enterprise.analytics.header.title')}</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">Real-time insights across your virtual exhibition presence.</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {/* Fixed: now shows event title + stand name for clarity */}
                    <select
                        className="bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 min-w-[200px]"
                        value={selectedStand}
                        onChange={e => setSelectedStand(e.target.value)}
                    >
                        <option value="all">📊 {t('enterprise.analytics.filters.combined')} ({stands.length} stands)</option>
                        {stands.map(s => (
                            <option key={s.id} value={s.id}>
                                🗂 {s.event_title} — {s.name}
                            </option>
                        ))}
                    </select>
                    <Button
                        variant="outline"
                        className="border-zinc-200 shadow-sm flex items-center gap-2"
                        onClick={() => fetchData(true)}
                        isLoading={isRefreshing}
                    >
                        <RefreshCw size={14} /> {t('enterprise.analytics.actions.refresh')}
                    </Button>
                </div>
            </div>

            {/* Currently selected context badge */}
            {selectedStand !== 'all' && selectedStandEntry && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl w-fit text-sm text-indigo-700 font-semibold">
                    <Calendar size={14} />
                    {t('enterprise.analytics.showing', { eventTitle: selectedStandEntry.event_title, standName: selectedStandEntry.name })}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                    title={t('enterprise.analytics.kpi.impressions')}
                    value={currentStats.total_visits}
                    subValue={t('enterprise.analytics.kpi.impressionsSub')}
                    icon={Eye}
                    color="bg-indigo-600"
                />
                <MetricCard
                    title={t('enterprise.analytics.kpi.engagement')}
                    value={currentStats.interaction_count}
                    subValue={t('enterprise.analytics.kpi.engagementSub')}
                    icon={MousePointer2}
                    color="bg-emerald-600"
                />
                <MetricCard
                    title={t('enterprise.analytics.kpi.uniqueLeads')}
                    value={currentStats.unique_visitors}
                    subValue={t('enterprise.analytics.kpi.uniqueLeadsSub')}
                    icon={Users}
                    color="bg-purple-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Interaction Breakdown */}
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader className="border-b border-zinc-100 bg-zinc-50/40 pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <MousePointer2 size={14} /> {t('enterprise.analytics.interactionBreakdown')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {breakdownItems.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-zinc-300 space-y-2">
                                <MousePointer2 size={36} />
                                <p className="text-xs italic text-zinc-400">{t('enterprise.analytics.noData')}</p>
                            </div>
                        ) : breakdownItems.map(([type, count], i) => {
                            const pct = currentStats.interaction_count > 0
                                ? Math.round((count / currentStats.interaction_count) * 100)
                                : 0;
                            return (
                                <div key={type} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-zinc-700 capitalize">
                                            {type.replace(/_/g, ' ')}
                                        </span>
                                        <span className="font-bold text-zinc-500">{count} <span className="text-zinc-400 font-normal">({pct}%)</span></span>
                                    </div>
                                    <div className="h-2.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                                            style={{ width: `${(count / maxBreakdown) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {breakdownItems.length > 0 && (
                            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                                <span>{t('enterprise.analytics.totalInteractions')}</span>
                                <span className="font-black text-zinc-900 text-lg">{currentStats.interaction_count}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Activity Trend Chart — FIXED */}
                <Card className="border-zinc-200 shadow-sm">
                    <CardHeader className="border-b border-zinc-100 bg-zinc-50/40 pb-3">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <TrendingUp size={14} /> {t('enterprise.analytics.activityTrend')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {chartData.length === 0 ? (
                            <div className="h-56 flex flex-col items-center justify-center text-zinc-300 space-y-2">
                                <BarChart3 size={36} />
                                <p className="text-xs italic text-zinc-400">{t('enterprise.analytics.insufficientData')}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {/* Fixed chart: relative container with explicit pixel height */}
                                <div className="relative h-48 flex items-end gap-[3px] px-1">
                                    {/* Y-axis guide lines */}
                                    {[100, 75, 50, 25].map(pct => (
                                        <div
                                            key={pct}
                                            className="absolute left-0 right-0 border-t border-dashed border-zinc-100"
                                            style={{ bottom: `${pct}%` }}
                                        />
                                    ))}
                                    {chartData.map((p, i) => {
                                        const barHeightPct = Math.max((p.value / maxChartValue) * 100, p.value > 0 ? 2 : 0);
                                        return (
                                            <div
                                                key={i}
                                                className="flex-1 relative group flex flex-col justify-end"
                                                style={{ height: '100%' }}
                                            >
                                                {/* Bar */}
                                                <div
                                                    className="w-full rounded-t-sm bg-indigo-500/20 group-hover:bg-indigo-600 transition-all duration-200"
                                                    style={{ height: `${barHeightPct}%` }}
                                                />
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 text-white text-[9px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap shadow-xl pointer-events-none">
                                                    <p className="font-bold">{t('enterprise.analytics.views', { count: p.value })}</p>
                                                    <p className="text-white/60">{p.timestamp.split('T')[0]}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* X-axis labels */}
                                <div className="flex justify-between border-t border-zinc-100 pt-2 px-1">
                                    <span className="text-[10px] font-semibold text-zinc-400">
                                        {chartData[0]?.timestamp?.split('T')[0] || t('enterprise.analytics.labels.thirtyDaysAgo')}
                                    </span>
                                    <span className="text-[10px] font-semibold text-zinc-400">{t('enterprise.analytics.labels.today')}</span>
                                </div>
                                {/* Summary Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-indigo-50 rounded-xl p-3 text-center">
                                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">{t('enterprise.analytics.peakDay')}</p>
                                        <p className="text-lg font-black text-indigo-700">{Math.max(...chartData.map(p => p.value))}</p>
                                    </div>
                                    <div className="bg-zinc-50 rounded-xl p-3 text-center">
                                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">{t('enterprise.analytics.dailyAvg')}</p>
                                        <p className="text-lg font-black text-zinc-700">
                                            {chartData.length > 0 ? Math.round(chartData.reduce((a, p) => a + p.value, 0) / chartData.length) : 0}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* No stands message */}
            {stands.length === 0 && (
                <div className="text-center py-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                    <BarChart3 className="mx-auto text-zinc-200 mb-3" size={40} />
                    <h3 className="font-bold text-zinc-700 mb-1">{t('enterprise.analytics.empty.title')}</h3>
                    <p className="text-sm text-zinc-500">{t('enterprise.analytics.empty.subtitle')}</p>
                </div>
            )}
        </div>
    );
}
