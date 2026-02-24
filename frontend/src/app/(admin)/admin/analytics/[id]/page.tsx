'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    BarChart3, ArrowLeft, Eye, Store, MessageSquare, Users, RefreshCw,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { adminService } from '@/services/admin.service';
import { DashboardData } from '@/types/analytics';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'];

function MetricCard({ label, value, icon: Icon, accent }: {
    label: string; value: string | number; icon: React.ElementType; accent: string;
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

export default function EventAnalyticsPage() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await adminService.getEventAnalytics(id);
            setData(result);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load event analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (id) load(); }, [id]);

    const kpi = (label: string) => data?.kpis.find(k => k.label === label)?.value ?? 0;

    const chartData = (data?.main_chart ?? []).map(p => ({
        date: p.timestamp.slice(5, 10),
        events: p.value,
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
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/analytics"
                        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Analytics
                    </Link>
                    <div className="w-px h-4 bg-zinc-200" />
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h1 className="text-xl font-bold text-zinc-900">Event Deep Metrics</h1>
                    </div>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard label="Event Views" value={kpi('Event Views')} icon={Eye} accent="bg-indigo-50 text-indigo-600" />
                <MetricCard label="Stand Visits" value={kpi('Stand Visits')} icon={Store} accent="bg-violet-50 text-violet-600" />
                <MetricCard label="Chats Opened" value={kpi('Chats Opened')} icon={MessageSquare} accent="bg-sky-50 text-sky-600" />
                <MetricCard label="Leads Generated" value={kpi('Leads Generated')} icon={Users} accent="bg-emerald-50 text-emerald-600" />
                <MetricCard label="Participants" value={kpi('Participants')} icon={Users} accent="bg-amber-50 text-amber-600" />
                <MetricCard label="Active Stands" value={kpi('Active Stands')} icon={Store} accent="bg-rose-50 text-rose-600" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-zinc-700 mb-4">14-Day Activity Trend</h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                            <Bar dataKey="events" fill="#6366f1" radius={[4, 4, 0, 0]} name="Activity" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                    <h2 className="text-sm font-semibold text-zinc-700 mb-4">Interaction Breakdown</h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false} fontSize={10}>
                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
