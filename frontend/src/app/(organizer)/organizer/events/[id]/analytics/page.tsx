"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventsApi } from "@/lib/api/events";
import { OrganizerEvent } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeft,
  BarChart2,
  Users,
  Eye,
  Store,
  TrendingUp,
  AlertTriangle,
  Calendar,
} from "lucide-react";

interface Kpi {
  label: string;
  value: number | string;
  description?: string;
}

interface DistributionItem {
  label: string;
  value: number;
  percentage?: number;
}

interface EventAnalytics {
  kpis: Kpi[];
  distribution: DistributionItem[];
  total_visitors?: number;
  total_enterprises?: number;
  total_stand_interactions?: number;
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

export default function EventAnalyticsPage() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [eventData, analyticsData] = await Promise.all([
          eventsApi.getEventById(eventId),
          eventsApi.getEventAnalytics(eventId),
        ]);
        setEvent(eventData);
        setAnalytics(analyticsData as EventAnalytics);
      } catch {
        setError("Could not load analytics data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Event not found.</p>
        <Link href="/organizer/events" className="text-indigo-600 text-sm mt-2 inline-block">
          Back to events
        </Link>
      </div>
    );
  }

  const totalVisitors =
    analytics?.total_visitors ??
    analytics?.kpis?.find((k) =>
      k.label.toLowerCase().includes("visitor")
    )?.value ??
    "—";

  const totalInteractions =
    analytics?.total_stand_interactions ??
    analytics?.kpis?.find((k) =>
      k.label.toLowerCase().includes("interaction")
    )?.value ??
    "—";

  const maxDist = analytics?.distribution
    ? Math.max(...analytics.distribution.map((d) => d.value))
    : 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/organizer/events/${eventId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Event Analytics</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {!analytics || analytics.kpis?.length === 0 ? (
        <Card className="p-10 text-center">
          <BarChart2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No analytics data available yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Analytics will appear once the event is live and participants start engaging.
          </p>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Store className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {event.num_enterprises ?? "—"}
                  </div>
                  <div className="text-xs text-gray-500">Registered Enterprises</div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalVisitors}</div>
                  <div className="text-xs text-gray-500">Total Visitors</div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalInteractions}</div>
                  <div className="text-xs text-gray-500">Stand Interactions</div>
                </div>
              </div>
            </Card>
          </div>

          {/* KPI grid */}
          {analytics.kpis?.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> Key Performance Indicators
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {analytics.kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg p-4 flex items-start gap-3"
                  >
                    <div className="mt-0.5">{getIcon(kpi.label)}</div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{kpi.value}</div>
                      <div className="text-sm text-gray-600">{kpi.label}</div>
                      {kpi.description && (
                        <div className="text-xs text-gray-400 mt-0.5">{kpi.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Distribution chart */}
          {analytics.distribution?.length > 0 && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Engagement Distribution
              </h2>
              <div className="space-y-3">
                {analytics.distribution.map((item, idx) => {
                  const pct =
                    item.percentage ?? Math.round((item.value / maxDist) * 100);
                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">{item.label}</span>
                        <span className="text-gray-500 font-medium">
                          {item.value}{" "}
                          <span className="text-xs text-gray-400">
                            ({pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Event summary row */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Event Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-400 uppercase font-semibold">Status</div>
                <div className="mt-0.5 capitalize">{event.state.replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase font-semibold">Category</div>
                <div className="mt-0.5">{event.category ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase font-semibold">Start</div>
                <div className="mt-0.5">
                  {event.start_date
                    ? new Date(event.start_date).toLocaleDateString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase font-semibold">End</div>
                <div className="mt-0.5">
                  {event.end_date
                    ? new Date(event.end_date).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
