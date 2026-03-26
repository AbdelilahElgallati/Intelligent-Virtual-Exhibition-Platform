"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { eventsApi } from "@/lib/api/events";
import { OrganizerEvent, EventStatus, EventScheduleDay, EventScheduleSlot } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
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
  Pencil,
  Save,
  X,
  CalendarCheck,
  Globe,
  MapPin,
  Users,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { organizerService } from "@/services/organizer.service";
import OrganizerEventConferences from "@/components/conferences/OrganizerEventConferences";
import { resolveMediaUrl } from '@/lib/media';
import { getEventLifecycle } from '@/lib/eventLifecycle';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';

// ─── Constants ───────────────────────────────────────────────────────────────

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
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-blue-100 text-blue-700 border-blue-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  waiting_for_payment: "bg-orange-100 text-orange-700 border-orange-200",
  payment_proof_submitted: "bg-sky-100 text-sky-700 border-sky-200",
  payment_done: "bg-indigo-100 text-indigo-700 border-indigo-200",
  live: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-zinc-100 text-zinc-600 border-zinc-300",
};

const WORKFLOW_STEPS: { key: EventStatus; label: string; getDesc: (e: OrganizerEvent) => string }[] = [
  { key: "pending_approval", label: "Request Submitted", getDesc: () => "Awaiting admin review" },
  {
    key: "waiting_for_payment",
    label: "Admin Approved",
    getDesc: (e) =>
      e.payment_amount != null ? `Payment required: ${e.payment_amount.toFixed(2)} MAD` : "Payment required",
  },
  { key: "payment_done", label: "Payment Confirmed", getDesc: () => "Access links generated" },
  { key: "live", label: "Event Live", getDesc: () => "Event is currently running" },
  { key: "closed", label: "Event Closed", getDesc: () => "Event has ended" },
];

const STEP_ORDER: EventStatus[] = ["pending_approval", "waiting_for_payment", "payment_done", "live", "closed"];

type TabId = "overview" | "schedule" | "conferences" | "links";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskId(id?: string): string {
  if (!id) return "••••";
  if (id.length <= 8) return "••••••••";
  return id.slice(0, 4) + "••••••••" + id.slice(-4);
}

// ─── Small UI primitives ─────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
      title="Copy link"
    >
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all";
const textareaCls = `${inputCls} resize-none`;

// ─── Edit Event Info Modal ────────────────────────────────────────────────────

interface EditInfoModalProps {
  event: OrganizerEvent;
  open: boolean;
  onClose: () => void;
  onSave: (updated: OrganizerEvent) => void;
}

function EditInfoModal({ event, open, onClose, onSave }: EditInfoModalProps) {
  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? "",
    category: event.category ?? "",
    location: event.location ?? "",
    event_timezone: event.event_timezone ?? "",
    start_date: event.start_date ? event.start_date.slice(0, 16) : "",
    end_date: event.end_date ? event.end_date.slice(0, 16) : "",
    tags: event.tags?.join(", ") ?? "",
    extended_details: event.extended_details ?? "",
    additional_info: event.additional_info ?? "",
    num_enterprises: event.num_enterprises ?? 0,
    stand_price: event.stand_price ?? 0,
    is_paid: event.is_paid ?? false,
    ticket_price: event.ticket_price ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: event.title,
        description: event.description ?? "",
        category: event.category ?? "",
        location: event.location ?? "",
        event_timezone: event.event_timezone ?? "",
        start_date: event.start_date ? event.start_date.slice(0, 16) : "",
        end_date: event.end_date ? event.end_date.slice(0, 16) : "",
        tags: event.tags?.join(", ") ?? "",
        extended_details: event.extended_details ?? "",
        additional_info: event.additional_info ?? "",
        num_enterprises: event.num_enterprises ?? 0,
        stand_price: event.stand_price ?? 0,
        is_paid: event.is_paid ?? false,
        ticket_price: event.ticket_price ?? 0,
      });
      setError(null);
    }
  }, [open, event]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const updated = await eventsApi.updateEvent(event.id, {
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        location: form.location || undefined,
        event_timezone: form.event_timezone || undefined,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : undefined,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
        extended_details: form.extended_details || undefined,
        additional_info: form.additional_info || undefined,
        num_enterprises: Number(form.num_enterprises) || undefined,
        stand_price: Number(form.stand_price) || undefined,
        is_paid: form.is_paid,
        ticket_price: form.is_paid ? Number(form.ticket_price) || undefined : undefined,
      });
      onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Edit Event</h2>
            <p className="text-xs text-zinc-500">Update event information and settings</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Basic Info</h3>
            <div className="space-y-4">
              <FormField label="Title" required>
                <input className={inputCls} value={form.title} onChange={set("title")} required />
              </FormField>
              <FormField label="Description">
                <textarea className={textareaCls} rows={3} value={form.description} onChange={set("description")} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Category">
                  <input className={inputCls} value={form.category} onChange={set("category")} />
                </FormField>
                <FormField label="Location">
                  <input className={inputCls} value={form.location} onChange={set("location")} />
                </FormField>
              </div>
              <FormField label="Tags (comma separated)">
                <input className={inputCls} value={form.tags} onChange={set("tags")} placeholder="tech, AI, networking" />
              </FormField>
            </div>
          </section>

          <hr className="border-zinc-100" />

          {/* Dates */}
          <section>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Dates & Timezone</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date">
                  <input className={inputCls} type="datetime-local" value={form.start_date} onChange={set("start_date")} />
                </FormField>
                <FormField label="End Date">
                  <input className={inputCls} type="datetime-local" value={form.end_date} onChange={set("end_date")} />
                </FormField>
              </div>
              <FormField label="Event Timezone">
                <input className={inputCls} value={form.event_timezone} onChange={set("event_timezone")} placeholder="e.g. Africa/Casablanca" />
              </FormField>
            </div>
          </section>

          <hr className="border-zinc-100" />

          {/* Capacity & Pricing */}
          <section>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Capacity & Pricing</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Max Enterprises">
                  <input className={inputCls} type="number" min={1} value={form.num_enterprises} onChange={set("num_enterprises")} />
                </FormField>
                <FormField label="Stand Price (MAD)">
                  <input className={inputCls} type="number" min={0} step={0.01} value={form.stand_price} onChange={set("stand_price")} />
                </FormField>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                <input
                  type="checkbox"
                  id="is_paid"
                  checked={form.is_paid}
                  onChange={e => setForm(prev => ({ ...prev, is_paid: e.target.checked }))}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <label htmlFor="is_paid" className="text-sm font-medium text-zinc-700">Visitor tickets are paid</label>
              </div>
              {form.is_paid && (
                <FormField label="Ticket Price (MAD)">
                  <input className={inputCls} type="number" min={0} step={0.01} value={form.ticket_price} onChange={set("ticket_price")} />
                </FormField>
              )}
            </div>
          </section>

          <hr className="border-zinc-100" />

          {/* Additional */}
          <section>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Additional Details</h3>
            <div className="space-y-4">
              <FormField label="Extended Details">
                <textarea className={textareaCls} rows={3} value={form.extended_details} onChange={set("extended_details")} placeholder="Detailed event description for attendees..." />
              </FormField>
              <FormField label="Additional Info">
                <textarea className={textareaCls} rows={3} value={form.additional_info} onChange={set("additional_info")} placeholder="Logistics, dress code, parking, etc." />
              </FormField>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all disabled:opacity-60"
            >
              {loading ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Schedule Slot Editor ─────────────────────────────────────────────────────

function ScheduleEditor({ event, onSave }: { event: OrganizerEvent; onSave: (days: EventScheduleDay[]) => Promise<void> }) {
  const [days, setDays] = useState<EventScheduleDay[]>(event.schedule_days ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDays(event.schedule_days ?? []);
  }, [event.schedule_days]);

  const updateSlot = (dayIdx: number, slotIdx: number, field: keyof EventScheduleSlot, value: string | boolean) => {
    setDays(prev => {
      const next = prev.map(d => ({ ...d, slots: [...d.slots] }));
      (next[dayIdx].slots[slotIdx] as any)[field] = value;
      return next;
    });
    setSaved(false);
  };

  const addSlot = (dayIdx: number) => {
    setDays(prev => {
      const next = prev.map(d => ({ ...d, slots: [...d.slots] }));
      next[dayIdx].slots.push({ start_time: "09:00", end_time: "10:00", label: "" });
      return next;
    });
    setSaved(false);
  };

  const removeSlot = (dayIdx: number, slotIdx: number) => {
    setDays(prev => {
      const next = prev.map(d => ({ ...d, slots: [...d.slots] }));
      next[dayIdx].slots.splice(slotIdx, 1);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(days);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  const formatDayDate = (dayNumber: number): string => {
    const dayOffset = Math.max(0, dayNumber - 1);
    const tz = event.event_timezone || getUserTimezone();
    const start = new Date(event.start_date || new Date().toISOString());
    if (Number.isNaN(start.getTime())) return `Day ${dayNumber}`;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(start);
    const yr = Number(parts.find(p => p.type === "year")?.value);
    const mo = Number(parts.find(p => p.type === "month")?.value);
    const dy = Number(parts.find(p => p.type === "day")?.value);
    if (!yr || !mo || !dy) return `Day ${dayNumber}`;
    const anchor = new Date(Date.UTC(yr, mo - 1, dy + dayOffset, 12));
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: tz }).format(anchor);
  };

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
        <CalendarDays className="w-10 h-10 text-zinc-300 mb-3" />
        <p className="text-sm font-semibold text-zinc-400">No schedule defined yet</p>
        <p className="text-xs text-zinc-400 mt-1">Contact admin to request new days. You can add slots once days are added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Edit slots within existing days. To add or remove days, contact the administrator.</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
        >
          {saving ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Schedule"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {days.map((day, dayIdx) => (
        <div key={day.day_number} className="border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          {/* Day header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-zinc-100">
            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {day.day_number}
            </span>
            <div>
              <span className="text-sm font-bold text-zinc-800">Day {day.day_number}</span>
              <span className="text-xs text-zinc-500 ml-2">— {formatDayDate(day.day_number)}</span>
            </div>
            <button
              onClick={() => addSlot(dayIdx)}
              className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slot
            </button>
          </div>

          {/* Slots */}
          <div className="p-4 space-y-3">
            {day.slots.map((slot, slotIdx) => (
              <div
                key={slotIdx}
                className={`rounded-xl border p-4 space-y-3 ${slot.is_conference ? "border-violet-200 bg-violet-50/40" : "border-zinc-200 bg-zinc-50/60"}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={e => updateSlot(dayIdx, slotIdx, "start_time", e.target.value)}
                      className="border border-zinc-200 rounded-lg px-2 py-1.5 text-sm font-mono text-indigo-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <span className="text-xs text-zinc-400 font-semibold">→</span>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={e => updateSlot(dayIdx, slotIdx, "end_time", e.target.value)}
                      className="border border-zinc-200 rounded-lg px-2 py-1.5 text-sm font-mono text-indigo-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    {slot.is_conference && (
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5">
                        🎙️ Conference
                      </span>
                    )}
                    <button
                      onClick={() => removeSlot(dayIdx, slotIdx)}
                      className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Remove slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  placeholder="Activity label / description"
                  value={slot.label}
                  onChange={e => updateSlot(dayIdx, slotIdx, "label", e.target.value)}
                />

                {slot.is_conference && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white text-zinc-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                      placeholder="Speaker name"
                      value={slot.speaker_name ?? ""}
                      onChange={e => updateSlot(dayIdx, slotIdx, "speaker_name", e.target.value)}
                    />
                    <input
                      className="border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white text-zinc-700 placeholder:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
                      placeholder="Speaker organization"
                      value={slot.assigned_enterprise_name ?? ""}
                      onChange={e => updateSlot(dayIdx, slotIdx, "assigned_enterprise_name", e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}

            {day.slots.length === 0 && (
              <div className="text-center py-6 text-xs text-zinc-400 italic">
                No slots yet. Click "Add Slot" above.
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Links Tab ────────────────────────────────────────────────────────────────

function LinkRow({ label, description, displayUrl, realUrl }: { label: string; description: string; displayUrl: string; realUrl: string }) {
  if (!realUrl) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-2 bg-white border border-indigo-200 rounded-xl px-4 py-3 group">
        <span className="text-sm text-zinc-600 flex-1 truncate font-mono">{displayUrl}</span>
        <a href={realUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Open link">
          <ExternalLink className="w-4 h-4" />
        </a>
        <CopyButton text={realUrl} />
      </div>
      <p className="text-xs text-indigo-600/80">{description}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const fetchEvent = useCallback(async () => {
    try {
      const data = await eventsApi.getEventById(eventId);
      setEvent(data);
    } catch {
      setError("Could not load event details.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  const handleConfirmPayment = async () => {
    const normalizedProofUrl = proofUrl.trim();
    if (!proofFile && !normalizedProofUrl) {
      setError("Please upload a payment proof image/PDF or provide a URL.");
      return;
    }
    if (!confirm("Confirm that you have sent the payment to the RIB and wish to submit this proof?")) return;
    setPaymentLoading(true);
    setError(null);
    try {
      await organizerService.submitPaymentProof(eventId, proofFile ?? normalizedProofUrl);
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

  const handleSaveSchedule = async (days: EventScheduleDay[]) => {
    if (!event) return;
    const updated = await eventsApi.updateEvent(event.id, {
      schedule_days: days,
      event_timeline: JSON.stringify(days),
    });
    setEvent(updated);
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
      <div className="text-center py-20 text-zinc-400">
        <p>Event not found.</p>
        <Link href="/organizer/events" className="text-indigo-600 text-sm mt-2 inline-block">← Back to events</Link>
      </div>
    );
  }

  // ── Derived state ──
  const effectiveState: EventStatus = event.state === "live" && getEventLifecycle(event as any).status === "ended" ? "closed" : event.state;
  const canPublishEvent = ["payment_done", "live", "closed"].includes(effectiveState);
  const currentIdx = STEP_ORDER.indexOf(effectiveState);
  const isEditable = ["pending_approval", "approved", "waiting_for_payment"].includes(effectiveState);

  // ── Link helpers ──
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const extractToken = (value?: string) => {
    if (!value) return "";
    try {
      const norm = /^https?:\/\//i.test(value) ? value : `http://local${value.startsWith("/") ? "" : "/"}${value}`;
      return new URL(norm).searchParams.get("token") || "";
    } catch { return ""; }
  };
  const toAbsolute = (path: string) => `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const buildInviteLink = (kind: "visitor" | "enterprise", raw?: string) => {
    const token = extractToken(raw);
    const joinPath = `/join/${kind}/${event.id}`;
    return toAbsolute(token ? `${joinPath}?token=${encodeURIComponent(token)}` : joinPath);
  };

  const enterpriseLink = event.enterprise_link ? buildInviteLink("enterprise", event.enterprise_link) : "";
  const visitorLink = event.visitor_link ? buildInviteLink("visitor", event.visitor_link) : "";
  const publicityLink = event.publicity_link
    ? (/^https?:\/\//i.test(event.publicity_link) ? toAbsolute(new URL(event.publicity_link).pathname) : toAbsolute(event.publicity_link))
    : (canPublishEvent ? toAbsolute(`/events/${event.id}`) : "");

  // Masked display versions (replace raw ID with *****)
  const maskLink = (url: string) => url.replace(event.id, maskId(event.id));

  const hasLinks = !!(enterpriseLink || visitorLink || publicityLink);

  const TABS = [
    { id: "overview" as TabId, label: "Overview", icon: <Info className="w-4 h-4" />, show: true },
    { id: "schedule" as TabId, label: "Schedule", icon: <CalendarDays className="w-4 h-4" />, show: true },
    { id: "conferences" as TabId, label: "Conferences", icon: <Video className="w-4 h-4" />, show: !!canPublishEvent },
    { id: "links" as TabId, label: "Links", icon: <Link2 className="w-4 h-4" />, show: !!hasLinks },
  ].filter(t => t.show);


  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* ── Header ── */}
      <div className="flex items-start gap-4 flex-wrap">
        <Link href="/organizer/events">
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">{event.title}</h1>
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${STATE_COLORS[effectiveState]}`}>
              {STATE_LABELS[effectiveState]}
            </span>
          </div>
          {event.description && <p className="text-sm text-zinc-500 line-clamp-1">{event.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isEditable && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {["live", "payment_done", "closed"].includes(effectiveState) && (
            <>
              {effectiveState !== "payment_done" && (
                <Link href={`/organizer/events/${event.id}/analytics`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <BarChart2 className="w-4 h-4" /> Analytics
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadReport} isLoading={reportLoading}>
                <Download className="w-4 h-4" /> Report
              </Button>
              {effectiveState === "payment_done" && (
                <Button variant="primary" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleStartEvent}>
                  <Check className="w-4 h-4" /> Go Live
                </Button>
              )}
              {effectiveState === "live" && (
                <Button variant="danger" size="sm" className="gap-1.5" onClick={handleCloseEvent}>
                  <XCircle className="w-4 h-4" /> Close Event
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Rejection ── */}
      {event.state === "rejected" && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div><span className="font-bold">Event Rejected. </span>{event.rejection_reason && <span>Reason: {event.rejection_reason}</span>}</div>
        </div>
      )}

      {/* ── Payment Banner ── */}
      {effectiveState === "waiting_for_payment" && (
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-orange-900">Payment Required</h3>
                <p className="text-sm text-orange-700">
                  Send <span className="font-bold">{event.payment_amount?.toFixed(2)} MAD</span> to the RIB below, then upload proof.
                </p>
              </div>
            </div>
            <div className="bg-white border border-orange-200 rounded-xl p-3 flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-zinc-800 tracking-wide">{event.rib_code || "007 999 000123456789 01"}</span>
              <CopyButton text={event.rib_code || "007 999 000123456789 01"} />
            </div>
            <div className="space-y-2">
              <label className="cursor-pointer block">
                <div className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${proofFile ? "border-orange-500 bg-orange-50" : "border-orange-200 bg-white hover:border-orange-300"}`}>
                  <Upload className={`w-4 h-4 shrink-0 ${proofFile ? "text-orange-600" : "text-orange-400"}`} />
                  <span className={`text-sm ${proofFile ? "text-orange-900 font-medium" : "text-zinc-500"}`}>
                    {proofFile ? proofFile.name : "Upload proof (image or PDF)"}
                  </span>
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                </div>
              </label>
              <input
                type="text"
                placeholder="Or paste a proof URL…"
                value={proofUrl}
                onChange={e => setProofUrl(e.target.value)}
                className={inputCls}
              />
            </div>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              isLoading={paymentLoading}
              disabled={!proofFile && !proofUrl.trim()}
              onClick={handleConfirmPayment}
            >
              <FileText className="w-4 h-4 mr-2" /> Submit Proof
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Payment Reviewing ── */}
      {effectiveState === "payment_proof_submitted" && (
        <Card className="border-sky-200 bg-sky-50">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-bold text-sky-900">Payment Proof Under Review</h3>
              <p className="text-sm text-sky-700 mt-0.5">Our team is reviewing your submission. Your event will be activated shortly.</p>
              {event.payment_proof_url && (
                <a href={resolveMediaUrl(event.payment_proof_url)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-sky-600 bg-white border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-100 transition-all">
                  <ExternalLink className="w-3 h-3" /> View Submitted Proof
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Workflow */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                <Clock className="w-4 h-4 text-indigo-500" /> Approval Workflow
              </div>
            </CardHeader>
            <CardContent className="pb-5">
              <ol className="relative border-l-2 border-zinc-200 ml-3 space-y-5">
                {WORKFLOW_STEPS.map(step => {
                  const stepIdx = STEP_ORDER.indexOf(step.key);
                  const isDone = currentIdx > stepIdx;
                  const isCurrent = currentIdx === stepIdx && event.state !== "rejected";
                  return (
                    <li key={step.key} className="ml-5">
                      <span className={`absolute -left-[11px] w-5 h-5 rounded-full border-2 flex items-center justify-center ${isDone ? "bg-emerald-500 border-emerald-500" : isCurrent ? "bg-indigo-600 border-indigo-600" : "bg-white border-zinc-300"}`}>
                        {isDone && <Check className="w-3 h-3 text-white" />}
                        {isCurrent && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <div className={isCurrent ? "font-bold text-zinc-900" : isDone ? "text-zinc-700" : "text-zinc-400"}>
                        {step.label}
                        <div className={`text-xs mt-0.5 ${isCurrent ? "text-indigo-600" : isDone ? "text-zinc-500" : "text-zinc-300"}`}>
                          {step.getDesc(event)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <Info className="w-4 h-4 text-indigo-500" /> Event Details
                </div>
                {isEditable && (
                  <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: <CalendarCheck className="w-4 h-4" />, label: "Start", value: event.start_date ? formatInTZ(event.start_date, event.event_timezone || getUserTimezone(), "MMM d, yyyy · h:mm a") : undefined },
                  { icon: <CalendarCheck className="w-4 h-4" />, label: "End", value: event.end_date ? formatInTZ(event.end_date, event.event_timezone || getUserTimezone(), "MMM d, yyyy · h:mm a") : undefined },
                  { icon: <Globe className="w-4 h-4" />, label: "Timezone", value: event.event_timezone },
                  { icon: <MapPin className="w-4 h-4" />, label: "Location", value: event.location },
                  { icon: <Tag className="w-4 h-4" />, label: "Category", value: event.category },
                  { icon: <Users className="w-4 h-4" />, label: "Max Enterprises", value: event.num_enterprises?.toString() },
                ].filter(r => r.value).map(row => (
                  <div key={row.label} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-zinc-400 mt-0.5 shrink-0">{row.icon}</span>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{row.label}</div>
                      <div className="text-sm font-medium text-zinc-800 mt-0.5">{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              {event.tags?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {event.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
              {event.description && (
                <p className="mt-4 text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-4">{event.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Pricing */}
          {(event.stand_price != null || event.is_paid != null) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <DollarSign className="w-4 h-4 text-indigo-500" /> Pricing
                </div>
              </CardHeader>
              <CardContent className="pb-5">
                <div className="grid grid-cols-2 gap-4">
                  {event.stand_price != null && (
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Stand Price</div>
                      <div className="text-lg font-black text-zinc-800 mt-1">{event.stand_price.toFixed(2)} <span className="text-sm text-zinc-500">MAD / enterprise</span></div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Visitor Access</div>
                    {event.is_paid ? (
                      <div className="mt-1">
                        <span className="text-sm font-bold text-orange-600">Paid</span>
                        {event.ticket_price != null && <span className="text-sm text-zinc-600"> · {event.ticket_price.toFixed(2)} MAD/ticket</span>}
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-emerald-600 mt-1">Free Entry</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extended / Additional */}
          {(event.extended_details || event.additional_info) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                  <FileText className="w-4 h-4 text-indigo-500" /> Additional Information
                </div>
              </CardHeader>
              <CardContent className="pb-5 space-y-4">
                {event.extended_details && (
                  <div>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1">Extended Details</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{event.extended_details}</p>
                  </div>
                )}
                {event.additional_info && (
                  <div>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1">Additional Info</div>
                    <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{event.additional_info}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: Schedule ── */}
      {activeTab === "schedule" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-700">
              <CalendarDays className="w-4 h-4 text-indigo-500" /> Event Schedule
            </div>
          </CardHeader>
          <CardContent className="pb-5">
            <ScheduleEditor event={event} onSave={handleSaveSchedule} />
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Conferences ── */}
      {activeTab === "conferences" && canPublishEvent && (
        <OrganizerEventConferences eventId={eventId} event={event} onEventUpdated={fetchEvent} />
      )}

      {/* ── Tab: Links ── */}
      {activeTab === "links" && hasLinks && (
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-800">
              <Link2 className="w-4 h-4" /> Invitation & Publication Links
            </div>
            <p className="text-xs text-indigo-600 mt-1">Share these links to invite guests. IDs are masked in the display — the copy button copies the real link.</p>
          </CardHeader>
          <CardContent className="pb-5 space-y-5">
            {enterpriseLink && (
              <LinkRow
                label="🏢 Enterprise Guest Invite"
                description="Share with enterprise guests. They are auto-accepted with guest status — no payment needed."
                displayUrl={maskLink(enterpriseLink)}
                realUrl={enterpriseLink}
              />
            )}
            {visitorLink && (
              <LinkRow
                label="👤 Visitor Guest Invite"
                description="Share with visitor guests. They are auto-accepted with guest status — no payment needed."
                displayUrl={maskLink(visitorLink)}
                realUrl={visitorLink}
              />
            )}
            {publicityLink && (
              <LinkRow
                label="📢 Publicity Link"
                description="Share publicly on social media. Follows the normal registration and payment flow."
                displayUrl={maskLink(publicityLink)}
                realUrl={publicityLink}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Edit Modal ── */}
      {event && (
        <EditInfoModal
          event={event}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSave={updated => setEvent(updated)}
        />
      )}
    </div>
  );
}
