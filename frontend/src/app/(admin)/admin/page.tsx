'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
    BarChart3, Users, CalendarCheck, TrendingUp,
    ArrowRight, RefreshCw, Download, FileText,
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { adminService } from '@/services/admin.service';
import { DashboardData, RecentActivity } from '@/types/analytics';
import { OrganizerEvent } from '@/types/event';
import { useAuth } from '@/context/AuthContext';
import { getUserTimezone, formatInUserTZ } from '@/lib/timezone';

// ── Palette ──────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// ── Small helpers ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, accent }: {
    label: string; value: string | number; icon: any; accent: string;
}) {
    return (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-zinc-900 mt-0.5">{value}</p>
            </div>
        </div>
    );
}

const STATE_BADGE: Record<string, string> = {
    live: 'bg-green-50 text-green-700 border border-green-200',
    pending_approval: 'bg-amber-50 text-amber-700 border border-amber-200',
    approved: 'bg-blue-50 text-blue-700 border border-blue-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
    closed: 'bg-zinc-100 text-zinc-500 border border-zinc-200',
    payment_done: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    waiting_for_payment: 'bg-orange-50 text-orange-700 border border-orange-200',
};

export default function AdminAnalyticsPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const userTimezone = mounted ? (user?.timezone || getUserTimezone()) : 'UTC';

    const [data, setData] = useState<DashboardData | null>(null);
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportCsvLoading, setExportCsvLoading] = useState(false);
    const [exportError, setExportError] = useState('');
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [analytics, eventsData] = await Promise.all([
                adminService.getPlatformAnalytics(),
                adminService.getEvents(),
            ]);
            setData(analytics);
            setEvents(eventsData.events.slice(0, 10));
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('admin.analytics.failedToLoad'));
        } finally {
            setLoading(false);
        }
    };

    const handleExportReport = async () => {
        setExportError('');
        setExportLoading(true);
        try {
            await adminService.exportPlatformReportPDF();
        } catch (e: unknown) {
            console.error('Platform export failed', e);
            setExportError(e instanceof Error ? e.message : t('admin.organizerReport.export.exportFailed'));
        } finally {
            setExportLoading(false);
        }
    };

    const handleExportCsv = async () => {
        setExportError('');
        setExportCsvLoading(true);
        try {
            await adminService.exportPlatformReportCSV();
        } catch (e: unknown) {
            console.error('Platform CSV export failed', e);
            setExportError(e instanceof Error ? e.message : t('admin.organizerReport.export.exportFailed'));
        } finally {
            setExportCsvLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    // KPI lookup helpers
    const kpi = (label: string) => data?.kpis.find(k => k.label === label)?.value ?? 0;

    // Chart data
    const chartData = (data?.main_chart ?? []).map(p => ({
        date: p.timestamp.slice(5, 10), // MM-DD
        count: p.value,
    }));

    const pieData = Object.entries(data?.distribution ?? {}).map(([name, value]) => ({ name, value }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">{t('admin.analytics.title')}</h1>
                        <p className="text-zinc-500 text-sm mt-0.5">{t('admin.analytics.description')}</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={handleExportReport}
                        disabled={exportLoading || exportCsvLoading}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-900 text-white hover:bg-black transition-colors disabled:opacity-50"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {exportLoading ? t('admin.analytics.export.generating') : t('admin.analytics.export.exportPdf')}
                    </button>
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        disabled={exportLoading || exportCsvLoading}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                    >
                        <FileText className="w-3.5 h-3.5" />
                        {exportCsvLoading ? t('admin.analytics.export.exporting') : t('admin.analytics.export.exportCsv')}
                    </button>
                    <button
                        onClick={load}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> {t('common.actions.refresh')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}
            {exportError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                    {exportError}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard label={t('admin.analytics.kpi.totalUsers')} value={kpi('Total Users')} icon={Users} accent="bg-indigo-50 text-indigo-600" />
                <StatCard label={t('admin.analytics.kpi.activeEvents')} value={kpi('Active Events')} icon={CalendarCheck} accent="bg-green-50 text-green-600" />
                <StatCard label={t('admin.analytics.kpi.totalStands')} value={kpi('Total Stands')} icon={BarChart3} accent="bg-sky-50 text-sky-600" />
                <StatCard label={t('admin.analytics.kpi.totalEvents')} value={kpi('Total Events')} icon={CalendarCheck} accent="bg-violet-50 text-violet-600" />
                <StatCard label={t('admin.analytics.kpi.organizations')} value={kpi('Organizations')} icon={Users} accent="bg-amber-50 text-amber-600" />
                <StatCard label={t('admin.analytics.kpi.pending')} value={kpi('Pending Approval')} icon={TrendingUp} accent="bg-orange-50 text-orange-600" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 30-day trend */}
                <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-zinc-700 mb-4">{t('admin.analytics.charts.thirtyDayTrend')}</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={4} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={30} />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                labelStyle={{ color: '#475569' }}
                            />
                            <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name={t('admin.analytics.charts.eventsCreated')} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Distribution pie */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-zinc-700 mb-4">{t('admin.analytics.charts.eventDistribution')}</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Events table */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100">
                    <h2 className="text-sm font-semibold text-zinc-700">{t('admin.analytics.eventsTable.title')}</h2>
                </div>
                <div className="divide-y divide-zinc-100">
                    {events.length === 0 ? (
                        <p className="text-sm text-zinc-400 text-center py-10">{t('admin.analytics.eventsTable.noEvents')}</p>
                    ) : events.map(ev => (
                        <Link
                            key={ev.id}
                            href={`/admin/analytics/${ev.id}`}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 transition-colors group"
                        >
                            <div>
                                <p className="text-sm font-medium text-zinc-900 group-hover:text-indigo-600 transition-colors">{ev.title}</p>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    {ev.category} · {formatInUserTZ(ev.start_date, { month: 'short', day: 'numeric', year: 'numeric' }, undefined, userTimezone)}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATE_BADGE[ev.state] ?? 'bg-zinc-100 text-zinc-500'}`}>
                                    {t(`admin.events.states.${ev.state}`, { defaultValue: ev.state.replace(/_/g, ' ') })}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}