'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Users, Building2, CalendarCheck, MessageSquare, Download, Flag,
    ArrowLeft, RefreshCw, AlertTriangle, ChevronRight, Activity, TrendingUp,
    BarChart3, PieChart as PieIcon, Wifi, WifiOff, MapPin, MousePointer2, Clock
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { LiveMetrics, MetricDataPoint } from '@/types/analytics';
import { OrganizerEvent } from '@/types/event';
import { formatInUserTZ } from '@/lib/timezone';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, BarChart, Bar,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { useTranslation } from 'react-i18next';

// ── Constants ───────────────────────────────────────────────────────────────

const POLL_INTERVAL = 15000; // 15s
const HISTORY_WINDOW = 20;   // Keep last 20 samples

const ROLE_COLORS: Record<string, string> = {
    visitor: '#6366f1',    // Indigo
    enterprise: '#10b981', // Emerald
    organizer: '#f59e0b',  // Amber
    admin: '#ef4444',      // Red
};

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// ── Components ──────────────────────────────────────────────────────────────

function Section({ title, children, extra, icon }: { title: string; children: React.ReactNode; extra?: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-zinc-400">{icon}</div>}
                    <h2 className="text-sm font-bold text-zinc-800">{title}</h2>
                </div>
                {extra}
            </div>
            <div className="p-5">
                {children}
            </div>
        </div>
    );
}

function KPICard({ label, value, icon, accent, bg, border, alert }: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    accent?: string;
    bg?: string;
    border?: string;
    alert?: boolean;
}) {
    return (
        <div className={`p-5 rounded-2xl border transition-all ${bg ?? 'bg-white'} ${border ?? 'border-zinc-200'} ${alert ? 'animate-pulse ring-2 ring-red-100' : ''}`}>
            <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${accent ?? 'bg-zinc-50'}`}>
                    {icon}
                </div>
                {alert && <AlertTriangle className="w-4 h-4 text-red-500" />}
            </div>
            <div className="mt-4">
                <p className="text-2xl font-bold text-zinc-900 tracking-tight">{value}</p>
                <p className="text-[11px] text-zinc-400 mt-1 font-bold uppercase tracking-wider">{label}</p>
            </div>
        </div>
    );
}

function Skeleton({ className }: { className?: string }) {
    return <div className={`bg-zinc-100 animate-pulse rounded-xl ${className}`} />;
}

function KPISkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
    );
}

function LiveBadge({ isLive }: { isLive: boolean }) {
    const { t } = useTranslation();
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${isLive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-zinc-100 text-zinc-500 border-zinc-200'
            }`}>
            <span className={`w-1 h-1 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
            {isLive ? t('admin.eventLiveMonitoring.live') : 'IDLE'}
        </span>
    );
}

// ── Charts Section ─────────────────────────────────────────────────────────

function ChartsSection({ history, pieData }: { history: MetricDataPoint[], pieData: { name: string; value: number }[] }) {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <Section title={t('admin.eventLiveMonitoring.charts.messagesPerMin')} icon={<TrendingUp className="w-4 h-4" />}>
                    <div className="h-64 w-full">
                        {history.length < 2 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                                <Activity className="w-6 h-6 mb-2 opacity-50" />
                                <p className="text-xs">{t('admin.eventLiveMonitoring.charts.collectingData')}</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={history}>
                                    <defs>
                                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="time"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    />
                                    <Tooltip
                                        contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Section>
            </div>

            <Section title={t('admin.eventLiveMonitoring.charts.userDistribution')} icon={<PieIcon className="w-4 h-4" />}>
                <div className="h-64 w-full">
                    {pieData.every(d => d.value === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                            <p className="text-xs">{t('admin.eventLiveMonitoring.charts.noActiveUsers')}</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
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
            </Section>
        </div>
    );
}

// ── Active Users Panel ─────────────────────────────────────────────────────

function ActiveUsersPanel({ users }: { users: LiveMetrics['active_users'] }) {
    const { t } = useTranslation();
    return (
        <Section
            title={t('admin.eventLiveMonitoring.activeUsers.title', { count: users.length })}
            extra={
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <Wifi className="w-3.5 h-3.5" /> {t('admin.eventLiveMonitoring.activeUsers.online')}
                </div>
            }
        >
            {users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                    <WifiOff className="w-6 h-6 mb-2" />
                    <p className="text-sm">{t('admin.eventLiveMonitoring.activeUsers.noUsers')}</p>
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
                                        {t('admin.eventLiveMonitoring.activeUsers.since', { time: formatInUserTZ(user.connected_at, { hour: '2-digit', minute: '2-digit' }) })}
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
                                {t(`common.roles.${user.role}`)}
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
    const { t } = useTranslation();
    return (
        <Section
            title={t('admin.eventLiveMonitoring.safetyFlags.title')}
            icon={<Flag className="w-4 h-4" />}
            extra={
                flags.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold border border-red-100">
                        {t('admin.eventLiveMonitoring.safetyFlags.attention')}
                    </span>
                )
            }
        >
            {flags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-xs font-medium text-zinc-500">{t('admin.eventLiveMonitoring.safetyFlags.allClear')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {flags.map(flag => (
                        <div key={flag.id} className="p-3 rounded-xl border border-red-100 bg-red-50/30 flex items-start gap-3">
                            <div className="p-1.5 rounded-lg bg-red-100">
                                <Flag className="w-3.5 h-3.5 text-red-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-red-600 uppercase tracking-tight">{t('admin.eventLiveMonitoring.safetyFlags.highPriority')}</span>
                                    <span className="text-[10px] text-zinc-400">{formatInUserTZ(flag.created_at, { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-xs font-medium text-zinc-900 mt-0.5 truncate">{flag.reason}</p>
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        onClick={() => router.push('/admin/incidents')}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-wider"
                                    >
                                        {t('admin.eventLiveMonitoring.safetyFlags.investigate')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function EventLiveMonitoringPage() {
    const { t } = useTranslation();
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
            const msg = e instanceof Error ? e.message : t('admin.eventLiveMonitoring.error.failedToFetch');
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [id, t]);

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
                    <ArrowLeft className="w-4 h-4" /> {t('admin.eventLiveMonitoring.error.back')}
                </button>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700 font-medium">{error}</p>
                    <button onClick={fetchMetrics} className="mt-4 text-sm text-red-600 hover:text-red-800 underline">
                        {t('common.actions.retry')}
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
                        <ArrowLeft className="w-4 h-4" /> {t('admin.eventLiveMonitoring.backToEvent')}
                    </button>
                    <span className="text-zinc-300">|</span>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-zinc-900">
                            {event?.title ?? t('admin.eventLiveMonitoring.eventFallback')} — {t('admin.eventLiveMonitoring.title')}
                        </h1>
                        <LiveBadge isLive={isLive} />
                        {!isLive && event && (
                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-medium px-2 py-0.5 bg-zinc-100 rounded-full">
                                {t(`admin.events.states.${event.state}`)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-zinc-400">{t('admin.eventLiveMonitoring.updated', { time: lastUpdated })}</span>
                    )}
                    <button
                        onClick={fetchMetrics}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
                        title={t('common.actions.refresh')}
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> {t('common.actions.refresh')}
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
                        icon={<CalendarCheck className="w-5 h-5 text-amber-600" />}
                        accent="bg-amber-50 border border-amber-100"
                        bg="bg-white"
                        border="border-zinc-200"
                    />
                    <KPICard
                        label={t('admin.eventLiveMonitoring.kpis.chatSessions')}
                        value={kpis.active_chats}
                        icon={<MessageSquare className="w-5 h-5 text-indigo-600" />}
                        accent="bg-indigo-50 border border-indigo-100"
                        bg="bg-white"
                        border="border-zinc-200"
                    />
                    <KPICard
                        label={t('admin.eventLiveMonitoring.kpis.safetyFlags')}
                        value={metrics.recent_flags.length}
                        icon={<Flag className="w-5 h-5 text-red-600" />}
                        accent="bg-red-50 border border-red-100"
                        bg="bg-white"
                        border="border-zinc-200"
                        alert={metrics.recent_flags.length > 0}
                    />
                </div>
            ) : <KPISkeleton />}

            {/* ── Charts ── */}
            <ChartsSection
                history={history}
                pieData={[
                    { name: 'visitor', value: kpis?.active_visitors ?? 0 },
                    { name: 'enterprise', value: kpis?.active_stands ?? 0 },
                    { name: 'organizer', value: 0 }, // not tracked in event live metrics currently
                ]}
            />

            {/* ── Details ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActiveUsersPanel users={metrics?.active_users ?? []} />
                <FlagAlertsPanel flags={metrics?.recent_flags ?? []} eventId={id} router={router} />
            </div>

            {/* <div className=\"fixed bottom-6 right-6 px-4 py-2 bg-white/80 backdrop-blur border border-zinc-200 rounded-full shadow-sm flex items-center gap-2 text-[10px] font-medium text-zinc-500\">
                {isLive ? (
                    <>
                        <span className=\"w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse\" />
                        Auto-refreshing every 15s
                    </>
                ) : (
                    <>
                        <span className=\"w-1.5 h-1.5 rounded-full bg-zinc-300\" />
                        Auto-refresh paused — event is not live
                    </>
                )}
            </div> */}
        </div>
    );
}
