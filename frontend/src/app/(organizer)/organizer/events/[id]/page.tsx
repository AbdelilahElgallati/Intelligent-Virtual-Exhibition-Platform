"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventsApi } from "@/lib/api/events";
import { OrganizerEvent, EventStatus, EventScheduleDay } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Link2,
  CalendarDays,
  BarChart2,
  Copy,
  Check,
  AlertTriangle,
  XCircle,
  DollarSign,
  Tag,
  Download,
  FileText,
  Upload,
  ExternalLink,
  Video,
} from "lucide-react";
import { organizerService } from "@/services/organizer.service";
import OrganizerEventConferences from "@/components/conferences/OrganizerEventConferences";
import { resolveMediaUrl } from '@/lib/media';
import { getEventLifecycle } from '@/lib/eventLifecycle';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';

const STATE_LABELS: Record<EventStatus, string> = {
  pending_approval: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  waiting_for_payment: "Waiting for Payment",
  payment_proof_submitted: "Payment Reviewing",
  payment_done: "Payment Done",
  live: "Live",
  closed: "Closed",
};

const STATE_COLORS: Record<EventStatus, string> = {
  pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  waiting_for_payment: "bg-orange-100 text-orange-700 border-orange-200",
  payment_proof_submitted: "bg-blue-100 text-blue-700 border-blue-200",
  payment_done: "bg-indigo-100 text-indigo-700 border-indigo-200",
  live: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

// ── Schedule renderer (mirrors admin panel) ──────────────────────────────────
function ScheduleDisplay({ event }: { event: OrganizerEvent }) {
  const formatDayLabel = (dayNumber: number, dayIndex: number): string => {
    const dayOffset = Math.max(0, Number(dayNumber || (dayIndex + 1)) - 1);
    const tz = event.event_timezone || getUserTimezone();
    const start = new Date(event.start_date || new Date().toISOString());
    if (Number.isNaN(start.getTime())) return 'Invalid date';

    // Build the base calendar day in the event timezone, then offset by day index.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(start);

    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    if (!year || !month || !day) return 'Invalid date';

    const anchorUtcNoon = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0));
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: tz,
    }).format(anchorUtcNoon);
  };

  let days: EventScheduleDay[] | null = event.schedule_days ?? null;

  if (!days && event.event_timeline) {
    try {
      const parsed = JSON.parse(event.event_timeline);
      if (Array.isArray(parsed)) days = parsed as EventScheduleDay[];
    } catch {/* legacy text */ }
  }

  if (days && days.length > 0) {
    return (
      <div className="space-y-3">
        {days.map((day, dayIndex) => (
          <div key={day.day_number} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {day.day_number}
              </span>
              <span className="text-sm font-semibold text-zinc-800">Day {day.day_number}</span>
              <span className="text-xs text-zinc-500 ml-1">— {formatDayLabel(day.day_number, dayIndex)}</span>
            </div>
            <div className="p-3 space-y-2">
              {day.slots.map((slot, si) => (
                <div key={si} className={`flex items-start gap-3 p-2.5 rounded-lg border ${slot.is_conference ? 'border-violet-200 bg-violet-50/50' : 'border-indigo-100 bg-indigo-50/50'}`}>
                  <span className={`shrink-0 text-xs font-semibold rounded-md px-2 py-1 whitespace-nowrap tabular-nums ${slot.is_conference ? 'text-violet-700 bg-violet-100 border border-violet-200' : 'text-indigo-700 bg-indigo-100 border border-indigo-200'}`}>
                    {slot.start_time} → {slot.end_time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 leading-snug pt-0.5">
                      {slot.label || <em className="text-zinc-400">No description</em>}
                    </p>
                    {slot.is_conference && (
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">🎙️ Conference</span>
                        {slot.assigned_enterprise_name && (
                          <span className="text-xs text-violet-600">Speaker: {slot.speaker_name || slot.assigned_enterprise_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {day.slots.length === 0 && (
                <p className="text-xs text-zinc-400 italic px-1">No slots defined</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Legacy plain-text fallback
  if (event.event_timeline) {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.event_timeline}</p>;
  }
  return <p className="text-xs text-zinc-400 italic">No schedule provided</p>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-44 shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-800">{value}</span>
    </div>
  );
}

const WORKFLOW_STEPS: { key: EventStatus; label: string; getDesc: (event: OrganizerEvent) => string }[] = [
  { key: "pending_approval", label: "Request Submitted", getDesc: () => "Awaiting admin review" },
  {
    key: "waiting_for_payment",
    label: "Admin Approved",
    getDesc: (e) =>
      e.payment_amount != null
        ? `Payment required: ${e.payment_amount.toFixed(2)} MAD`
        : "Payment required",
  },
  { key: "payment_done", label: "Payment Confirmed", getDesc: () => "Access links generated" },
  { key: "live", label: "Event Live", getDesc: () => "Event is currently running" },
  { key: "closed", label: "Event Closed", getDesc: () => "Event has ended" },
];

const STEP_ORDER: EventStatus[] = [
  "pending_approval",
  "waiting_for_payment",
  "payment_done",
  "live",
  "closed",
];

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params?.id as string;

  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUrl, setProofUrl] = useState("");

  const fetchEvent = async () => {
    try {
      const data = await eventsApi.getEventById(eventId);
      setEvent(data);
    } catch {
      setError("Could not load event details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

const handleConfirmPayment = async () => {
    const normalizedProofUrl = proofUrl.trim();
    if (!proofFile && !normalizedProofUrl) {
      setError("Please upload an image/PDF proof or provide a URL/path.");
      return;
    }

    if (
      !confirm(
        "Confirm that you have sent the payment to the displayed RIB and wish to submit this proof?"
      )
    )
      return;

    setPaymentLoading(true);
    setError(null);
    try {
      await organizerService.submitPaymentProof(eventId, proofFile ?? normalizedProofUrl);
      // Re-fetch event to show the new state
      await fetchEvent();
      setProofFile(null);
      setProofUrl("");
    } catch (err: any) {
      setError(err.message || "Payment proof submission failed.");
    } finally {
      setPaymentLoading(false);
    }
  };
  const handleDownloadReport = async () => {
    setReportLoading(true);
    setError(null);
    try {
      await organizerService.exportEventReportPDF(eventId);
    } catch (err: any) {
      setError(err.message || "Failed to download report.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleStartEvent = async () => {
    if (!confirm("Are you sure you want to start this event? It will go LIVE and be visible to visitors.")) return;
    setLoading(true);
    try {
      await organizerService.startEvent(eventId);
      await fetchEvent();
    } catch (err: any) {
      setError(err.message || "Failed to start event.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseEvent = async () => {
    if (!confirm("Are you sure you want to close this event? This action is permanent.")) return;
    setLoading(true);
    try {
      await organizerService.closeEvent(eventId);
      await fetchEvent();
    } catch (err: any) {
      setError(err.message || "Failed to close event.");
    } finally {
      setLoading(false);
    }
  };

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
        <Link
          href="/organizer/events"
          className="text-indigo-600 text-sm mt-2 inline-block"
        >
          Back to events
        </Link>
      </div>
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const toAbsoluteLink = (value?: string) => {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) {
      if (!baseUrl) return value;
      try {
        const parsed = new URL(value);
        return `${baseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
      } catch {
        return value;
      }
    }
    if (!baseUrl) return value;
    return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
  };

  const extractToken = (value?: string) => {
    if (!value) return "";
    try {
      const normalized = /^https?:\/\//i.test(value) ? value : `http://local${value.startsWith("/") ? "" : "/"}${value}`;
      const parsed = new URL(normalized);
      return parsed.searchParams.get("token") || "";
    } catch {
      return "";
    }
  };

  const buildInviteLink = (kind: "visitor" | "enterprise", raw?: string) => {
    const token = extractToken(raw);
    const joinPath = `/join/${kind}/${event.id}`;
    return toAbsoluteLink(token ? `${joinPath}?token=${encodeURIComponent(token)}` : joinPath);
  };

  const enterpriseInviteLink = event.enterprise_link ? buildInviteLink("enterprise", event.enterprise_link) : "";
  const visitorInviteLink = event.visitor_link ? buildInviteLink("visitor", event.visitor_link) : "";
  const effectiveState: EventStatus = event.state === 'live' && getEventLifecycle(event as any).status === 'ended'
    ? 'closed'
    : event.state;
  const canPublishEvent = ["payment_done", "live", "closed"].includes(effectiveState);
  const publicityLink = toAbsoluteLink(
    event.publicity_link || (canPublishEvent ? `/events/${event.id}` : "")
  );
  const currentIdx = STEP_ORDER.indexOf(effectiveState);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/organizer/events">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATE_COLORS[effectiveState]}`}
        >
          {STATE_LABELS[effectiveState]}
        </span>
        {(effectiveState === "live" || effectiveState === "closed" || effectiveState === "payment_done") && (
          <div className="flex gap-2 ml-auto">
            {effectiveState !== "payment_done" && (
              <Link href={`/organizer/events/${event.id}/analytics`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <BarChart2 className="w-4 h-4" /> View Analytics
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleDownloadReport}
              isLoading={reportLoading}
            >
              <Download className="w-4 h-4" /> Download Report
            </Button>
            {effectiveState === "payment_done" && (
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700"
                onClick={handleStartEvent}
              >
                <Check className="w-4 h-4" /> Start Event (Go Live)
              </Button>
            )}
            {effectiveState === "live" && (
              <Button
                variant="danger"
                size="sm"
                className="gap-1.5"
                onClick={handleCloseEvent}
              >
                <XCircle className="w-4 h-4" /> Close Event
              </Button>
            )}
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Rejection notice */}
      {event.state === "rejected" && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex gap-2 text-sm text-red-700">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold">Your request was rejected. </span>
            {event.rejection_reason && (
              <span>Reason: {event.rejection_reason}</span>
            )}
          </div>
        </div>
      )}

      {/* Workflow steps */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4" /> Approval Workflow
        </h2>
        <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5 pb-1">
          {WORKFLOW_STEPS.map((step) => {
            const stepIdx = STEP_ORDER.indexOf(step.key);
            const isDone = currentIdx > stepIdx;
            const isCurrent =
              currentIdx === stepIdx && event.state !== "rejected";
            return (
              <li key={step.key} className="ml-5">
                <span
                  className={`absolute -left-[11px] w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${isDone ? "bg-green-500 border-green-500" : isCurrent ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300"}`}
                >
                  {isDone && <Check className="w-3 h-3 text-white" />}
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )}
                </span>
                <div
                  className={
                    isCurrent
                      ? "font-semibold text-gray-900"
                      : isDone
                        ? "text-gray-700"
                        : "text-gray-400"
                  }
                >
                  {step.label}
                  <div
                    className={`text-xs mt-0.5 ${isCurrent ? "text-indigo-600" : isDone ? "text-gray-500" : "text-gray-300"}`}
                  >
                    {step.getDesc(event)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* Payment Banner */}
      {effectiveState === "waiting_for_payment" && (
        <Card className="p-5 border-orange-200 bg-orange-50 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div>
                <div className="font-semibold text-orange-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" /> Payment Required
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  Your event has been approved. To activate it, please send{" "}
                  <span className="font-bold text-orange-900">{event.payment_amount?.toFixed(2)} MAD</span>{" "}
                  to the following RIB and upload a proof of payment.
                </p>
              </div>

              {/* RIB Box */}
              <div className="bg-white border border-orange-200 rounded-lg p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase text-orange-400 tracking-wider">
                  Platform RIB
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-zinc-800 tracking-tighter">
                    {event.rib_code || "007 999 000123456789 01"}
                  </span>
                  <CopyButton text={event.rib_code || "007 999 000123456789 01"} />
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase text-orange-400 tracking-wider">
                  Upload Payment Proof (Image/PDF) or Paste URL
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <div className={`border-2 border-dashed rounded-lg px-4 py-3 flex items-center gap-3 transition-colors ${proofFile ? 'border-orange-500 bg-orange-100/50' : 'border-orange-200 bg-white hover:border-orange-300'}`}>
                      <Upload className={`w-4 h-4 ${proofFile ? 'text-orange-600' : 'text-orange-400'}`} />
                      <span className={`text-sm ${proofFile ? 'text-orange-900 font-medium' : 'text-zinc-500'}`}>
                        {proofFile ? proofFile.name : 'Select image or PDF proof'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf"
                        onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </label>
                  {proofFile && (
                    <button
                      onClick={() => setProofFile(null)}
                      className="p-2 text-orange-400 hover:text-orange-600 transition-colors"
                      title="Clear file"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="https://... or /uploads/payments/..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <Button className="bg-orange-500 hover:bg-orange-600 shrink-0 self-end" isLoading={paymentLoading} disabled={!proofFile && !proofUrl.trim()} onClick={handleConfirmPayment}><FileText className="w-4 h-4 mr-2" />Submit Proof</Button>
          </div>
        </Card>
      )}

      {/* Proof Reviewing Banner */}
      {effectiveState === "payment_proof_submitted" && (
        <Card className="p-5 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Payment Proof Submitted</h3>
              <p className="text-sm text-blue-700">
                Our administration is currently reviewing your payment proof. Your event will be activated shortly.
              </p>
              {event.payment_proof_url && (
                <div className="mt-3">
                  <a
                    href={resolveMediaUrl(event.payment_proof_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> View Submitted Proof
                  </a>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Access links */}
      {(enterpriseInviteLink || visitorInviteLink || publicityLink) && (
        <Card className="p-5 border-indigo-200 bg-indigo-50">
          <h2 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Access Links
          </h2>
          <div className="space-y-4">
            {enterpriseInviteLink && (
              <div>
                <div className="text-xs font-semibold uppercase text-indigo-600 mb-1">
                  Enterprise Guest Invite
                </div>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {enterpriseInviteLink}
                  </span>
                  <CopyButton text={enterpriseInviteLink} />
                </div>
                <p className="text-xs text-indigo-600 mt-1">
                  Share with enterprise guests. They only need to log in, then they are auto-accepted with guest status and no payment.
                </p>
              </div>
            )}
            {visitorInviteLink && (
              <div>
                <div className="text-xs font-semibold uppercase text-indigo-600 mb-1">
                  Visitor Guest Invite
                </div>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {visitorInviteLink}
                  </span>
                  <CopyButton text={visitorInviteLink} />
                </div>
                <p className="text-xs text-indigo-600 mt-1">
                  Share with visitor guests. They only need to log in, then they are auto-accepted with guest status and no payment.
                </p>
              </div>
            )}
            {publicityLink && (
              <div>
                <div className="text-xs font-semibold uppercase text-indigo-600 mb-1">
                  Publicity Link
                </div>
                <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {publicityLink}
                  </span>
                  <CopyButton text={publicityLink} />
                </div>
                <p className="text-xs text-indigo-600 mt-1">
                  Share publicly on social media. This follows the normal registration and payment flow.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
          Event Details
        </h2>
        <div className="space-y-1">
          <InfoRow label="Description" value={event.description} />
          <InfoRow label="Category" value={event.category} />
          <InfoRow label="Location" value={event.location} />
          <InfoRow
            label="Start Date"
            value={
              event.start_date
                ? formatInTZ(event.start_date, event.event_timezone || getUserTimezone(), 'MMM d, yyyy, h:mm a')
                : undefined
            }
          />
          <InfoRow
            label="End Date"
            value={
              event.end_date
                ? formatInTZ(event.end_date, event.event_timezone || getUserTimezone(), 'MMM d, yyyy, h:mm a')
                : undefined
            }
          />
          <InfoRow
            label="Enterprises"
            value={event.num_enterprises?.toString()}
          />
          <InfoRow
            label="Tags"
            value={event.tags?.length ? event.tags.join(", ") : undefined}
          />
        </div>
      </Card>

      {/* Pricing */}
      {(event.stand_price != null || event.is_paid != null) && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pricing
          </h2>
          <div className="space-y-1">
            {event.stand_price != null && (
              <InfoRow
                label="Stand Price"
                value={`${event.stand_price.toFixed(2)} MAD per enterprise`}
              />
            )}
            <InfoRow
              label="Visitor Access"
              value={
                event.is_paid ? (
                  <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                    <Tag className="w-3.5 h-3.5" /> Paid event
                    {event.ticket_price != null && ` — ${event.ticket_price.toFixed(2)} MAD per ticket`}
                  </span>
                ) : (
                  <span className="text-green-700 font-medium">Free — no ticket required</span>
                )
              }
            />
          </div>
        </Card>
      )}

      {/* Conference Management — visible once event is approved / live */}
      {['payment_done', 'live', 'closed'].includes(effectiveState) && (
        <OrganizerEventConferences eventId={eventId} event={event} onEventUpdated={fetchEvent} />
      )}

      {/* Request details */}
      {(event.extended_details ||
        event.event_timeline ||
        event.additional_info) && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Request Details
            </h2>
            <div className="space-y-4">
              {event.extended_details && (
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-400 mb-1">
                    Extended Details
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {event.extended_details}
                  </p>
                </div>
              )}
              {(event.schedule_days?.length || event.event_timeline) && (
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-400 mb-2">
                    Event Schedule
                  </div>
                  <ScheduleDisplay event={event} />
                </div>
              )}
              {event.additional_info && (
                <div>
                  <div className="text-xs font-semibold uppercase text-gray-400 mb-1">
                    Additional Information
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {event.additional_info}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}
    </div>
  );
}


