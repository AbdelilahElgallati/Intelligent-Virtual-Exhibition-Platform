'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
    Users, Building2, CalendarCheck, MessageSquare, Download, Flag,
    ArrowLeft, RefreshCw, AlertTriangle, ExternalLink, Wifi, WifiOff,
    TrendingUp, Shield,
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { adminService } from '@/services/admin.service';
import { LiveMetrics, MetricDataPoint } from '@/types/monitoring';
import { OrganizerEvent } from '@/types/event';
import { formatInUserTZ } from '@/lib/timezone';

// ── Constants ──────────────────────────────────────────────────────────────

const POLL_INTERVAL = 10_000; // 10 seconds
const HISTORY_WINDOW = 15;   // 15 data points for sparklines

const ROLE_COLORS: Record<string, string> = {
    visitor: '#6366f1',
    enterprise: '#10b981',
    organizer: '#f59e0b',
    admin: '#ef4444',
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ── Skeleton ───────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-zinc-100 rounded-xl ${className}`} />;
}

function KPISkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
    );
}

// ── Animated number ────────────────────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
    const [display, setDisplay] = useState(value);
    const prev = useRef(value);
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        if (prev.current !== value) {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 600);
            prev.current = value;
            setDisplay(value);
            return () => clearTimeout(t);
        }
    }, [value]);

    return (
        <span className={`transition-colors duration-300 ${flash ? 'text-indigo-600' : ''}`}>
            {display.toLocaleString()}
        </span>
    );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

interface KPICardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    bg: string;
    border: string;
    alert?: boolean;
}

function KPICard({ label, value, icon, accent, bg, border, alert }: KPICardProps) {
    return (
        <div className={`relative rounded-2xl border ${border} ${bg} p-5 flex flex-col gap-3 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden`}>
            {/* Background Glow */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity ${accent}`} />
            
            {alert && value > 0 && (
                <span className="absolute top-3 right-3 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
            )}
            
            <div className={`w-12 h-12 rounded-2xl ${accent} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                {icon}
            </div>
            
            <div>
                <p className="text-3xl font-black text-zinc-900 tracking-tight leading-none">
                    <AnimatedNumber value={value} />
                </p>
                <p className="text-[11px] text-zinc-400 mt-2 font-bold uppercase tracking-wider">{label}</p>
            </div>
        </div>
    );
}

// ── LIVE Badge ─────────────────────────────────────────────────────────────

function LiveBadge({ isLive }: { isLive: boolean }) {
    if (!isLive) return null;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
        </span>
    );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
                {extra}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ── Charts Section ─────────────────────────────────────────────────────────

function ChartsSection({ history, metrics }: {
    history: MetricDataPoint[];
    metrics: LiveMetrics;
}) {
    const { t } = useTranslation('admin');
    // Role distribution for pie chart
    const roleCounts: Record<string, number> = {};
    metrics.active_users.forEach(u => {
        roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
    });
    const pieData = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));
    const hasPieData = pieData.length > 0;

    // Top active stands: map from metrics.top_active_stands
    const standData = metrics.top_active_stands?.length > 0
        ? metrics.top_active_stands.map(s => ({ name: s.name, active: s.active_count }))
        : [{ name: 'No activity', active: 0 }];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Messages / min sparkline */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <TrendingUp className="w-12 h-12 text-indigo-500" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-sm font-semibold text-zinc-700">Messages / min (last 15 min)</h3>
                </div>
                {history.length < 2 ? (
                    <div className="flex items-center justify-center h-40 text-xs text-zinc-400">
                        Collecting data…
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={history} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                            <defs>
                                <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 600 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#6366f1"
                                strokeWidth={3}
                                dot={{ r: 0 }}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                name="msgs/min"
                                isAnimationActive={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Stand activity leaderboard */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Building2 className="w-12 h-12 text-emerald-500" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-zinc-700">Top Active Stands</h3>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={standData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, width: 80 }} width={80} axisLine={false} tickLine={false} />
                        <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="active" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} name="Activity Score" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Role distribution pie */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Users className="w-12 h-12 text-amber-500" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative">
                    <Users className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-zinc-700">{t('admin.monitoring.charts.userDistribution')}</h3>
                </div>
                {!hasPieData ? (
                    <div className="flex items-center justify-center h-40 text-xs text-zinc-400">
                        No active users
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={5}
                                dataKey="value"
                                isAnimationActive={true}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={entry.name}
                                        fill={ROLE_COLORS[entry.name] ?? PIE_COLORS[index % PIE_COLORS.length]}
                                        stroke="none"
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend iconType="circle" iconSize={8} verticalAlign="bottom" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}

// ── Active Users Panel ─────────────────────────────────────────────────────

function ActiveUsersPanel({ users }: { users: LiveMetrics['active_users'] }) {
    return (
        <Section
            title={`Active Users (${users.length})`}
            extra={
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <Wifi className="w-3.5 h-3.5" /> Online
                </div>
            }
        >
            {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                    <WifiOff className="w-6 h-6 mb-2" />
                    <p className="text-sm">No active users</p>
                </div>
            ) : (
                <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto -mx-5 px-5">
                    {users.map(user => (
                        <div key={user.user_id} className="flex items-center justify-between py-3 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-indigo-700">
                                        {user.full_name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">{user.full_name}</p>
                                    <p className="text-xs text-zinc-400">
                                        Since {formatInUserTZ(user.connected_at, { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <span
                                className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                                style={{
                                    backgroundColor: `${ROLE_COLORS[user.role] ?? '#6366f1'}18`,
                                    color: ROLE_COLORS[user.role] ?? '#6366f1',
                                    border: `1px solid ${ROLE_COLORS[user.role] ?? '#6366f1'}33`,
                                }}
                            >
                                {user.role}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

// ── Flag Alerts Panel ──────────────────────────────────────────────────────

function FlagAlertsPanel({ flags, eventId, router }: {
    flags: LiveMetrics['recent_flags'];
    eventId: string;
    router: ReturnType<typeof useRouter>;
}) {
    return (
        <Section
            title={`Safety Flags (${flags.length} recent)`}
            extra={
                flags.length > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium animate-pulse">
                        <Shield className="w-3.5 h-3.5" /> Attention
                    </span>
                ) : undefined
            }
        >
            {flags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                    <Shield className="w-6 h-6 mb-2 text-emerald-400" />
                    <p className="text-sm">No open flags — all clear</p>
                </div>
            ) : (
                <div className="divide-y divide-zinc-100 -mx-5 px-5 max-h-72 overflow-y-auto">
                    {flags.map(flag => {
                        const isHigh = flag.reason.toLowerCase().includes('abuse') ||
                            flag.reason.toLowerCase().includes('violent') ||
                            flag.reason.toLowerCase().includes('spam');
                        return (
                            <div
                                key={flag.id}
                                className={`py-3 flex items-start justify-between gap-3 ${isHigh ? 'bg-red-50 -mx-5 px-5' : ''}`}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isHigh
                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                            {flag.entity_type}
                                        </span>
                                        {isHigh && (
                                            <span className="text-xs font-semibold text-red-600 flex items-center gap-0.5">
                                                <AlertTriangle className="w-3 h-3" /> High priority
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-zinc-900 mt-1 truncate">{flag.reason}</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        {formatInUserTZ(flag.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => router.push(`/admin/incidents`)}
                                    className="shrink-0 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
                                >
                                    Investigate <ExternalLink className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </Section>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EventMonitoringPage() {
    const { t } = useTranslation('admin');
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [event, setEvent] = useState<OrganizerEvent | null>(null);
    const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
    const [history, setHistory] = useState<MetricDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isLive = event?.state === 'live';

    // ── Data fetching ──────────────────────────────────────────────────────

    const fetchMetrics = useCallback(async () => {
        try {
            const data = await adminService.getLiveMetrics(id);
            setMetrics(data);
            setError(null);
            setLastUpdated(formatInUserTZ(new Date(), { hour: '2-digit', minute: '2-digit' }));

            // Append to history for line chart (keep last HISTORY_WINDOW points)
            const label = formatInUserTZ(new Date(), { hour: '2-digit', minute: '2-digit' });
            setHistory(prev => {
                const next = [...prev, { time: label, value: data.kpis.messages_per_minute }];
                return next.slice(-HISTORY_WINDOW);
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch metrics';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchEvent = useCallback(async () => {
        try {
            const data = await adminService.getEventById(id);
            setEvent(data);
        } catch {
            // silently ignore; metrics may still work
        }
    }, [id]);

    useEffect(() => {
        fetchEvent();
        fetchMetrics();
    }, [fetchEvent, fetchMetrics]);

    // Poll while the event is live (or always if unknown)
    useEffect(() => {
        if (event !== null && !isLive) return; // stop polling for non-live events

        pollRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [isLive, event, fetchMetrics]);

    // ── Loading state ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <Skeleton className="h-6 w-40" />
                <KPISkeleton />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-52" />
                    <Skeleton className="h-52" />
                    <Skeleton className="h-52" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    // ── Error state ────────────────────────────────────────────────────────

    if (error && !metrics) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 text-sm mb-6">
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700 font-medium">{error}</p>
                    <button onClick={fetchMetrics} className="mt-4 text-sm text-red-600 hover:text-red-800 underline">
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    const kpis = metrics?.kpis;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/admin/events/${id}`)}
                        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 text-sm font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Event
                    </button>
                    <span className="text-zinc-300">|</span>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-zinc-900">
                            {event?.title ?? 'Event'} — Live Monitor
                        </h1>
                        <LiveBadge isLive={isLive} />
                        {!isLive && event && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium px-2 py-0.5 bg-zinc-100 rounded-full">
                                {event.state}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-zinc-400">Updated {lastUpdated}</span>
                    )}
                    <button
                        onClick={fetchMetrics}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    {error && (
                        <span className="text-xs text-red-500 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {error}
                        </span>
                    )}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            {kpis ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <KPICard
                        label={t('admin.monitoring.kpi.activeVisitors')}
                        value={kpis.active_visitors}
                        icon={<Users className="w-5 h-5 text-indigo-600" />}
                        accent="bg-indigo-50 border border-indigo-100"
                        bg="bg-white"
                        border="border-zinc-200"
                    />
                    <KPICard
                        label={t('admin.monitoring.kpi.activeStands')}
                        value={kpis.active_stands}
                        icon={<Building2 className="w-5 h-5 text-emerald-600" />}
                        accent="bg-emerald-50 border border-emerald-100"
                        bg="bg-white"
                        border="border-zinc-200"
                    />
                    <KPICard
                        label={t('admin.monitoring.kpi.ongoingMeetings')}
                        value={kpis.ongoing_meetings}
                        icon={<CalendarCheck className="w-5 h-5 text-blue-600" />}
                        accent="bg-blue-50 border border-blue-100"
                        bg="bg-white"
                        border="border-zinc-200"
                    />
                    <KPICard
                        label={t('admin.monitoring.kpi.messagesPerMin')}
                        value={kpis.messages_per_minute}
                        icon={<MessageSquare className="w-5 h-5 text-violet-600" />}
                        accent="bg-violet-50 border border-violet-100"
                        bg="bg-white"
                        border="border-zinc-200"
                    />
                    <KPICard
                        label="Open Flags"
                        value={kpis.incident_flags_open}
                        icon={<Flag className="w-5 h-5 text-red-600" />}
                        accent="bg-red-50 border border-red-100"
                        bg={kpis.incident_flags_open > 0 ? 'bg-red-50' : 'bg-white'}
                        border={kpis.incident_flags_open > 0 ? 'border-red-200' : 'border-zinc-200'}
                        alert
                    />
                </div>
            ) : (
                <KPISkeleton />
            )}

            {/* ── Live Charts ── */}
            {metrics && (
                <ChartsSection history={history} metrics={metrics} />
            )}

            {/* ── Bottom panels ── */}
            {metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ActiveUsersPanel users={metrics.active_users} />
                    <FlagAlertsPanel flags={metrics.recent_flags} eventId={id} router={router} />
                </div>
            )}

            {/* ── Polling status ── */}
            {/* <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 pb-2">
                {isLive ? (
                    <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Auto-refreshing every {POLL_INTERVAL / 1000}s while event is live
                    </>
                ) : (
                    <>
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                        Auto-refresh paused — event is not live
                    </>
                )}
            </div> */}
        </div>
    );
}
