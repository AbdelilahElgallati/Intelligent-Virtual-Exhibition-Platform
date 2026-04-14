'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { adminService } from '@/services/admin.service';
import { OrganizerEvent, EventScheduleDay } from '@/types/event';
import { 
    formatInTZ, 
    getUserTimezone, 
    formatInUserTZ, 
    getEventDayDate,
    zonedToUtc
} from '@/lib/timezone';
import { getEffectiveWorkflowState, getLiveWorkflowLabel } from '@/lib/eventWorkflowBadge';
import { resolveMediaUrl } from '@/lib/media';
import { formatSlotRangeLabel } from '@/lib/schedule';
import {
    CalendarCheck, RefreshCw, CheckCircle2, XCircle, AlertCircle, X,
    MapPin, Calendar, Tag, Users, DollarSign, Clock, FileText,
    ExternalLink, ChevronRight, Building2, Info, BarChart2, CreditCard,
    Search
} from 'lucide-react';

const COMMON_TIMEZONES = [
    'UTC',
    'Africa/Casablanca',
    'Europe/Paris',
    'Europe/London',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Dubai',
    'Asia/Tokyo',
];

function parseClockTime(value?: string): [number, number] | null {
    if (!value || !value.includes(':')) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return [hours, minutes];
}

function formatInTimeZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(date);
}

// ── Structured schedule renderer ─────────────────────────────────────────────
function ScheduleDisplay({ event, timeZone }: { event: OrganizerEvent; timeZone: string }) {
    const { t } = useTranslation();
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
                {days.map((day, dayIndex) => {
                    const dayNum = Number(day.day_number || (dayIndex + 1));
                    const eventStart = event.start_date || new Date().toISOString();
                    const dayDate = getEventDayDate(eventStart, timeZone, dayNum);
                    
                    const dayTitle = formatInTZ(dayDate, timeZone, {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                    });

                    return (
                    <div key={day.day_number} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {day.day_number}
                            </span>
                            <span className="text-sm font-semibold text-zinc-800">{t('admin.events.detail.dayNum', { num: day.day_number })}</span>
                            <span className="text-xs text-zinc-500 ml-1">— {dayTitle}</span>
                        </div>
                        <div className="p-3 space-y-2">
                            {day.slots.map((slot, si) => {
                                const startParts = parseClockTime(slot.start_time);
                                const endParts = parseClockTime(slot.end_time);
                                let startLabel = slot.start_time;
                                let endLabel = slot.end_time;

                                if (startParts && endParts) {
                                    const ymd = dayDate.toISOString().split('T')[0];
                                    const slotStart = zonedToUtc(`${ymd}T${slot.start_time}:00`, timeZone);
                                    const slotEnd = zonedToUtc(`${ymd}T${slot.end_time}:00`, timeZone);
                                    
                                    startLabel = formatInTZ(slotStart, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });
                                    endLabel = formatInTZ(slotEnd, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });
                                }

                                return (
                                    <div key={si} className="flex items-start gap-3 p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/50">
                                        <span className="flex-shrink-0 text-xs font-semibold text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-md px-2 py-1 whitespace-nowrap tabular-nums">
                                            {formatSlotRangeLabel(startLabel, endLabel)}
                                        </span>
                                        <p className="text-sm text-zinc-700 leading-snug pt-0.5">
                                            {slot.label || <em className="text-zinc-400">{t('admin.events.detail.noDescription')}</em>}
                                        </p>
                                    </div>
                                );
                            })}
                            {day.slots.length === 0 && (
                                <p className="text-xs text-zinc-400 italic px-1">{t('admin.events.detail.noSlots')}</p>
                            )}
                        </div>
                    </div>
                    );
                })}
            </div>
        );
    }

    if (event.event_timeline) {
        return <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.event_timeline}</p>;
    }
    return <p className="text-xs text-zinc-400 italic">{t('admin.events.detail.noSchedule')}</p>;
}

type EventState = OrganizerEvent['state'];

/** Aligns with organizer / enterprise lists: when workflow is `live`, badge reflects real timing (Upcoming / In progress / Live). */
function getAdminListStatusBadge(event: OrganizerEvent, t: any): { label: string; cls: string } {
    const effective = getEffectiveWorkflowState(event);
    
    const STATE_META: Record<string, { label: string; cls: string }> = {
        pending_approval: { label: t('admin.events.states.pending_approval'), cls: 'bg-amber-50  text-amber-700  border border-amber-200' },
        approved: { label: t('admin.events.states.approved'), cls: 'bg-green-50  text-green-700  border border-green-200' },
        rejected: { label: t('admin.events.states.rejected'), cls: 'bg-red-50    text-red-700    border border-red-200' },
        waiting_for_payment: { label: t('admin.events.states.waiting_for_payment'), cls: 'bg-blue-50   text-blue-700   border border-blue-200' },
        payment_proof_submitted: { label: t('admin.events.states.payment_proof_submitted'), cls: 'bg-blue-50   text-blue-700   border border-blue-200' },
        payment_done: { label: t('admin.events.states.payment_done'), cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
        live: { label: t('admin.events.states.live'), cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
        closed: { label: t('admin.events.states.closed'), cls: 'bg-zinc-100  text-zinc-600   border border-zinc-200' },
    };

    if (event.state !== 'live') {
        const meta = STATE_META[effective] ?? { label: effective, cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200' };
        return { label: meta.label, cls: meta.cls };
    }
    const live = getLiveWorkflowLabel(event);
    if (!live) {
        const meta = STATE_META[effective] ?? { label: effective, cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200' };
        return { label: meta.label, cls: meta.cls };
    }
    if (live.kind === 'closed') {
        return { label: STATE_META.closed.label, cls: STATE_META.closed.cls };
    }
    if (live.kind === 'session_live') {
        return { label: STATE_META.live.label, cls: STATE_META.live.cls };
    }
    if (live.kind === 'between_slots') {
        return { label: t('admin.events.states.in_progress'), cls: 'bg-sky-50 text-sky-700 border border-sky-200' };
    }
    return { label: t('admin.events.states.upcoming'), cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' };
}

function EventListStatusBadge({ event }: { event: OrganizerEvent }) {
    const { t } = useTranslation();
    const { label, cls } = getAdminListStatusBadge(event, t);
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>
            {label}
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
    timeZone: string;
    onClose: () => void;
    onApprove: (id: string, paymentAmount?: number, isConfirmPayment?: boolean, specialAction?: 'start' | 'close') => Promise<void>;
    onReject: (id: string, reason?: string) => Promise<void>;
    busy: boolean;
}

function EventPanel({ event, timeZone, onClose, onApprove, onReject, busy }: EventPanelProps) {
    const { t } = useTranslation();
    const [paymentAmount, setPaymentAmount] = useState('');
    const [approveError, setApproveError] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [confirming, setConfirming] = useState<'approve' | 'reject' | 'confirm_payment' | 'start_event' | 'close_event' | null>(null);

    const effectiveState = getEffectiveWorkflowState(event);
    const canAct = effectiveState === 'pending_approval';
    const fmt = (d?: string) => d ? formatInTimeZone(new Date(d), timeZone, {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }) : '—';

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
                            <EventListStatusBadge event={event} />
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
                            title={t('admin.events.actions.report')}
                        >
                            <BarChart2 className="w-4 h-4" />
                            {t('admin.events.actions.report')}
                        </button>
                        <button
                            onClick={() => window.location.href = `/admin/events/${event.id}`}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-indigo-100 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                            title={t('admin.events.actions.manage')}
                        >
                            <ExternalLink className="w-4 h-4" />
                            {t('admin.events.actions.manage')}
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
                            <img src={resolveMediaUrl(event.banner_url)} alt={t('admin.events.detail.bannerAlt')} className="w-full h-full object-cover" />
                        </div>
                    )}

                    {/* Logistics */}
                    <Section icon={Calendar} title={t('admin.events.detail.title')}>
                        <p className="text-[11px] text-zinc-500 -mt-1 mb-2">{t('admin.events.detail.timezoneLabel')} <strong>{timeZone}</strong></p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            <InfoRow label={t('admin.events.detail.startDate')} value={fmt(event.start_date)} />
                            <InfoRow label={t('admin.events.detail.endDate')} value={fmt(event.end_date)} />
                            <InfoRow label={t('admin.events.detail.location')} value={event.location} />
                            <InfoRow label={t('admin.events.detail.category')} value={event.category} />
                            <InfoRow label={t('admin.events.detail.enterprises')} value={event.num_enterprises} />
                            <InfoRow label={t('admin.events.detail.payment')} value={event.payment_amount != null ? `${event.payment_amount.toFixed(2)} MAD` : t('admin.events.detail.autoCalc')} />
                        </div>
                    </Section>

                    {/* Payment Proof */}
                    {event.payment_proof_url && (
                        <Section icon={CreditCard} title={t('admin.events.detail.paymentProofTitle')}>
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                                <p className="text-xs text-indigo-700 font-medium">{t('admin.events.detail.paymentProofDescription')}</p>
                                <a
                                    href={resolveMediaUrl(event.payment_proof_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t('admin.events.detail.viewProof')}
                                </a>
                            </div>
                        </Section>
                    )}

                    {/* Pricing */}
                    {(event.stand_price != null || event.is_paid != null) && (
                        <Section icon={DollarSign} title={t('admin.events.detail.pricingTitle')}>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                {event.stand_price != null && (
                                    <InfoRow label={t('admin.events.detail.standPrice')} value={`${event.stand_price.toFixed(2)} MAD / enterprise`} />
                                )}
                                <InfoRow
                                    label={t('admin.events.detail.visitorAccess')}
                                    value={event.is_paid
                                        ? t('admin.events.detail.paidTicket', { price: event.ticket_price != null ? event.ticket_price.toFixed(2) : '?' })
                                        : t('admin.events.detail.free')}
                                />
                            </div>
                        </Section>
                    )}

                    {/* Description */}
                    {event.description && (
                        <Section icon={FileText} title={t('admin.events.detail.descriptionTitle')}>
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.description}</p>
                        </Section>
                    )}

                    {/* Extended details */}
                    {event.extended_details && (
                        <Section icon={Info} title={t('admin.events.detail.extendedDetailsTitle')}>
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.extended_details}</p>
                        </Section>
                    )}

                    {/* Schedule */}
                    <Section icon={Clock} title={t('admin.events.detail.scheduleTitle')}>
                        <ScheduleDisplay event={event} timeZone={timeZone} />
                    </Section>


                    {/* Additional info */}
                    {event.additional_info && (
                        <Section icon={Info} title={t('admin.events.detail.additionalInfoTitle')}>
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{event.additional_info}</p>
                        </Section>
                    )}

                    {/* Tags */}
                    {event.tags?.length > 0 && (
                        <Section icon={Tag} title={t('admin.events.detail.tagsTitle')}>
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
                        <Section icon={ExternalLink} title={t('admin.events.detail.linksTitle')}>
                            <div className="space-y-2">
                                {event.enterprise_link && (
                                    <a href={event.enterprise_link} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                                        <ExternalLink className="w-3.5 h-3.5" /> {t('admin.events.detail.enterpriseLink')}
                                    </a>
                                )}
                                {event.visitor_link && (
                                    <a href={event.visitor_link} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                                        <ExternalLink className="w-3.5 h-3.5" /> {t('admin.events.detail.visitorLink')}
                                    </a>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Rejection reason (if already rejected) */}
                    {event.rejection_reason && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-xs font-semibold text-red-600 mb-1">{t('admin.events.detail.rejectionReasonTitle')}</p>
                            <p className="text-sm text-red-700">{event.rejection_reason}</p>
                        </div>
                    )}
                </div>

                {/* ── Decision footer ───────────────────────────────────── */}
                {(canAct || effectiveState === 'payment_proof_submitted' || effectiveState === 'payment_done' || effectiveState === 'live') && (
                    <div className="border-t border-zinc-100 px-6 py-5 flex-shrink-0 space-y-4 bg-zinc-50">
                        {/* Inline confirm states */}
                        {confirming === 'approve' ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-zinc-700">{t('admin.events.actions.approveConfirm')}</p>
                                <input
                                    type="number" min="0" step="0.01"
                                    placeholder={t('admin.events.actions.paymentAmountPlaceholder')}
                                    value={paymentAmount}
                                    onChange={e => {
                                        setPaymentAmount(e.target.value);
                                        if (approveError) setApproveError(null);
                                    }}
                                    className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                                {approveError && <p className="text-xs text-red-600">{approveError}</p>}
                                <div className="flex gap-3">
                                    <button
                                        onClick={async () => {
                                            const normalized = paymentAmount.trim();
                                            if (!normalized) {
                                                setApproveError(t('admin.events.errors.paymentRequired'));
                                                return;
                                            }
                                            const parsed = Number(normalized);
                                            if (!Number.isFinite(parsed) || parsed < 0) {
                                                setApproveError(t('admin.events.errors.paymentInvalid'));
                                                return;
                                            }
                                            try {
                                                await onApprove(event.id, parsed);
                                            } catch (err) {
                                                setApproveError((err as Error)?.message || t('admin.events.errors.paymentRequired'));
                                            }
                                        }}
                                        disabled={busy}
                                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        {busy ? t('admin.events.actions.approving') : t('admin.events.actions.confirmApprove')}
                                    </button>
                                    <button onClick={() => setConfirming(null)} className="px-4 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-200 transition-colors">
                                        {t('common.actions.cancel')}
                                    </button>
                                </div>
                            </div>
                        ) : confirming === 'reject' ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium text-zinc-700">{t('admin.events.actions.rejectConfirm')}</p>
                                <textarea
                                    rows={3}
                                    placeholder={t('admin.events.actions.rejectReasonPlaceholder')}
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
                                        {busy ? t('admin.events.actions.rejecting') : t('admin.events.actions.confirmReject')}
                                    </button>
                                    <button onClick={() => setConfirming(null)} className="px-4 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-200 transition-colors">
                                        {t('common.actions.cancel')}
                                    </button>
                                </div>
                            </div>
                        ) : confirming === null ? (
                            <div className="flex gap-3">
                                {canAct ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                setApproveError(null);
                                                setConfirming('approve');
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> {t('admin.events.actions.approve')}
                                        </button>
                                        <button
                                            onClick={() => setConfirming('reject')}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                                        >
                                            <XCircle className="w-4 h-4" /> {t('admin.events.actions.reject')}
                                        </button>
                                    </>
                                ) : effectiveState === 'payment_proof_submitted' ? (
                                    <button
                                        onClick={() => setConfirming('confirm_payment')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> {t('admin.events.actions.confirmActivate')}
                                    </button>
                                ) : effectiveState === 'payment_done' ? (
                                    <button
                                        onClick={() => setConfirming('start_event')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                    >
                                        <CalendarCheck className="w-4 h-4" /> {t('admin.events.actions.forceStart')}
                                    </button>
                                ) : effectiveState === 'live' ? (
                                    <button
                                        onClick={() => setConfirming('close_event')}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" /> {t('admin.events.actions.closeEvent')}
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        {/* Confirmation for specialized actions */}
                        {(confirming === 'confirm_payment' || confirming === 'start_event' || confirming === 'close_event') && (
                            <div className="space-y-3 p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
                                <p className="text-sm font-semibold text-zinc-800">{t('common.actions.confirmSure')}</p>
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
                                        {t('common.actions.yesProceed')}
                                    </button>
                                    <button onClick={() => setConfirming(null)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200">
                                        {t('common.actions.cancel')}
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
    const { t } = useTranslation();
    const router = useRouter();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<EventState | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selected, setSelected] = useState<OrganizerEvent | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const detectedTimeZone = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
    const [timeZone, setTimeZone] = useState<string>(detectedTimeZone);

    // Pagination
    const ITEMS_PER_PAGE = 15;
    const [currentPage, setCurrentPage] = useState(1);

    const fetchEvents = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await adminService.getEvents(filter || undefined);
            setEvents(res.events);
        } catch (e: any) {
            setError(e.message ?? t('admin.events.failedToLoad'));
        } finally { setLoading(false); }
    }, [filter, t]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    // Reset page on filter or search
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchQuery]);

    const filteredEvents = events.filter(ev => {
        if (filter && getEffectiveWorkflowState(ev) !== filter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const statusLabel = getAdminListStatusBadge(ev, t).label.toLowerCase();
        return ev.title.toLowerCase().includes(q) ||
            (ev.organizer_name && ev.organizer_name.toLowerCase().includes(q)) ||
            statusLabel.includes(q);
    });

    const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
    const paginatedEvents = filteredEvents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    const handleApprove = async (id: string, paymentAmount?: number, isConfirmPayment?: boolean, specialAction?: 'start' | 'close') => {
        setBusy(true);
        try {
            if (isConfirmPayment) {
                await adminService.confirmEventPayment(id);
                showSuccess(t('admin.events.success.paymentConfirmed'));
            } else if (specialAction === 'start') {
                await adminService.startEvent(id);
                showSuccess(t('admin.events.success.eventLive'));
            } else if (specialAction === 'close') {
                await adminService.closeEvent(id);
                showSuccess(t('admin.events.success.eventClosed'));
            } else {
                await adminService.approveEvent(id, paymentAmount ? { payment_amount: paymentAmount } : {});
                showSuccess(t('admin.events.success.eventApproved'));
            }
            setSelected(null);
            fetchEvents();
        } catch (e: any) {
            const msg = e?.message ?? t('common.errors.actionFailed');
            if (!isConfirmPayment && !specialAction) {
                throw new Error(msg);
            }
            setError(msg);
        }
        finally { setBusy(false); }
    };

    const handleReject = async (id: string, reason?: string) => {
        setBusy(true);
        try {
            await adminService.rejectEvent(id, reason ? { reason } : {});
            showSuccess(t('admin.events.success.eventRejected'));
            setSelected(null);
            fetchEvents();
        } catch (e: any) { setError(e.message ?? t('common.errors.actionFailed')); }
        finally { setBusy(false); }
    };

    const fmt = (d?: string) => d ? formatInTimeZone(new Date(d), timeZone, {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }) : '—';

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <CalendarCheck className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">{t('admin.events.title')}</h1>
                        <p className="text-xs text-zinc-500">{t('admin.events.description')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder={t('admin.events.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 lg:w-64"
                        />
                    </div>
                    <select
                        value={filter}
                        onChange={e => setFilter(e.target.value as EventState | '')}
                        className="text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">{t('admin.events.filters.all')}</option>
                        <option value="pending_approval">{t('admin.events.states.pending_approval')}</option>
                        <option value="approved">{t('admin.events.states.approved')}</option>
                        <option value="waiting_for_payment">{t('admin.events.states.waiting_for_payment')}</option>
                        <option value="payment_proof_submitted">{t('admin.events.states.payment_proof_submitted')}</option>
                        <option value="payment_done">{t('admin.events.states.payment_done')}</option>
                        <option value="live">{t('admin.events.states.live')}</option>
                        <option value="closed">{t('admin.events.states.closed')}</option>
                        <option value="rejected">{t('admin.events.states.rejected')}</option>
                    </select>
                    <select
                        value={timeZone}
                        onChange={(e) => setTimeZone(e.target.value)}
                        className="text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[220px]"
                        title={t('admin.events.detail.timezoneLabel')}
                    >
                        {Array.from(new Set([detectedTimeZone, ...COMMON_TIMEZONES])).map((tz) => (
                            <option key={tz} value={tz}>{tz}</option>
                        ))}
                    </select>
                    <button onClick={fetchEvents} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            <p className="text-xs text-zinc-500">{t('admin.events.detail.timesDisplayedIn')} <strong>{timeZone}</strong>.</p>

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
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-indigo-400" /> {t('admin.events.loading')}
                    </div>
                ) : events.length === 0 ? (
                    <div className="p-12 text-center">
                        <CalendarCheck className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">{t('admin.events.noEvents')}</p>
                    </div>
                ) : (
                    <table className="w-full text-sm table-auto">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t('admin.events.table.event')}</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">{t('admin.events.table.dates')}</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">{t('admin.events.table.organizer')}</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t('admin.events.table.status')}</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden sm:table-cell">{t('admin.events.table.actions')}</th>
                                <th className="px-4 py-3.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {paginatedEvents.map((ev) => (
                                <tr
                                    key={ev.id}
                                    onClick={() => setSelected(ev)}
                                    className="hover:bg-zinc-50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors truncate max-w-[205px]" title={ev.title}>{ev.title}</div>
                                        {ev.category && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-[205px]">{ev.category}</div>}
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell text-xs text-zinc-500 whitespace-nowrap">
                                        <div className="whitespace-nowrap leading-tight">{fmt(ev.start_date)}</div>
                                        <div className="text-zinc-400 whitespace-nowrap leading-tight">→ {fmt(ev.end_date)}</div>
                                    </td>
                                    <td className="px-4 py-4 hidden lg:table-cell text-sm text-zinc-600">
                                        {ev.organizer_name ? (
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                                                {ev.organizer_name}
                                            </div>
                                        ) : '—'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <EventListStatusBadge event={ev} />
                                    </td>
                                    <td className="px-4 py-4 hidden sm:table-cell">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/events/${ev.id}/organizer-report`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-900 bg-zinc-50 border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors whitespace-nowrap"
                                                title={t('admin.events.actions.report')}
                                            >
                                                <BarChart2 className="w-3.5 h-3.5" />
                                                {t('admin.events.actions.report')}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/events/${ev.id}/enterprises`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
                                                title={t('admin.events.actions.joinRequests')}
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                {t('admin.events.actions.joinRequests')}
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/admin/events/${ev.id}`);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                {t('admin.events.actions.manage')}
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
                    <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-zinc-500">
                            {t('common.ui.pagination.showingRange', {
                                from: filteredEvents.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1,
                                to: Math.min(currentPage * ITEMS_PER_PAGE, filteredEvents.length),
                                total: filteredEvents.length,
                                entity: t('common.ui.pagination.entities.events')
                            })}
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                                >
                                    {t('common.ui.pagination.previous')}
                                </button>
                                <span className="text-xs font-medium text-zinc-600">
                                    {t('common.ui.pagination.pageInfo', { current: currentPage, total: totalPages })}
                                </span>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                                >
                                    {t('common.ui.pagination.next')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selected && (
                <EventPanel
                    event={selected}
                    timeZone={timeZone}
                    onClose={() => setSelected(null)}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    busy={busy}
                />
            )}
        </div>
    );
}
