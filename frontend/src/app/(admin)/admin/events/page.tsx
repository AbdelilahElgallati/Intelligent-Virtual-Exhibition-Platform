'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminService } from '@/services/admin.service';
import { OrganizerEvent, EventScheduleDay } from '@/types/event';
import {
    CalendarCheck, RefreshCw, CheckCircle2, XCircle, AlertCircle, X,
    MapPin, Calendar, Tag, Users, DollarSign, Clock, FileText,
    ExternalLink, ChevronRight, Building2, Info, BarChart2, CreditCard,
} from 'lucide-react';

// ── Structured schedule renderer ─────────────────────────────────────────────
function ScheduleDisplay({ event }: { event: OrganizerEvent }) {
    let days: EventScheduleDay[] | null = event.schedule_days ?? null;

    if (!days && event.event_timeline) {
        try {
            const parsed = JSON.parse(event.event_timeline);
            if (Array.isArray(parsed)) days = parsed as EventScheduleDay[];
        } catch { /* legacy text */ }
    }

    if (days && days.length > 0) {
        return (
            <div className="space-y-3">
                {days.map((day) => (
                    <div key={day.day_number} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {day.day_number}
                            </span>
                            <span className="text-sm font-semibold text-zinc-800">Day {day.day_number}</span>
                            {day.date_label && <span className="text-xs text-zinc-500 ml-1">— {day.date_label}</span>}
                        </div>
                        <div className="p-3 space-y-2">
                            {day.slots.map((slot, si) => (
                                <div key={si} className="flex items-start gap-3 p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/50">
                                    <span className="flex-shrink-0 text-xs font-semibold text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-md px-2 py-1 whitespace-nowrap tabular-nums">
                                        {slot.start_time} → {slot.end_time}
                                    </span>
                                    <p className="text-sm text-zinc-700 leading-snug pt-0.5">
                                        {slot.label || <em className="text-zinc-400">No description</em>}
                                    </p>
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

    if (event.event_timeline) {
        return <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.event_timeline}</p>;
    }
    return <p className="text-xs text-zinc-400 italic">No schedule provided</p>;
}

type EventState = OrganizerEvent['state'];

const STATE_META: Record<string, { label: string; cls: string }> = {
    pending_approval: { label: 'Pending Approval', cls: 'bg-amber-50  text-amber-700  border border-amber-200' },
    approved: { label: 'Approved', cls: 'bg-green-50  text-green-700  border border-green-200' },
    rejected: { label: 'Rejected', cls: 'bg-red-50    text-red-700    border border-red-200' },
    waiting_for_payment: { label: 'Waiting for Payment', cls: 'bg-blue-50   text-blue-700   border border-blue-200' },
    payment_proof_submitted: { label: 'Payment Reviewing', cls: 'bg-blue-50   text-blue-700   border border-blue-200' },
    payment_done: { label: 'Payment Done', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
    live: { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    closed: { label: 'Closed', cls: 'bg-zinc-100  text-zinc-600   border border-zinc-200' },
};

function StateBadge({ state }: { state: string }) {
    const meta = STATE_META[state] ?? { label: state, cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200' };
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <Icon className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-3">
            <span className="text-xs text-zinc-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-zinc-800 font-medium break-words">{String(value)}</span>
        </div>
    );
}

// ── Side Panel ──────────────────────────────────────────────────────────────
interface EventPanelProps {
    event: OrganizerEvent;
    onClose: () => void;
    onApprove: (id: string, paymentAmount?: number, isConfirmPayment?: boolean, specialAction?: 'start' | 'close') => Promise<void>;
    onReject: (id: string, reason?: string) => Promise<void>;
    busy: boolean;
}

function EventPanel({ event, onClose, onApprove, onReject, busy }: EventPanelProps) {
    const [paymentAmount, setPaymentAmount] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [confirming, setConfirming] = useState<'approve' | 'reject' | 'confirm_payment' | 'start_event' | 'close_event' | null>(null);

    const canAct = event.state === 'pending_approval';
    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

            {/* Panel */}
            <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white border-l border-zinc-200 flex flex-col shadow-xl overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-100 flex-shrink-0">
                    <div className="space-y-2 pr-4">
                        <h2 className="text-lg font-bold text-zinc-900 leading-tight">{event.title}</h2>
                        <div className="flex items-center flex-wrap gap-2">
                            <StateBadge state={event.state} />
                            {event.organizer_name && (
                                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                                    <Building2 className="w-3 h-3" /> {event.organizer_name}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => window.location.href = `/admin/events/${event.id}/organizer-report`}
                            className="p-1.5 rounded-lg text-zinc-900 bg-zinc-50 border border-zinc-200 flex items-center gap-1.5 text-xs font-semibold hover:bg-zinc-100 transition-colors"
                            title="View Organizer Report"
                        >
                            <BarChart2 className="w-4 h-4" />
                            Report
                        </button>
                        <button
                            onClick={() => window.location.href = `/admin/events/${event.id}`}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-indigo-100 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                            title="Open Full Management Page"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Manage
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 flex-shrink-0">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body — scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

                    {/* Banner */}
                    {event.banner_url && (
                        <div className="rounded-xl overflow-hidden border border-zinc-200 aspect-video bg-zinc-100">
                            <img src={event.banner_url} alt="Event banner" className="w-full h-full object-cover" />
                        </div>
                    )}

                    {/* Logistics */}
                    <Section icon={Calendar} title="Event Details">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <InfoRow label="Start date" value={fmt(event.start_date)} />
                            <InfoRow label="End date" value={fmt(event.end_date)} />
                            <InfoRow label="Location" value={event.location} />
                            <InfoRow label="Category" value={event.category} />
                            <InfoRow label="Enterprises" value={event.num_enterprises} />
                            <InfoRow label="Payment" value={event.payment_amount != null ? `$${event.payment_amount}` : 'Auto-calc'} />
                        </div>
                    </Section>

                    {/* Payment Proof */}
                    {event.payment_proof_url && (
                        <Section icon={CreditCard} title="Payment Proof">
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                                <p className="text-xs text-indigo-700 font-medium">Organizer has submitted a proof of payment.</p>
                                <a
                                    href={event.payment_proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    View Proof / Receipt
                                </a>
                            </div>
                        </Section>
                    )}

                    {/* Pricing */}
                    {(event.stand_price != null || event.is_paid != null) && (
                        <Section icon={DollarSign} title="Pricing">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                {event.stand_price != null && (
                                    <InfoRow label="Stand price" value={`$${event.stand_price.toFixed(2)} / enterprise`} />
                                )}
                                <InfoRow
                                    label="Visitor access"
                                    value={event.is_paid
                                        ? `Paid — $${event.ticket_price != null ? event.ticket_price.toFixed(2) : '?'} / ticket`
                                        : 'Free'}
                                />
                            </div>
                        </Section>
                    )}

                    {/* Description */}
                    {event.description && (
                        <Section icon={FileText} title="Description">
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.description}</p>
                        </Section>
                    )}

                    {/* Extended details */}
                    {event.extended_details && (
                        <Section icon={Info} title="Extended Details">
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.extended_details}</p>
                        </Section>
                    )}

                    {/* Schedule */}
                    <Section icon={Clock} title="Event Schedule">
                        <ScheduleDisplay event={event} />
                    </Section>


                    {/* Additional info */}
                    {event.additional_info && (
                        <Section icon={Info} title="Additional Information">
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.additional_info}</p>
                        </Section>
                    )}

                    {/* Tags */}
                    {event.tags?.length > 0 && (
                        <Section icon={Tag} title="Tags">
                            <div className="flex flex-wrap gap-1.5">
                                {event.tags.map(t => (
                                    <span key={t} className="text-xs px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full border border-zinc-200">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Links */}
                    {(event.enterprise_link || event.visitor_link) && (
                        <Section icon={ExternalLink} title="Links">
                            <div className="space-y-2">
                                {event.enterprise_link && (
                                    <a href={event.enterprise_link} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                                        <ExternalLink className="w-3.5 h-3.5" /> Enterprise Link
                                    </a>
                                )}
                                {event.visitor_link && (
                                    <a href={event.visitor_link} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                                        <ExternalLink className="w-3.5 h-3.5" /> Visitor Link
                                    </a>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Rejection reason (if already rejected) */}
                    {event.rejection_reason && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-xs font-semibold text-red-600 mb-1">Rejection reason</p>
                            <p className="text-sm text-red-700">{event.rejection_reason}</p>
                        </div>
                    )}
                </div>

                {/* ── Decision footer ───────────────────────────────────── */}
                {(canAct || event.state === 'payment_proof_submitted' || event.state === 'payment_done' || event.state === 'live') && (
                    <div className="border-t border-zinc-100 px-6 py-5 flex-shrink-0 space-y-4 bg-zinc-50">
                        {/* Inline confirm states */}
                        {confirming === 'approve' ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-zinc-700">Approve this event?</p>
                                <input
                                    type="number" min="0" step="0.01"
                                    placeholder="Payment amount override (optional)"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={async () => {
                                            await onApprove(event.id, paymentAmount ? parseFloat(paymentAmount) : undefined);
                                        }}
                                        disabled={busy}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        {busy ? 'Approving…' : 'Confirm Approve'}
                                    </button>
                                    <button onClick={() => setConfirming(null)} className="px-4 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-200 transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : confirming === 'reject' ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-zinc-700">Reject this event?</p>
                                <textarea
                                    rows={3}
                                    placeholder="Reason for rejection (recommended)…"
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={async () => {
                                            await onReject(event.id, rejectReason || undefined);
                                        }}
                                        disabled={busy}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    >
                                        {busy ? 'Rejecting…' : 'Confirm Reject'}
                                    </button>
                                    <button onClick={() => setConfirming(null)} className="px-4 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-200 transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : confirming === null ? (
                            <div className="flex gap-3">
                                {canAct ? (
                                    <>
                                        <button
                                            onClick={() => setConfirming('approve')}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Approve
                                        </button>
                                        <button
                                            onClick={() => setConfirming('reject')}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                                        >
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                    </>
                                ) : event.state === 'payment_proof_submitted' ? (
                                    <button
                                        onClick={() => setConfirming('confirm_payment')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Confirm & Activate
                                    </button>
                                ) : event.state === 'payment_done' ? (
                                    <button
                                        onClick={() => setConfirming('start_event')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                    >
                                        <CalendarCheck className="w-4 h-4" /> Start (Force Live)
                                    </button>
                                ) : event.state === 'live' ? (
                                    <button
                                        onClick={() => setConfirming('close_event')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" /> Close Event
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {/* Confirmation for specialized actions */}
                        {(confirming === 'confirm_payment' || confirming === 'start_event' || confirming === 'close_event') && (
                            <div className="space-y-3 p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
                                <p className="text-sm font-semibold text-zinc-800">Are you sure?</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            if (confirming === 'confirm_payment') await onApprove(event.id, undefined, true);
                                            else if (confirming === 'start_event') await onApprove(event.id, undefined, false, 'start');
                                            else if (confirming === 'close_event') await onApprove(event.id, undefined, false, 'close');
                                        }}
                                        disabled={busy}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold bg-zinc-900 text-white hover:bg-black disabled:opacity-50"
                                    >
                                        Yes, Proceed
                                    </button>
                                    <button onClick={() => setConfirming(null)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </aside>
        </>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminEventsPage() {
    const router = useRouter();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<EventState | ''>('pending_approval');
    const [selected, setSelected] = useState<OrganizerEvent | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await adminService.getEvents(filter || undefined);
            setEvents(res.events);
        } catch (e: any) {
            setError(e.message ?? 'Failed to load events');
        } finally { setLoading(false); }
    }, [filter]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    const handleApprove = async (id: string, paymentAmount?: number, isConfirmPayment?: boolean, specialAction?: 'start' | 'close') => {
        setBusy(true);
        try {
            if (isConfirmPayment) {
                await adminService.confirmEventPayment(id);
                showSuccess('Payment confirmed and links generated.');
            } else if (specialAction === 'start') {
                await adminService.startEvent(id);
                showSuccess('Event is now LIVE.');
            } else if (specialAction === 'close') {
                await adminService.closeEvent(id);
                showSuccess('Event closed.');
            } else {
                await adminService.approveEvent(id, paymentAmount ? { payment_amount: paymentAmount } : {});
                showSuccess('Event approved.');
            }
            setSelected(null);
            fetchEvents();
        } catch (e: any) { setError(e.message ?? 'Failed'); }
        finally { setBusy(false); }
    };

    const handleReject = async (id: string, reason?: string) => {
        setBusy(true);
        try {
            await adminService.rejectEvent(id, reason ? { reason } : {});
            showSuccess('Event rejected.');
            setSelected(null);
            fetchEvents();
        } catch (e: any) { setError(e.message ?? 'Failed'); }
        finally { setBusy(false); }
    };

    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <CalendarCheck className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Event Review</h1>
                        <p className="text-xs text-zinc-500">Click any row to see the full event details and take action</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={filter}
                        onChange={e => setFilter(e.target.value as EventState | '')}
                        className="text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="pending_approval">Pending Approval</option>
                        <option value="">All Events</option>
                    </select>
                    <button onClick={fetchEvents} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-zinc-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-indigo-400" /> Loading events…
                    </div>
                ) : events.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarCheck className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">No events found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Event</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Dates</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Enterprises</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Actions</th>
                                <th className="px-4 py-3.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {events.map((ev) => (
                                <tr
                                    key={ev.id}
                                    onClick={() => setSelected(ev)}
                                    className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">{ev.title}</div>
                                        {ev.organizer_name && <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" />{ev.organizer_name}</div>}
                                        {ev.category && <div className="text-xs text-zinc-400 mt-0.5">{ev.category}</div>}
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell text-xs text-zinc-500">
                                        <div>{fmt(ev.start_date)}</div>
                                        <div className="text-zinc-400">→ {fmt(ev.end_date)}</div>
                                    </td>
                                    <td className="px-4 py-4 hidden lg:table-cell text-sm text-zinc-600">
                                        {ev.num_enterprises ?? '—'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <StateBadge state={ev.state} />
                                    </td>
                                    <td className="px-4 py-4 hidden sm:table-cell">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/events/${ev.id}/organizer-report`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors whitespace-nowrap"
                                                title="View Organizer Report"
                                            >
                                                <BarChart2 className="w-3.5 h-3.5" />
                                                Report
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/events/${ev.id}/enterprises`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors whitespace-nowrap"
                                                title="View Enterprise Requests"
                                            >
                                                <Building2 className="w-3.5 h-3.5" />
                                                Enterprises
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/events/${ev.id}`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Manage
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && events.length > 0 && (
                    <div className="px-6 py-3 border-t border-zinc-100 text-xs text-zinc-400">
                        {events.length} event{events.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {/* Side panel */}
            {selected && (
                <EventPanel
                    event={selected}
                    onClose={() => setSelected(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    busy={busy}
                />
            )}
        </div>
    );
}
