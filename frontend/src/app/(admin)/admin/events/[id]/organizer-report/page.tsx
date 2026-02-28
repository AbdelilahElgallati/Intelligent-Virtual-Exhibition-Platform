'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from 'recharts';
import {
    Users, Building2, BarChart2, MessageCircle,
    CalendarCheck, TrendingUp, ShieldAlert, DollarSign,
    Download, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { OrganizerSummary } from '@/types/organizer';

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
    const animated = useCountUp(value);
    const display = (() => {
        switch (format) {
            case 'percent': return `${animated.toFixed(0)}%`;
            case 'score': return `${animated}/100`;
            case 'currency': return `$${animated.toLocaleString()}`;
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

    const generatedAt = new Date(data.generated_at).toLocaleString('en-US', {
        dateStyle: 'medium', timeStyle: 'short',
    });

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">📊 Organizer Report</h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Business intelligence & event performance · Updated {generatedAt}
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
                <SectionHead><TrendingUp className="w-4 h-4 text-violet-500" /> Key Metrics</SectionHead>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <KpiCard label="Total Visitors" value={ov.total_visitors} icon={<Users className="w-5 h-5" />} colour="bg-violet-600" format="number" />
                    <KpiCard label="Enterprise Rate" value={Math.round(ov.enterprise_participation_rate)} icon={<Building2 className="w-5 h-5" />} colour="bg-blue-600" format="percent" />
                    <KpiCard label="Engagement Score" value={Math.round(ov.stand_engagement_score)} icon={<BarChart2 className="w-5 h-5" />} colour="bg-indigo-500" format="score" />
                    <KpiCard label="Leads Generated" value={ov.leads_generated} icon={<TrendingUp className="w-5 h-5" />} colour="bg-emerald-600" format="number" />
                    <KpiCard label="Meetings Booked" value={ov.meetings_booked} icon={<CalendarCheck className="w-5 h-5" />} colour="bg-teal-600" format="number" />
                    <KpiCard label="Chat Interactions" value={ov.chat_interactions} icon={<MessageCircle className="w-5 h-5" />} colour="bg-cyan-600" format="number" />
                </div>
            </section>

            {/* ── Revenue Summary ── */}
            <section>
                <SectionHead><DollarSign className="w-4 h-4 text-emerald-500" /> Revenue</SectionHead>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Revenue cards */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
                        {[
                            { label: 'Ticket Revenue', value: ov.revenue_summary.ticket_revenue, colour: 'text-violet-600' },
                            { label: 'Stand Revenue', value: ov.revenue_summary.stand_revenue, colour: 'text-emerald-600' },
                        ].map(r => (
                            <div key={r.label} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0">
                                <span className="text-zinc-600 text-sm">{r.label}</span>
                                <span className={`font-bold text-lg ${r.colour}`}>${r.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                            </div>
                        ))}
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-semibold text-zinc-800">Total Revenue</span>
                            <span className="font-extrabold text-xl text-zinc-900">
                                ${ov.revenue_summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                    {/* Pie chart */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm flex flex-col items-center justify-center">
                        {revPie.length > 0 ? (
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie data={revPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                        dataKey="value" stroke="none" paddingAngle={3}>
                                        {revPie.map((_, i) => <Cell key={i} fill={REV_COLOURS[i % REV_COLOURS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm">No revenue data available yet.</p>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Performance Trends ── */}
            <section>
                <SectionHead><BarChart2 className="w-4 h-4 text-blue-500" /> Performance Trends</SectionHead>
                <div className="grid grid-cols-1 gap-6">

                    {/* Visitors over time */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-4">Visitors Over Time</h3>
                        {trends.visitors_over_time.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={trends.visitors_over_time}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" allowDecimals={false} />
                                    <Tooltip content={<ChartTip />} />
                                    <Line type="monotone" dataKey="value" name="visitors" stroke="#6d28d9" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm text-center py-8">No visitor data yet.</p>
                        )}
                    </div>

                    {/* Engagement over time */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-4">Engagement Over Time</h3>
                        {trends.engagement_over_time.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={trends.engagement_over_time}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" allowDecimals={false} />
                                    <Tooltip content={<ChartTip />} />
                                    <Line type="monotone" dataKey="value" name="events" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm text-center py-8">No engagement data yet.</p>
                        )}
                    </div>

                    {/* Lead generation */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                        <h3 className="text-sm font-semibold text-zinc-700 mb-4">Lead Generation Over Time</h3>
                        {trends.lead_generation_over_time.length > 0 ? (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={trends.lead_generation_over_time}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a1a1aa" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="#a1a1aa" allowDecimals={false} />
                                    <Tooltip content={<ChartTip />} />
                                    <Bar dataKey="value" name="leads" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-zinc-400 text-sm text-center py-8">No lead data yet.</p>
                        )}
                    </div>
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
