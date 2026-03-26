"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  Edit2, ExternalLink, Globe, Layout, Link2, MapPin, Mail, MessageSquare, Phone, Plus, Save, Settings, Tag, Users, Video, Clock, DollarSign, ChevronRight, CheckCircle2, AlertCircle, Calendar, 
  Trash2, Copy, Check, ChevronDown, Download, Eye, FileText, Info, Search, X, Pencil, Upload, User, ArrowLeft, CreditCard, CalendarDays, BarChart2, AlertTriangle, XCircle
} from "lucide-react";
import { eventsApi } from "@/lib/api/events";
import { organizerService } from "@/services/organizer.service";
import OrganizerEventConferences from "@/components/conferences/OrganizerEventConferences";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OrganizerEvent, EventStatus, EventScheduleDay } from "@/types/event";
import { getEventLifecycle } from '@/lib/eventLifecycle';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { formatSlotRangeLabel } from '@/lib/schedule';
import ScheduleEditor from "@/components/events/ScheduleEditor";
import { resolveMediaUrl } from '@/lib/media';


const STATE_LABELS: Record<EventStatus, string> = {
  pending_approval: "Pending Review",
  approved: "Approved & Pending Payment",
  rejected: "Rejected",
  waiting_for_payment: "Approved - Waiting Payment",
  payment_proof_submitted: "Payment proof under review",
  payment_done: "Payment Confirmed",
  live: "Event is Live",
  closed: "Event Ended",
};

const STATE_COLORS: Record<EventStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  waiting_for_payment: "bg-indigo-100 text-indigo-700 border-indigo-200",
  payment_proof_submitted: "bg-purple-100 text-purple-700 border-purple-200",
  payment_done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  live: "bg-green-100 text-green-700 border-green-200 animate-pulse",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
};

// ── Schedule renderer (mirrors admin panel) ──────────────────────────────────
function ScheduleDisplay({ event }: { event: OrganizerEvent }) {
  const formatDayLabel = (dayNumber: number, dayIndex: number): string => {
    const dayOffset = Math.max(0, Number(dayNumber || (dayIndex + 1)) - 1);
    const tz = event.event_timezone || getUserTimezone();
    const start = new Date(event.start_date || new Date().toISOString());
    if (Number.isNaN(start.getTime())) return 'Invalid date';

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
      <div className="space-y-3 font-outfit">
        {days.map((day, dayIndex) => (
          <div key={day.day_number} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {day.day_number}
              </span>
              <span className="text-sm font-semibold text-zinc-800">Day {day.day_number}</span>
              <span className="text-xs text-zinc-500 ml-1">— {formatDayLabel(day.day_number, dayIndex)}</span>
            </div>
            <div className="p-3 space-y-2">
              {day.slots.map((slot, si) => (
                <div key={si} className={`flex items-start gap-4 p-3 rounded-xl border ${slot.is_conference ? 'border-violet-200 bg-violet-50/50' : 'border-indigo-100 bg-indigo-50/50'}`}>
                  <span className={`shrink-0 text-[11px] font-black rounded-lg px-2 py-1 whitespace-nowrap tabular-nums shadow-sm ${slot.is_conference ? 'text-violet-700 bg-white border border-violet-200' : 'text-indigo-700 bg-white border border-indigo-200'}`}>
                    {formatSlotRangeLabel(slot.start_time, slot.end_time)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-800 leading-snug">
                      {slot.label || <em className="text-zinc-400 font-normal">No description</em>}
                    </p>
                    {slot.is_conference && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-violet-700 bg-violet-100 border border-violet-200 rounded-md px-2 py-0.5 tracking-tighter flex items-center gap-1">
                          <Video className="w-2.5 h-2.5" /> Conference Room
                        </span>
                        {slot.assigned_enterprise_name && (
                          <span className="text-[10px] font-bold text-violet-500 flex items-center gap-1">
                            <User className="w-3 h-3" /> Speaker: {slot.speaker_name || slot.assigned_enterprise_name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {day.slots.length === 0 && (
                <p className="text-xs text-zinc-400 italic px-1">No slots defined for this day.</p>
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

function MaskedLink({ url }: { url: string }) {
  const maskId = (text: string) => {
    const parts = text.split('/');
    if (parts.length === 0) return text;
    const lastPartWithQuery = parts[parts.length - 1];
    const [idPart, queryPart] = lastPartWithQuery.split('?');
    
    if (idPart.length > 8) {
      const maskedId = `${idPart.substring(0, 4)}........${idPart.substring(idPart.length - 4)}`;
      return text.replace(idPart, maskedId);
    }
    return text;
  };

  return (
    <span className="text-sm text-gray-700 flex-1 truncate font-mono">
      {maskId(url)}
    </span>
  );
}

function EditEventModal({ 
  event, 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  event: OrganizerEvent; 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: event.title,
    description: event.description || "",
    category: event.category || "Exhibition",
    location: event.location || "Virtual Platform",
    tags: event.tags?.join(", ") || "",
    stand_price: event.stand_price?.toString() || "0",
    is_paid: event.is_paid || false,
    ticket_price: event.ticket_price?.toString() || "0",
    extended_details: event.extended_details || "",
    additional_info: event.additional_info || "",
    slug: event.slug || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({
        title: event.title,
        description: event.description || "",
        category: event.category || "Exhibition",
        location: event.location || "Virtual Platform",
        tags: event.tags?.join(", ") || "",
        stand_price: event.stand_price?.toString() || "0",
        is_paid: event.is_paid || false,
        ticket_price: event.ticket_price?.toString() || "0",
        extended_details: event.extended_details || "",
        additional_info: event.additional_info || "",
        slug: event.slug || "",
      });
      setError(null);
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await organizerService.updateEvent(event.id, {
        ...form,
        stand_price: parseFloat(form.stand_price),
        ticket_price: form.is_paid ? parseFloat(form.ticket_price) : undefined,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-full overflow-y-auto p-6 space-y-6 bg-white shadow-2xl rounded-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Pencil className="w-5 h-5 text-indigo-600" />
            </div>
            Edit Event Information
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <XCircle className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Event Title</label>
              <input name="title" value={form.title} onChange={handleChange} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">URL Slug (Friendly ID)</label>
              <input name="slug" value={form.slug} onChange={handleChange} placeholder="e.g. tech-expo-2025" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</label>
              <select name="category" value={form.category} onChange={handleChange} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300 bg-white">
                {["Exhibition", "Conference", "Webinar", "Networking", "Workshop", "Hackathon"].map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300 resize-none" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</label>
              <input name="location" value={form.location} onChange={handleChange} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tags (comma-separated)</label>
              <input name="tags" value={form.tags} onChange={handleChange} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300" />
            </div>
          </div>

          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Stand Price (MAD)
                </label>
                <input name="stand_price" type="number" step="0.01" value={form.stand_price} onChange={handleChange} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <input type="checkbox" name="is_paid" checked={form.is_paid} onChange={handleChange} className="w-4 h-4 accent-indigo-600 rounded" />
                  Paid Event for Visitors
                </label>
                {form.is_paid && (
                  <div className="relative">
                    <input name="ticket_price" type="number" step="0.01" placeholder="Ticket Price" value={form.ticket_price} onChange={handleChange} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300" required />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">MAD</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Extended Details</label>
            <textarea name="extended_details" value={form.extended_details} onChange={handleChange} rows={4} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300 resize-none" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Additional Info</label>
            <textarea name="additional_info" value={form.additional_info} onChange={handleChange} rows={2} className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all hover:border-gray-300 resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="rounded-xl px-6">Cancel</Button>
            <Button type="submit" isLoading={loading} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-8 shadow-lg shadow-indigo-200">Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
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
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

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
    const ref = event.slug || event.id;
    const joinPath = `/join/${kind}/${ref}`;
    return toAbsoluteLink(token ? `${joinPath}?token=${encodeURIComponent(token)}` : joinPath);
  };

  const enterpriseInviteLink = event.enterprise_link ? buildInviteLink("enterprise", event.enterprise_link) : "";
  const visitorInviteLink = event.visitor_link ? buildInviteLink("visitor", event.visitor_link) : "";
  const effectiveState: EventStatus = event.state === 'live' && getEventLifecycle(event as any).status === 'ended'
    ? 'closed'
    : event.state;
  const canPublishEvent = ["payment_done", "live", "closed"].includes(effectiveState);
  const publicityLink = toAbsoluteLink(
    event.publicity_link || (canPublishEvent ? `/events/${event.slug || event.id}` : "")
  );
  const currentIdx = STEP_ORDER.indexOf(effectiveState);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header / Actions Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/organizer/events">
            <Button variant="outline" size="sm" className="w-10 h-10 p-0 rounded-xl hover:bg-zinc-50 border-zinc-200">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 truncate max-w-[300px] md:max-w-md">{event.title}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATE_COLORS[effectiveState]}`}>
                {STATE_LABELS[effectiveState]}
              </span>
            </div>
            {event.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{event.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl text-zinc-600 border-zinc-200"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit Info
          </Button>
          
          <div className="h-6 w-px bg-zinc-200 mx-1 hidden md:block" />

          {effectiveState !== "payment_done" && (
            <Link href={`/organizer/events/${event.id}/analytics`}>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl text-zinc-600 border-zinc-200">
                <BarChart2 className="w-3.5 h-3.5" /> Analytics
              </Button>
            </Link>
          )}

          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl text-zinc-600 border-zinc-200"
            onClick={handleDownloadReport}
            isLoading={reportLoading}
          >
            <Download className="w-3.5 h-3.5" /> Report
          </Button>

          {effectiveState === "payment_done" && (
            <Button
              variant="primary"
              size="sm"
              className="gap-2 rounded-xl bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 border-none"
              onClick={handleStartEvent}
            >
              <Check className="w-3.5 h-3.5" /> Start Event
            </Button>
          )}

          {(effectiveState === "live" || effectiveState === "approved" || effectiveState === "payment_proof_submitted" || effectiveState === "payment_done") && (
            <Button
              variant="danger"
              size="sm"
              className="gap-2 rounded-xl shadow-lg shadow-red-100 hover:bg-red-600"
              onClick={handleCloseEvent}
            >
              <XCircle className="w-3.5 h-3.5" /> Close Event
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex p-1 bg-zinc-100 border border-zinc-200/50 rounded-2xl w-fit">
        {[
          { id: "overview", label: "Overview", icon: Info },
          { id: "schedule", label: "Schedule", icon: CalendarDays },
          { id: "conferences", label: "Conferences", icon: Video },
          { id: "links", label: "Links", icon: Link2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50"
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-indigo-600" : "text-zinc-400"}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex gap-2 mb-6">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Approval Workflow (Moved here from main list) */}
            <Card className="p-6 rounded-3xl border-zinc-100 shadow-sm">
              <h2 className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-300" /> Approval Workflow
              </h2>
              <ol className="relative border-l-2 border-zinc-100 ml-4 space-y-8 pb-1">
                {WORKFLOW_STEPS.map((step) => {
                  const stepIdx = STEP_ORDER.indexOf(step.key);
                  const isDone = currentIdx > stepIdx;
                  const isCurrent = currentIdx === stepIdx && event.state !== "rejected";
                  return (
                    <li key={step.key} className="ml-8 relative">
                      <span
                        className={`absolute -left-[41px] w-6 h-6 rounded-full border-4 flex items-center justify-center transition-all duration-500 z-10
                          ${isDone ? "bg-green-500 border-green-100" : isCurrent ? "bg-indigo-600 border-indigo-100 scale-110 shadow-lg shadow-indigo-200" : "bg-white border-zinc-50"}`}
                      >
                        {isDone && <Check className="w-3 h-3 text-white" />}
                        {isCurrent && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                      </span>
                      <div className={isCurrent ? "translate-x-1 transition-transform" : ""}>
                         <h3 className={`text-sm font-bold ${isCurrent ? "text-gray-900" : isDone ? "text-gray-700" : "text-gray-300"}`}>
                          {step.label}
                        </h3>
                        <p className={`text-[11px] mt-0.5 flex items-center gap-1.5 ${isCurrent ? "text-indigo-600 font-medium" : isDone ? "text-gray-500" : "text-gray-300"}`}>
                          {isCurrent && <span className="w-1 h-1 rounded-full bg-indigo-600 block" />}
                          {step.getDesc(event)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {/* Banners for specific states */}
            {effectiveState === "waiting_for_payment" && (
              <Card className="p-6 border-orange-200 bg-gradient-to-br from-orange-50 to-white rounded-3xl shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="space-y-4 flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                      <CreditCard className="w-4 h-4" /> Action Required
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-orange-900">Finalize Payment</h3>
                      <p className="text-sm text-orange-700 mt-1 leading-relaxed">
                        To activate your event and generate guest links, please send <span className="font-black text-orange-900 underline decoration-orange-300 underline-offset-4">{event.payment_amount?.toFixed(2)} MAD</span> to the Platform RIB below.
                      </p>
                    </div>

                    <div className="bg-white/60 border border-orange-200/50 backdrop-blur-sm rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-orange-400 tracking-widest">Platform RIB</label>
                          <div className="font-mono text-base font-bold text-zinc-800 tracking-tighter">
                            {event.rib_code || "007 999 000123456789 01"}
                          </div>
                        </div>
                        <CopyButton text={event.rib_code || "007 999 000123456789 01"} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase text-orange-400 tracking-widest">Upload Proof (Image/PDF)</label>
                      <div className="flex flex-col gap-3">
                        <label className="group relative flex-1 cursor-pointer">
                          <div className={`border-2 border-dashed rounded-2xl px-5 py-4 flex items-center gap-4 transition-all duration-300 ${proofFile ? 'border-orange-500 bg-orange-50' : 'border-zinc-200 bg-white hover:border-orange-400 hover:bg-orange-50/30'}`}>
                            <div className={`p-2 rounded-xl ${proofFile ? 'bg-orange-500 text-white' : 'bg-zinc-100 text-zinc-400 group-hover:bg-orange-100 group-hover:text-orange-500'}`}>
                              <Upload className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className={`text-sm truncate ${proofFile ? 'text-orange-900 font-bold' : 'text-zinc-500 font-medium'}`}>
                                {proofFile ? proofFile.name : 'Choose file or drag here'}
                              </p>
                              <p className="text-[10px] text-zinc-400">PDF, JPG, PNG up to 10MB</p>
                            </div>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,application/pdf"
                              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            />
                          </div>
                        </label>
                        <div className="relative group">
                          <input
                            type="text"
                            placeholder="...or paste proof URL here"
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all"
                          />
                          <Link2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="bg-orange-500 hover:bg-orange-600 rounded-2xl h-14 px-8 text-base shadow-xl shadow-orange-200 border-none self-end" 
                    isLoading={paymentLoading} 
                    disabled={!proofFile && !proofUrl.trim()} 
                    onClick={handleConfirmPayment}
                  >
                    Submit Payment Proof
                  </Button>
                </div>
              </Card>
            )}

            {effectiveState === "payment_proof_submitted" && (
              <Card className="p-6 border-blue-100 bg-gradient-to-br from-blue-50 to-white rounded-3xl shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-lg shadow-blue-100 flex items-center justify-center text-blue-600 border border-blue-100">
                    <Clock className="w-7 h-7 animate-spin-slow" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-blue-950">Under Review</h3>
                    <p className="text-sm text-blue-700/80 leading-relaxed mt-1">
                      Our financial team is verifying your payment. This typically takes 1-2 hours during business hours.
                    </p>
                    {event.payment_proof_url && (
                      <div className="mt-4">
                        <a
                          href={resolveMediaUrl(event.payment_proof_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 bg-white shadow-sm border border-blue-100 px-4 py-2 rounded-xl hover:bg-blue-50 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Submitted Proof
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Core Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 rounded-3xl border-zinc-100 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Description & Goals</h2>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                </div>
                {event.extended_details && (
                  <div>
                    <h2 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Extended Context</h2>
                    <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap line-clamp-6">{event.extended_details}</p>
                  </div>
                )}
                {event.additional_info && (
                   <div>
                    <h2 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Operational Notes</h2>
                    <p className="text-sm text-zinc-600 leading-relaxed italic border-l-4 border-zinc-100 pl-4">{event.additional_info}</p>
                  </div>
                )}
              </Card>

              <div className="space-y-6">
                <Card className="p-6 rounded-3xl border-zinc-100 shadow-sm">
                  <h2 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Quick Info</h2>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-50 rounded-lg"><Tag className="w-4 h-4 text-zinc-400" /></div>
                      <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Category</p>
                        <p className="text-sm font-semibold text-zinc-800">{event.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-50 rounded-lg"><ExternalLink className="w-4 h-4 text-zinc-400" /></div>
                      <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Location</p>
                        <p className="text-sm font-semibold text-zinc-800">{event.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-50 rounded-lg"><Users className="w-4 h-4 text-zinc-400" /></div>
                      <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Enterprise Allocation</p>
                        <p className="text-sm font-semibold text-zinc-800">{event.num_enterprises} Stands</p>
                      </div>
                    </div>
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-50 rounded-lg"><Settings className="w-4 h-4 text-zinc-400" /></div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {event.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-bold px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-md">#{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-6 rounded-3xl border-zinc-100 shadow-sm bg-zinc-50/50">
                  <h2 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-zinc-300" /> Financial Settings
                  </h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-zinc-100 pb-3">
                      <div>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">Stand Price</p>
                        <p className="text-lg font-black text-zinc-800 tracking-tight">{event.stand_price?.toFixed(2)} <span className="text-xs font-normal text-zinc-400 uppercase">MAD</span></p>
                      </div>
                      <span className="text-[10px] text-zinc-400 mb-1">Per Enterprise</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter mb-2">Visitor Access</p>
                      {event.is_paid ? (
                        <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                          <span className="text-sm font-bold text-orange-700">Paid Entry</span>
                          <span className="text-sm font-black text-orange-800">{event.ticket_price?.toFixed(2)} MAD</span>
                        </div>
                      ) : (
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <span className="text-sm font-bold text-green-700">Free Access</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-6">
            <Card className="p-8 rounded-3xl border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Event Schedule</h2>
                  <p className="text-sm text-zinc-500">Timeline and session breakdown across the event duration.</p>
                </div>
                <div className="flex items-center gap-3">
                  {!isEditingSchedule && (
                    <Button 
                        size="sm" 
                        onClick={() => setIsEditingSchedule(true)}
                        className="rounded-xl h-10 border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 border shadow-sm px-4"
                    >
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Schedule
                    </Button>
                  )}
                  <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-600">{event.event_timezone || "UTC"}</span>
                  </div>
                </div>
              </div>
              {isEditingSchedule ? (
                <ScheduleEditor 
                  eventId={eventId} 
                  initialDays={event.schedule_days || []} 
                  onSave={(newDays) => {
                    setEvent({ ...event, schedule_days: newDays });
                    setIsEditingSchedule(false);
                  }}
                  onCancel={() => setIsEditingSchedule(false)}
                />
              ) : (
                <ScheduleDisplay event={event} />
              )}
            </Card>
          </div>
        )}

        {activeTab === "conferences" && (
          <div className="animate-in zoom-in-95 duration-300">
            {['payment_done', 'live', 'closed'].includes(effectiveState) ? (
              <OrganizerEventConferences eventId={eventId} event={event} onEventUpdated={fetchEvent} />
            ) : (
              <Card className="p-12 text-center rounded-3xl border-zinc-100 bg-zinc-50/30 border-dashed">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-base font-bold text-zinc-800">Conferences Locked</h3>
                <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
                  Conference management will become available once the event is approved and payment is confirmed.
                </p>
              </Card>
            )}
          </div>
        )}

        {activeTab === "links" && (
          <div className="space-y-6">
            {(enterpriseInviteLink || visitorInviteLink || publicityLink) ? (
              <Card className="p-8 border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white rounded-3xl shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                    <Link2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-indigo-950">Invitation & Publication Links</h2>
                    <p className="text-sm text-indigo-600/70 font-medium">Share these links to invite guests. IDs are masked for security.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-8">
                  {enterpriseInviteLink && (
                    <div className="group">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-4 bg-indigo-400 rounded-full" />
                         <span className="text-xs font-black uppercase text-indigo-900 tracking-wider">Enterprise Guest Invite</span>
                      </div>
                      <div className="flex items-center gap-3 bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm group-hover:border-indigo-300 transition-all duration-300">
                        <MaskedLink url={enterpriseInviteLink} />
                        <div className="h-8 w-px bg-zinc-100 mx-1" />
                        <CopyButton text={enterpriseInviteLink} />
                      </div>
                      <p className="text-[11px] text-indigo-500 mt-2 ml-1 leading-relaxed">
                        Share with exhibitors. They are auto-accepted as guests without requiring registration payment.
                      </p>
                    </div>
                  )}
                  
                  {visitorInviteLink && (
                    <div className="group">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-4 bg-indigo-400 rounded-full" />
                         <span className="text-xs font-black uppercase text-indigo-900 tracking-wider">Visitor Guest Invite</span>
                      </div>
                      <div className="flex items-center gap-3 bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm group-hover:border-indigo-300 transition-all duration-300">
                        <MaskedLink url={visitorInviteLink} />
                        <div className="h-8 w-px bg-zinc-100 mx-1" />
                        <CopyButton text={visitorInviteLink} />
                      </div>
                      <p className="text-[11px] text-indigo-500 mt-2 ml-1 leading-relaxed">
                        Share with VIP visitors. They get full access bypass and skip the ticket purchase flow.
                      </p>
                    </div>
                  )}

                  {publicityLink && (
                    <div className="group">
                      <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-4 bg-indigo-400 rounded-full" />
                         <span className="text-xs font-black uppercase text-indigo-900 tracking-wider">Public Publication Link</span>
                      </div>
                      <div className="flex items-center gap-3 bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm group-hover:border-indigo-300 transition-all duration-300">
                        <MaskedLink url={publicityLink} />
                        <div className="h-8 w-px bg-zinc-100 mx-1" />
                        <CopyButton text={publicityLink} />
                      </div>
                      <p className="text-[11px] text-indigo-500 mt-2 ml-1 leading-relaxed">
                        Share on social media. Visitors using this link follow the normal registration and ticket flow.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center rounded-3xl border-zinc-100 bg-zinc-50/30 border-dashed">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-zinc-100 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="w-8 h-8 text-zinc-300" />
                </div>
                <h3 className="text-base font-bold text-zinc-800">Links Not Generated</h3>
                <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
                  Access links are generated once payment is confirmed by the administration.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <EditEventModal 
        event={event} 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSuccess={fetchEvent}
      />
    </div>
  );
}
