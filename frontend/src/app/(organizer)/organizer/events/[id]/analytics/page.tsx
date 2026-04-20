"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventsApi } from "@/lib/api/events";
import { organizerService } from "@/services/organizer.service";
import { resolveMediaUrl } from "@/lib/media";
import { OrganizerEvent } from "@/types/event";
import { formatInUserTZ } from "@/lib/timezone";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { organizationsApi } from "@/lib/api/organizations";
import { OrganizationRead } from "@/types/organization";
import {
  Eye,
  Store,
  TrendingUp,
  Users,
  BarChart2,
  AlertTriangle,
  Calendar,
  Building,
  ArrowLeft,
  X,
  Mail,
  Globe,
  Info,
  CheckCircle2,
  RefreshCw,
  Search,
  PieChart,
  Table2,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";

interface Kpi {
  label: string;
  value: number;
  description?: string;
}

interface DistributionItem {
  label: string;
  value: number;
  percentage?: number;
}

interface EnterpriseSummary {
  id: string;
  name: string;
  logo_url?: string;
  industry?: string;
}

interface EventAnalytics {
  kpis: Kpi[];
  distribution: DistributionItem[];
  total_visitors: number;
  total_enterprises: number;
  total_stand_interactions: number;
  enterprises?: EnterpriseSummary[];
}

type AnalyticsPayload = {
  kpis?: Kpi[];
  distribution?: DistributionItem[] | Record<string, number>;
  total_visitors?: number;
  total_enterprises?: number;
  total_stand_interactions?: number;
  enterprises?: EnterpriseSummary[];
};

interface LiveEventAnalyticsResponse {
  dashboard?: AnalyticsPayload;
  live?: Record<string, number>;
}

const KPI_ICONS: Record<string, React.ReactNode> = {
  visitors: <Eye className="w-5 h-5 text-blue-500" />,
  enterprises: <Store className="w-5 h-5 text-purple-500" />,
  interactions: <TrendingUp className="w-5 h-5 text-green-500" />,
  registrations: <Users className="w-5 h-5 text-indigo-500" />,
};

function getIcon(label: string) {
  const key = Object.keys(KPI_ICONS).find((k) =>
    label.toLowerCase().includes(k)
  );
  return key ? KPI_ICONS[key] : <BarChart2 className="w-5 h-5 text-gray-400" />;
}

function normalizeDistribution(distribution: EventAnalytics["distribution"] | Record<string, number> | undefined): DistributionItem[] {
  if (!distribution) {
    return [];
  }

  if (Array.isArray(distribution)) {
    return distribution.map((item) => ({
      label: String(item.label || 'Unlabeled'),
      value: Number.isFinite(Number(item.value)) ? Number(item.value) : 0,
      percentage: Number.isFinite(Number(item.percentage)) ? Number(item.percentage) : undefined,
    }));
  }

  return Object.entries(distribution).map(([label, value]) => ({
    label: String(label || 'Unlabeled'),
    value: Number.isFinite(Number(value)) ? Number(value) : 0,
  }));
}

function normalizeAnalyticsPayload(payload: AnalyticsPayload): EventAnalytics {
  const rawKpis = payload.kpis ?? [];
  const normalizedKpis: Kpi[] = rawKpis.map((kpi) => ({
    label: String(kpi.label || 'Untitled metric'),
    value: Number.isFinite(Number(kpi.value)) ? Number(kpi.value) : 0,
    description: kpi.description,
  }));

  const normalizedEnterprises = (payload.enterprises ?? []).map((ent, index) => ({
    id: String(ent.id || `enterprise-${index}`),
    name: String(ent.name || 'Unnamed enterprise'),
    logo_url: ent.logo_url,
    industry: ent.industry,
  }));

  return {
    ...payload,
    kpis: normalizedKpis,
    distribution: normalizeDistribution(payload.distribution),
    enterprises: normalizedEnterprises,
    total_visitors: Number.isFinite(Number(payload.total_visitors)) ? Number(payload.total_visitors) : 0,
    total_enterprises: Number.isFinite(Number(payload.total_enterprises)) ? Number(payload.total_enterprises) : normalizedEnterprises.length,
    total_stand_interactions: Number.isFinite(Number(payload.total_stand_interactions)) ? Number(payload.total_stand_interactions) : 0,
  };
}

function mapLiveAnalyticsPayload(livePayload: LiveEventAnalyticsResponse): EventAnalytics {
  const dashboard = livePayload.dashboard ?? {};
  const live = livePayload.live ?? {};

  const rollingKpis: Kpi[] = [
    {
      label: "Live meetings (now)",
      value: Number(live.live_meetings ?? 0),
      description: "Sessions currently in progress",
    },
    {
      label: "Messages (last 15 min)",
      value: Number(live.messages_last_15m ?? 0),
      description: "Recent chat activity",
    },
    {
      label: "Events tracked (last 15 min)",
      value: Number(live.events_last_15m ?? 0),
      description: "Tracked analytics actions",
    },
  ];

  return normalizeAnalyticsPayload({
    ...dashboard,
    kpis: [...(dashboard.kpis ?? []), ...rollingKpis],
    distribution: dashboard.distribution,
  });
}

// ── Enterprise Detail Modal ──────────────────────────────────────────────
function EnterpriseDetailModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [org, setOrg] = useState<OrganizationRead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    organizationsApi.getOrganizationById(orgId)
      .then(setOrg)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <>
      <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[60] animate-in fade-in duration-300" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl z-[70] overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-6 right-6 z-10">
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-50 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-500 font-medium text-sm">{t('organizer.eventAnalytics.enterpriseModal.loading')}</p>
          </div>
        ) : org ? (
          <div className="flex flex-col">
            {/* Modal Hero */}
            <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 relative">
              <div className="absolute -bottom-12 left-10 p-2 bg-white rounded-[2rem] shadow-xl">
                <div className="w-24 h-24 bg-zinc-50 rounded-2xl overflow-hidden border border-zinc-100 flex items-center justify-center">
                  {org.logo_url ? (
                    <img src={resolveMediaUrl(org.logo_url)} alt={org.name} className="w-full h-full object-contain" />
                  ) : (
                    <Building className="text-zinc-200" size={40} />
                  )}
                </div>
              </div>
            </div>

            <div className="pt-16 px-10 pb-10 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">{org.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{org.industry || t('organizer.eventAnalytics.unnamedEnterprise')}</span>
                  {org.is_verified && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 uppercase tracking-wider">{t('organizer.eventAnalytics.enterpriseModal.verified')}</span>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.1em] flex items-center gap-2">
                      <Info size={14} className="text-indigo-500" /> {t('organizer.eventAnalytics.enterpriseModal.description')}
                  </h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">
                    {org.description || t('organizer.eventAnalytics.enterpriseModal.noDescription')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.1em] flex items-center gap-2">
                      <Mail size={14} className="text-indigo-500" /> {t('organizer.eventAnalytics.enterpriseModal.contactEmail')}
                    </h3>
                    <p className="text-zinc-900 font-semibold text-sm">{org.contact_email || t('organizer.eventAnalytics.enterpriseModal.notAvailable')}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.1em] flex items-center gap-2">
                      <Globe size={14} className="text-indigo-500" /> {t('organizer.eventAnalytics.enterpriseModal.website')}
                    </h3>
                    {org.website ? (
                      <a href={org.website.startsWith('http') ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm transition-colors flex items-center gap-1 group">
                        {org.website}
                      </a>
                    ) : (
                        <p className="text-zinc-900 font-semibold text-sm">{t('organizer.eventAnalytics.enterpriseModal.notAvailable')}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100">
                <Button onClick={onClose} className="w-full h-12 rounded-2xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-bold tracking-wide">
                  {t('organizer.eventAnalytics.enterpriseModal.close')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-20 text-center">
            <p className="text-zinc-500 font-medium">{t('organizer.eventAnalytics.enterpriseModal.loadFailed')}</p>
          </div>
        )}
      </div>
    </>
  );
}

export default function EventAnalyticsPage() {
  const { t } = useTranslation();
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [activeView, setActiveView] = useState<"overview" | "engagement" | "enterprises">("overview");
  const [distributionMode, setDistributionMode] = useState<"percent" | "absolute">("percent");
  const [enterpriseQuery, setEnterpriseQuery] = useState("");
  const [kpiQuery, setKpiQuery] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let isMounted = true;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const loadEvent = async () => {
      const eventData = await eventsApi.getEventById(eventId);
      if (isMounted) {
        setEvent(eventData);
      }
    };

    const loadAnalytics = async (surfaceError = true) => {
      try {
        const livePayload = await organizerService.getLiveEventAnalytics(eventId);
        if (isMounted) {
          setAnalytics(mapLiveAnalyticsPayload(livePayload));
          setLastUpdatedAt(new Date());
          setError(null);
        }
        return;
      } catch (liveErr) {
        console.warn("Live analytics fetch failed, falling back to standard analytics:", liveErr);
      }

      try {
        const fallbackPayload = await organizerService.getEventAnalytics(eventId);
        if (isMounted) {
          setAnalytics(normalizeAnalyticsPayload(fallbackPayload as AnalyticsPayload));
          setLastUpdatedAt(new Date());
          setError(null);
        }
      } catch (fallbackErr) {
        console.error("Analytics fetch error:", fallbackErr);
        if (isMounted && surfaceError) {
          setError(t('organizer.eventAnalytics.errorLoad'));
        }
      }
    };

    const initialize = async () => {
      setLoading(true);
      try {
        await loadEvent();
        await loadAnalytics(true);
      } catch (initErr) {
        console.error("Event analytics initialization error:", initErr);
        if (isMounted) {
          setError(t('organizer.eventAnalytics.errorLoad'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          refreshTimer = setInterval(() => {
            loadAnalytics(false);
          }, 15000);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [eventId]);

  const handleExport = async () => {
    setExportLoading(true);
    setError(null);
    setExportSuccess(false);
    try {
      await organizerService.exportEventReportPDF(eventId);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: unknown) {
      console.error("Export failed:", err);
      // Use the error message from the service if available
      const message = err instanceof Error ? err.message : t('organizer.eventAnalytics.errorExport');
      setError(message);
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 font-medium animate-pulse">{t('organizer.eventAnalytics.loading')}</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-zinc-300" size={32} />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 mb-2">{t('organizer.eventAnalytics.notFound')}</h3>
        <Link href="/organizer/events" className="text-indigo-600 font-semibold hover:underline">
          {t('organizer.eventAnalytics.backToEvents')}
        </Link>
      </div>
    );
  }

  const totalVisitors = Number(
    analytics?.total_visitors ??
    analytics?.kpis?.find((k) => k.label.toLowerCase().includes("visitor"))?.value ??
    0
  );

  const totalInteractions = Number(
    analytics?.total_stand_interactions ??
    analytics?.kpis?.find((k) => k.label.toLowerCase().includes("interaction"))?.value ??
    0
  );

  const maxDist =
    Array.isArray(analytics?.distribution) && analytics.distribution.length > 0
      ? Math.max(...analytics.distribution.map((d) => d.value))
      : 1;

  const engagementRate =
    totalVisitors > 0
      ? Math.round((totalInteractions / totalVisitors) * 100)
      : 0;

  const enterpriseCount = analytics?.enterprises?.length ?? 0;
  const leadsKpi = analytics?.kpis?.find((k) => k.label.toLowerCase().includes("lead"))?.value ?? 0;
  const meetingsKpi = analytics?.kpis?.find((k) => k.label.toLowerCase().includes("meeting"))?.value ?? 0;

  const filteredEnterprises = (analytics?.enterprises || []).filter((ent) => {
    const q = enterpriseQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      ent.name.toLowerCase().includes(q) ||
      String(ent.industry || "").toLowerCase().includes(q)
    );
  });

  const sortedDistribution = [...(analytics?.distribution || [])].sort((a, b) => b.value - a.value);
  const filteredKpis = (analytics?.kpis || []).filter((kpi) => {
    const q = kpiQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      kpi.label.toLowerCase().includes(q) ||
      String(kpi.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
        <div className="space-y-4">
          <Link href={`/organizer/events/${eventId}`} className="inline-flex items-center gap-2 text-zinc-500 hover:text-indigo-600 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-semibold uppercase tracking-wider">{t('organizer.eventAnalytics.backToDetail')}</span>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{event.title}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${event.state === 'live' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 animate-pulse' : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                }`}>
                {event.state.replace('_', ' ')}
              </span>
              <p className="text-sm text-zinc-400 font-medium">{t('organizer.eventAnalytics.title')}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <RefreshCw className="w-3.5 h-3.5" />
              {lastUpdatedAt ? t('organizer.eventAnalytics.lastRefresh', { time: lastUpdatedAt.toLocaleTimeString() }) : t('organizer.eventAnalytics.waitingRefresh')}
            </div>
            <div className="text-xs text-zinc-500">
              {t('organizer.eventAnalytics.coverage', { count: analytics?.kpis?.length ?? 0 }).replace('{count}', String(sortedDistribution.length))}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-xl border-zinc-200 hover:bg-zinc-50 gap-2 font-semibold px-6"
            onClick={handleExport}
            isLoading={exportLoading}
          >
            {exportLoading ? t('organizer.eventAnalytics.exporting') : t('organizer.eventAnalytics.export')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm flex gap-3 items-center animate-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {exportSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-6 py-4 rounded-2xl text-sm flex gap-3 items-center animate-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {t('organizer.eventAnalytics.exportSuccess')}
        </div>
      )}

      {!analytics || analytics.kpis?.length === 0 ? (
        <Card className="p-20 text-center rounded-[2rem]">
          <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart2 className="w-10 h-10 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 mb-2">{t('organizer.eventAnalytics.insightNotReached.title')}</h3>
          <p className="text-zinc-500 max-w-sm mx-auto">
            {t('organizer.eventAnalytics.insightNotReached.message')}
          </p>
        </Card>
      ) : (
        <>
          {/* Interactive View Switch */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-2 inline-flex gap-2 shadow-sm">
            <button
              onClick={() => setActiveView("overview")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeView === "overview" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {t('organizer.eventAnalytics.viewTabs.overview')}
            </button>
            <button
              onClick={() => setActiveView("engagement")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeView === "engagement" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {t('organizer.eventAnalytics.viewTabs.engagement')}
            </button>
            <button
              onClick={() => setActiveView("enterprises")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeView === "enterprises" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {t('organizer.eventAnalytics.viewTabs.enterprises')}
            </button>
          </div>

          {/* High-Level Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="p-6 border-zinc-200 shadow-sm rounded-2xl group hover:border-purple-200 transition-all">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500 border border-purple-100 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <Store size={22} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-zinc-900">
                    {enterpriseCount}
                  </div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-1">{t('organizer.eventAnalytics.kpi.participatingEnterprises')}</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-zinc-200 shadow-sm rounded-2xl group hover:border-blue-200 transition-all">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-100 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Eye size={22} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-zinc-900">{totalVisitors}</div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-1">{t('organizer.eventAnalytics.kpi.uniqueVisitors')}</div>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-zinc-200 shadow-sm rounded-2xl group hover:border-emerald-200 transition-all">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                  <TrendingUp size={22} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-zinc-900">{totalInteractions}</div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-1">{t('organizer.eventAnalytics.kpi.engagementEvents')}</div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 rounded-2xl border-zinc-200 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('organizer.eventAnalytics.kpi.engagementRate')}</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-emerald-600">{engagementRate}%</p>
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border-zinc-200 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('organizer.eventAnalytics.kpi.leadsCaptured')}</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-indigo-600">{leadsKpi}</p>
                <ArrowUpRight className="w-5 h-5 text-indigo-500" />
              </div>
            </Card>
            <Card className="p-4 rounded-2xl border-zinc-200 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">{t('organizer.eventAnalytics.kpi.meetingsInitiated')}</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-purple-600">{meetingsKpi}</p>
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </Card>
          </div>

          {activeView !== "enterprises" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* KPI Detailed Grid */}
            <Card className="p-8 rounded-[2rem] border-zinc-200 shadow-sm h-full">
              <div className="flex items-center justify-between mb-6 gap-3">
                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" /> Key Performance Indicators
                </h2>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    value={kpiQuery}
                    onChange={(e) => setKpiQuery(e.target.value)}
                    placeholder={t('organizer.eventAnalytics.searchMetrics')}
                    className="h-8 pl-7 pr-3 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredKpis.map((kpi) => (
                  <div key={`${kpi.label}-${kpi.description || 'metric'}`} className="bg-zinc-50 border border-zinc-100 rounded-2xl p-5 hover:bg-white hover:border-zinc-200 transition-all hover:shadow-sm">
                    <div className="mb-3">{getIcon(kpi.label)}</div>
                    <div>
                      <div className="text-2xl font-bold text-zinc-900 leading-none mb-1">{kpi.value}</div>
                      <div className="text-xs font-semibold text-zinc-500 leading-tight">{kpi.label}</div>
                      {kpi.description && (
                        <div className="text-[10px] text-zinc-400 mt-2 font-medium">{kpi.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Engagement Distribution */}
            <Card className="p-8 rounded-[2rem] border-zinc-200 shadow-sm h-full">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> {t('organizer.eventAnalytics.funnel.title')}
                </h2>
                <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-zinc-50">
                  <button
                    onClick={() => setDistributionMode("percent")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${distributionMode === "percent" ? "bg-white text-zinc-900" : "text-zinc-500"}`}
                  >
                    <PieChart className="w-3 h-3 inline-block mr-1" /> {t('organizer.eventAnalytics.funnel.percentage')}
                  </button>
                  <button
                    onClick={() => setDistributionMode("absolute")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${distributionMode === "absolute" ? "bg-white text-zinc-900" : "text-zinc-500"}`}
                  >
                    <Table2 className="w-3 h-3 inline-block mr-1" /> {t('organizer.eventAnalytics.funnel.absolute')}
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                {sortedDistribution.map((item) => {
                  const pct = item.percentage ?? Math.round((item.value / maxDist) * 100);
                  const barWidth = distributionMode === "percent" ? pct : Math.round((item.value / maxDist) * 100);
                  return (
                    <div key={item.label} className="group/bar">
                      <div className="flex items-center justify-between text-sm mb-2 px-1">
                        <span className="font-semibold text-zinc-700">{item.label}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-zinc-900">{item.value}</span>
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{distributionMode === "percent" ? `(${pct}%)` : 'events'}</span>
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-3 p-0.5 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-1000 shadow-sm shadow-indigo-200 group-hover/bar:bg-indigo-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          )}

          {/* Participating Enterprises Section */}
          {(activeView === "overview" || activeView === "enterprises") && (
          <Card className="p-8 rounded-[2rem] border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-500" /> Participating Enterprises
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    value={enterpriseQuery}
                    onChange={(e) => setEnterpriseQuery(e.target.value)}
                    placeholder={t('organizer.eventAnalytics.enterpriseRoster.searchPlaceholder')}
                    className="h-8 pl-7 pr-3 rounded-lg border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="text-[10px] font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase tracking-tighter shadow-sm border border-purple-100">
                  {t('organizer.eventAnalytics.enterpriseRoster.showingCount', { count: enterpriseCount, total: enterpriseCount })}
                </div>
              </div>
            </div>

            {filteredEnterprises.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredEnterprises.map((ent) => (
                  <div key={ent.id} className="bg-white border border-zinc-100 rounded-[2.5rem] p-7 hover:border-indigo-200 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 group/ent cursor-default relative overflow-hidden flex flex-col items-center">
                    <div className="w-28 h-28 bg-white rounded-[2rem] mb-6 border border-zinc-100 shadow-md group-hover/ent:shadow-xl group-hover/ent:scale-110 group-hover/ent:-rotate-2 transition-all duration-700 overflow-hidden flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent opacity-0 group-hover/ent:opacity-100 transition-opacity z-20" />
                      {ent.logo_url ? (
                        <img src={resolveMediaUrl(ent.logo_url)} alt={ent.name} className="w-full h-full object-cover relative z-10" />
                      ) : (
                        <div className="w-full h-full bg-zinc-50 flex items-center justify-center relative z-10">
                          <Building className="text-zinc-300" size={40} />
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <h4 className="font-bold text-zinc-900 text-sm truncate px-2">{ent.name}</h4>
                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1.5">
                        {ent.industry || t('organizer.eventAnalytics.unnamedEnterprise')}
                      </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-zinc-100 w-full flex justify-center">
                      <button
                        onClick={() => setSelectedOrgId(ent.id)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-500 uppercase tracking-[0.2em] transition-all hover:scale-110 active:scale-95 py-1 px-4 rounded-full hover:bg-indigo-50"
                      >
                        {t('organizer.eventAnalytics.enterpriseRoster.viewProfile')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-[2rem]">
                <p className="text-zinc-400 text-sm font-medium">{t('organizer.events.noMatch')}</p>
              </div>
            )}
          </Card>
          )}

          {/* Quick Stats Row */}
          <Card className="px-8 py-6 rounded-3xl border-zinc-200 shadow-sm bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.15em] mb-1">{t('organizer.eventAnalytics.generalCategory')}</div>
                <div className="text-sm font-bold truncate">{event.category || t('organizer.eventAnalytics.generalCategory')}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-[0.15em] mb-1">{t('organizer.eventAnalytics.kpi.engagementRate')}</div>
                <div className="text-xl font-bold text-emerald-400">
                  {engagementRate}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.15em] mb-1">{t('organizer.eventAnalytics.timelineLabel')}</div>
                <div className="text-sm font-bold flex items-center gap-1.5">
                  <Calendar size={14} className="text-zinc-500" />
                  {event.start_date ? formatInUserTZ(event.start_date, { year: 'numeric', month: 'short', day: 'numeric' }) : t('organizer.eventAnalytics.notScheduled')}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 uppercase font-black tracking-[0.15em] mb-1">{t('organizer.eventAnalytics.dataRecencyLabel')}</div>
                <div className="text-[10px] font-bold text-zinc-400 mt-1 italic">{t('organizer.eventAnalytics.realTimeActive')}</div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Enterprise Detail Modal */}
      {selectedOrgId && (
        <EnterpriseDetailModal
          orgId={selectedOrgId}
          onClose={() => setSelectedOrgId(null)}
        />
      )}
    </div>
  );
}
