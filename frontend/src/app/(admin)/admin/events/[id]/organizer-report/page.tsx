'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
    AreaChart, Area,
} from 'recharts';
import {
    Users, Building2, BarChart2, MessageCircle,
    CalendarCheck, TrendingUp, ShieldAlert, DollarSign,
    Download, RefreshCw, AlertTriangle, CheckCircle2,
    Zap, Target,
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { OrganizerSummary } from '@/types/organizer';
import { formatInUserTZ } from '@/lib/timezone';

// ─── Animated counter ────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200): number {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (target === 0) { setVal(0); return; }
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setVal(target); clearInterval(timer); }
            else setVal(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return val;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
    label: string;
    value: number;
    suffix?: string;
    icon: React.ReactNode;
    colour: string;         // Tailwind bg class
    format?: 'number' | 'percent' | 'score' | 'currency';
}

function KpiCard({ label, value, icon, colour, format = 'number' }: KpiCardProps) {
    const { t } = useTranslation('admin');
    const animated = useCountUp(value);
    const display = (() => {
        switch (format) {
            case 'percent': return `${animated.toFixed(0)}%`;
            case 'score': return `${animated}/100`;
            case 'currency': return `${animated.toLocaleString()} ${t('admin.common.currency')}`;
            default: return animated.toLocaleString();
        }
    })();

    return (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow group">
            <div className={`absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity ${colour}`} />
            <div className="relative p-5 flex flex-col gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${colour}`}>
                    {icon}
                </div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold text-zinc-800">{display}</p>
            </div>
        </div>
    );
}

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
    return (
        <h2 className="text-base font-semibold text-zinc-800 flex items-center gap-2 mb-4">
            {children}
        </h2>
    );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

const ChartTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-zinc-100 shadow-lg rounded-xl px-3 py-2 text-sm">
            <p className="text-zinc-500 text-xs mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">{p.value} {p.name}</p>
            ))}
        </div>
    );
};

// ─── Revenue pie colours ──────────────────────────────────────────────────────

const REV_COLOURS = ['#6d28d9', '#10b981'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                ))}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OrganizerReportPage() {
    const { t } = useTranslation('admin');
    const { id: eventId } = useParams<{ id: string }>();
    const [data, setData] = useState<OrganizerSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError(null);
        try {
            const res = await adminService.getOrganizerSummary(eventId);
            setData(res);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load organizer report.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [eventId]);

    useEffect(() => { load(); }, [load]);

    // 30-second auto-refresh
    useEffect(() => {
        const t = setInterval(() => load(true), 30_000);
        return () => clearInterval(t);
    }, [load]);

    async function handleExport() {
        setExporting(true);
        try {
            await adminService.exportOrganizerSummaryPDF(eventId);
        } catch (e: any) {
            alert(e?.message ?? 'PDF export failed.');
        } finally {
            setExporting(false);
        }
    }

    if (loading) return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <DashboardSkeleton />
        </div>
    );

    if (error) return (
        <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400" />
            <p className="text-zinc-600 font-medium">{error}</p>
            <button onClick={() => load()} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors">
                Retry
            </button>
        </div>
    );

    if (!data) return null;

    const { overview: ov, safety, performance_trends: trends } = data;

    // Revenue pie data
    const revPie = [
        { name: 'Stand Revenue', value: ov.revenue_summary.stand_revenue },
        { name: 'Ticket Revenue', value: ov.revenue_summary.ticket_revenue },
    ].filter(d => d.value > 0);

    const generatedAt = formatInUserTZ(data.generated_at, { dateStyle: 'medium', timeStyle: 'short' }, 'en-US');

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">📊 Organizer Report</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        {t('admin.reports.description')} · Updated {generatedAt}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => load(true)}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-sm hover:bg-zinc-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
                    >
                        <Download className="w-4 h-4" />
                        {exporting ? 'Exporting…' : 'Export PDF'}
                    </button>
                </div>
            </div>

            {/* ── KPI Grid ── */}
            <section>
                <SectionHead><TrendingUp className="w-4 h-4 text-violet-500" /> {t('admin.reports.sections.keyMetrics')}</SectionHead>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <KpiCard label={t('admin.reports.kpi.totalVisitors')} value={ov.total_visitors} icon={<Users className="w-5 h-5" />} colour="bg-violet-600" format="number" />
                    <KpiCard label="Enterprise Rate" value={Math.round(ov.enterprise_participation_rate)} icon={<Building2 className="w-5 h-5" />} colour="bg-blue-600" format="percent" />
                    <KpiCard label="Engagement Score" value={Math.round(ov.stand_engagement_score)} icon={<BarChart2 className="w-5 h-5" />} colour="bg-indigo-500" format="score" />
                    <KpiCard label="Leads Generated" value={ov.leads_generated} icon={<TrendingUp className="w-5 h-5" />} colour="bg-emerald-600" format="number" />
                    <KpiCard label="Meetings Booked" value={ov.meetings_booked} icon={<CalendarCheck className="w-5 h-5" />} colour="bg-teal-600" format="number" />
                    <KpiCard label="Chat Interactions" value={ov.chat_interactions} icon={<MessageCircle className="w-5 h-5" />} colour="bg-cyan-600" format="number" />
                </div>
            </section>

            {/* ── Revenue Summary ── */}
            <section>
                <SectionHead><DollarSign className="w-4 h-4 text-emerald-500" /> {t('admin.reports.sections.revenuePerformance')}</SectionHead>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue Breakdown */}
                    <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                        <div className="space-y-6">
                            {[
                                { label: 'Ticket Revenue', value: ov.revenue_summary.ticket_revenue, icon: <CheckCircle2 className="w-4 h-4 text-violet-500" />, colour: 'text-violet-600', bg: 'bg-violet-50' },
                                { label: 'Stand Revenue', value: ov.revenue_summary.stand_revenue, icon: <Building2 className="w-4 h-4 text-emerald-500" />, colour: 'text-emerald-600', bg: 'bg-emerald-50' },
                            ].map(r => (
                                <div key={r.label} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg ${r.bg} flex items-center justify-center`}>{r.icon}</div>
                                        <span className="text-zinc-600 font-medium">{r.label}</span>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-xl ${r.colour}`}>{r.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} {t('admin.common.currency')}</p>
                                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">Verified Income</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-between items-end">
                            <div>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1">Total Gross Revenue</p>
                                <p className="text-4xl font-black text-zinc-900 tracking-tight">
                                    {ov.revenue_summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} {t('admin.common.currency')}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
                                    <TrendingUp className="w-3 h-3" /> +12% vs Event Avg
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Donut Chart */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col items-center justify-center relative group">
                        <div className="mb-4 text-center">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Revenue Mix</h3>
                        </div>
                        {revPie.length > 0 ? (
                            <div className="relative w-full h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={revPie} 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={60} 
                                            outerRadius={85}
                                            dataKey="value" 
                                            stroke="none" 
                                            paddingAngle={8}
                                        >
                                            {revPie.map((_, i) => <Cell key={i} fill={REV_COLOURS[i % REV_COLOURS.length]} className="hover:opacity-80 transition-opacity" />)}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(v: any) => `$${v.toFixed(2)}`} 
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Label */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Share</span>
                                    <span className="text-lg font-black text-zinc-800">Mix%</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-zinc-400 text-sm">No revenue data available yet.</p>
                        )}
                        <div className="mt-4 flex gap-4 text-[10px] font-bold uppercase tracking-tighter">
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#10b981]" /> Stand</div>
                            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#6d28d9]" /> Ticket</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Performance Trends ── */}
            <section>
                <SectionHead><BarChart2 className="w-4 h-4 text-blue-500" /> Performance Trends</SectionHead>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Visitors over time */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-hidden group">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-zinc-700">Visitors Over Time</h3>
                            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center">
                                <Users className="w-4 h-4 text-violet-500" />
                            </div>
                        </div>
                        {trends.visitors_over_time.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={trends.visitors_over_time} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTip />} />
                                    <Area type="monotone" dataKey="value" name="visitors" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorVis)" isAnimationActive={true} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm text-center py-8">No visitor data yet.</p>
                        )}
                    </div>

                    {/* Engagement over time */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-hidden group">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-zinc-700">Engagement Over Time</h3>
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                <Zap className="w-4 h-4 text-blue-500" />
                            </div>
                        </div>
                        {trends.engagement_over_time.length > 0 ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={trends.engagement_over_time} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorEng" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTip />} />
                                    <Area type="monotone" dataKey="value" name="events" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEng)" isAnimationActive={true} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm text-center py-8">No engagement data yet.</p>
                        )}
                    </div>
                </div>

                {/* Lead generation - Full Width */}
                <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm overflow-hidden group">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-zinc-700">{t('admin.reports.charts.leadGenPerformance')}</h3>
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Target className="w-4 h-4 text-emerald-500" />
                        </div>
                    </div>
                    {trends.lead_generation_over_time.length > 0 ? (
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={trends.lead_generation_over_time} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 500 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<ChartTip />} />
                                <Bar dataKey="value" name="leads" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} isAnimationActive={true} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-zinc-400 text-sm text-center py-8">No lead data yet.</p>
                    )}
                </div>
            </section>

            {/* ── Safety & Moderation ── */}
            <section>
                <SectionHead><ShieldAlert className="w-4 h-4 text-red-500" /> Safety & Moderation</SectionHead>
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col gap-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Total Flags</p>
                        <p className="text-4xl font-extrabold text-zinc-800">{safety.total_flags}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Resolved</p>
                        <p className="text-4xl font-extrabold text-emerald-600">{safety.resolved_flags}</p>
                    </div>
                    <div className="flex flex-col gap-3 justify-center">
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Resolution Rate</p>
                            <span className="text-sm font-bold text-zinc-700">{safety.resolution_rate.toFixed(1)}%</span>
                        </div>
                        <div className="relative w-full h-3 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                                style={{
                                    width: `${safety.resolution_rate}%`,
                                    background: safety.resolution_rate >= 80
                                        ? 'linear-gradient(90deg,#10b981,#059669)'
                                        : safety.resolution_rate >= 50
                                            ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                                            : 'linear-gradient(90deg,#ef4444,#dc2626)',
                                }}
                            />
                        </div>
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                            {safety.resolution_rate >= 80
                                ? <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Great moderation rate</>
                                : <><AlertTriangle className="w-3 h-3 text-amber-500" /> Some flags need attention</>
                            }
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
