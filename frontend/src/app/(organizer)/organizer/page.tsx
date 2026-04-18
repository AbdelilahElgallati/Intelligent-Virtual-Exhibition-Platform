'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { eventsApi } from '@/lib/api/events';
import { OrganizerEvent } from '@/types/event';
import {
    Calendar,
    Users,
    CheckCircle2,
    Clock,
    Download,
    RefreshCw,
    TrendingUp,
    Search,
    ArrowRight,
    ShieldCheck,
    MessageSquare,
} from 'lucide-react';
import { organizerService } from '@/services/organizer.service';
import { Button } from '@/components/ui/Button';
import { OrganizerSummary } from '@/types/organizer';
import { formatInUserTZ } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

export default function OrganizerDashboard() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [summary, setSummary] = useState<OrganizerSummary | null>(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [eventSearch, setEventSearch] = useState('');
    const [stateFilter, setStateFilter] = useState<'all' | 'active' | 'pending' | 'closed'>('all');
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

    useEffect(() => {
        void fetchDashboard(true);
    }, []);

    const fetchDashboard = async (initial = false) => {
        if (initial) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const [eventsData, summaryData] = await Promise.all([
                eventsApi.getOrganizerEvents(),
                organizerService.getOverallSummary(),
            ]);
            setEvents(Array.isArray(eventsData) ? eventsData : []);
            setSummary(summaryData);
            setLastSyncedAt(new Date());
            setError(null);
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
            setEvents([]);
            setError(t("organizer.dashboard.errorRefresh"));
        } finally {
            if (initial) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }
    };

    const handleExportOverall = async () => {
        setExportLoading(true);
        setError(null);
        setExportSuccess(false);
        try {
            await organizerService.exportOverallReportPDF();
            setExportSuccess(true);
            setTimeout(() => setExportSuccess(false), 5000);
        } catch (err: any) {
            console.error('Export failed', err);
            setError(err.message || t("organizer.dashboard.errorExport"));
        } finally {
            setExportLoading(false);
        }
    };

    const activeEvents = useMemo(
        () => events.filter((e) => e.state === 'approved' || e.state === 'live' || e.state === 'payment_done' || e.state === 'payment_proof_submitted'),
        [events]
    );

    const pendingEvents = useMemo(
        () => events.filter((e) => e.state === 'pending_approval' || e.state === 'waiting_for_payment'),
        [events]
    );

    const closedEvents = useMemo(
        () => events.filter((e) => e.state === 'closed' || e.state === 'rejected'),
        [events]
    );

    const filteredRecentEvents = useMemo(() => {
        const q = eventSearch.trim().toLowerCase();
        return events
            .filter((event) => {
                if (stateFilter === 'active') return activeEvents.some((e) => e.id === event.id);
                if (stateFilter === 'pending') return pendingEvents.some((e) => e.id === event.id);
                if (stateFilter === 'closed') return closedEvents.some((e) => e.id === event.id);
                return true;
            })
            .filter((event) => {
                if (!q) return true;
                return event.title.toLowerCase().includes(q) || String(event.category || '').toLowerCase().includes(q);
            })
            .slice(0, 6);
    }, [events, eventSearch, stateFilter, activeEvents, pendingEvents, closedEvents]);

    const stats = [
        { id: 'total-events', label: t("organizer.dashboard.stats.totalEvents"), value: events.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'active-events', label: t("organizer.dashboard.stats.activeEvents"), value: activeEvents.length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        { id: 'pending-approval', label: t("organizer.dashboard.stats.pendingApproval"), value: pendingEvents.length, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        { id: 'total-visitors', label: t("organizer.dashboard.stats.totalVisitors"), value: summary?.overview.total_visitors ?? 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ];

    const getEventStateBadgeClass = (state: string) => {
        if (state === 'approved') return 'bg-green-100 text-green-700';
        if (state === 'pending_approval') return 'bg-yellow-100 text-yellow-700';
        return 'bg-gray-100 text-gray-700';
    };

    const getEventStateLabel = (state: string) => {
        const stateKeyMap: Record<string, string> = {
            approved: "organizer.events.states.approved",
            rejected: "organizer.events.states.rejected",
            payment_done: "organizer.events.states.paymentDone",
            live: "organizer.events.states.live",
            closed: "organizer.events.states.closed",
            in_progress: "organizer.events.states.inProgress",
            upcoming: "organizer.events.states.upcoming",
            pending_approval: "organizer.events.states.pendingApproval",
            waiting_for_payment: "organizer.events.states.waitingForPayment",
            payment_proof_submitted: "organizer.events.states.paymentProofSubmitted",
        };

        const key = stateKeyMap[state];
        return key ? t(key) : state;
    };

    const renderRecentEvents = () => {
        if (loading) {
            return <p className="text-gray-500 text-sm">{t("organizer.dashboard.recentEvents.loading")}</p>;
        }
        if (!Array.isArray(events) || events.length === 0) {
            return <p className="text-gray-500 text-sm">{t("organizer.dashboard.recentEvents.empty")}</p>;
        }
        if (filteredRecentEvents.length === 0) {
            return <p className="text-gray-500 text-sm">{t("organizer.dashboard.recentEvents.noMatch")}</p>;
        }

        return filteredRecentEvents.map((event) => (
            <Link key={event.id} href={`/organizer/events/${event.slug || event.id}`} className="block">
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded flex items-center justify-center text-indigo-600 font-bold">
                            {event.title.charAt(0)}
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-900">{event.title}</div>
                            <div className="text-xs text-gray-500">
                                {formatInUserTZ(event.start_date, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                    </div>
                        <div className="flex items-center gap-2">
                            <div className={`text-xs px-2 py-1 rounded-full font-medium ${getEventStateBadgeClass(event.state)}`}>
                                {getEventStateLabel(event.state)}
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                </div>
            </Link>
        ));
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t("organizer.dashboard.welcome", { name: user?.full_name?.split(' ')[0] || "" })}</h1>
                    <p className="text-gray-500">{t("organizer.dashboard.subtitle")}</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {lastSyncedAt
                            ? t("organizer.dashboard.lastSynced", { time: formatInUserTZ(lastSyncedAt, { hour: '2-digit', minute: '2-digit' }) })
                            : t("organizer.dashboard.waitingSync")}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void fetchDashboard(false)}
                        isLoading={refreshing}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t("organizer.dashboard.refresh")}
                    </Button>
                    {!loading && events.length > 0 && (
                        <Button
                            variant="primary"
                            onClick={handleExportOverall}
                            isLoading={exportLoading}
                            className="gap-2 shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            {t("organizer.dashboard.exportPdf")}
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm flex gap-3 items-center animate-in slide-in-from-top-2 duration-300">
                    <Download className="w-5 h-5 shrink-0" /> {error}
                </div>
            )}

            {exportSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-2xl text-sm flex gap-3 items-center animate-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" /> {t("organizer.dashboard.exportSuccess")}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={stat.id} className="p-6 border-none shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-5 border-none shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">{t("organizer.dashboard.engagementScore")}</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-indigo-700">{summary?.overview.stand_engagement_score ?? 0}</p>
                        <TrendingUp className="w-5 h-5 text-indigo-500" />
                    </div>
                </Card>
                <Card className="p-5 border-none shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">{t("organizer.dashboard.leadsGenerated")}</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-emerald-700">{summary?.overview.leads_generated ?? 0}</p>
                        <ArrowRight className="w-5 h-5 text-emerald-500" />
                    </div>
                </Card>
                <Card className="p-5 border-none shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">{t("organizer.dashboard.safetyResolution")}</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-sky-700">{Math.round(summary?.safety.resolution_rate ?? 0)}%</p>
                        <ShieldCheck className="w-5 h-5 text-sky-500" />
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <h3 className="text-lg font-bold text-gray-900">{t("organizer.dashboard.recentEvents.title")}</h3>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                                value={eventSearch}
                                onChange={(e) => setEventSearch(e.target.value)}
                                placeholder={t("organizer.dashboard.recentEvents.searchPlaceholder")}
                                className="h-8 pl-7 pr-3 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            />
                        </div>
                    </div>
                    <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50 mb-4 gap-1">
                        {([
                            ['all', t("organizer.dashboard.recentEvents.filters.all")],
                            ['active', t("organizer.dashboard.recentEvents.filters.active")],
                            ['pending', t("organizer.dashboard.recentEvents.filters.pending")],
                            ['closed', t("organizer.dashboard.recentEvents.filters.closed")],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                onClick={() => setStateFilter(value)}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${stateFilter === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-4">
                        {renderRecentEvents()}
                    </div>
                </Card>

                <Card className="p-6 bg-indigo-900 text-white border-none">
                    <h3 className="text-lg font-bold mb-2">{t("organizer.dashboard.performanceSpotlight.title")}</h3>
                    <p className="text-indigo-100 text-sm leading-relaxed mb-4">
                        {t("organizer.dashboard.performanceSpotlight.tip")}
                    </p>
                    <div className="space-y-3 mb-5">
                        <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-indigo-100">{t("organizer.dashboard.performanceSpotlight.enterpriseParticipation")}</span>
                                <span className="font-semibold">{Math.round(summary?.overview.enterprise_participation_rate ?? 0)}%</span>
                            </div>
                            <div className="w-full h-2 bg-indigo-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-300 rounded-full transition-all duration-700"
                                    style={{ width: `${Math.max(0, Math.min(100, Math.round(summary?.overview.enterprise_participation_rate ?? 0)))}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-indigo-100">{t("organizer.dashboard.performanceSpotlight.chatInteractions")}</span>
                                <span className="font-semibold">{summary?.overview.chat_interactions ?? 0}</span>
                            </div>
                            <div className="w-full h-2 bg-indigo-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-sky-300 rounded-full transition-all duration-700"
                                    style={{ width: `${Math.max(8, Math.min(100, (summary?.overview.chat_interactions ?? 0)))}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/organizer/events">
                            <button className="bg-white text-indigo-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors inline-flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> {t("organizer.dashboard.performanceSpotlight.improveEvents")}
                            </button>
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
    );
}
