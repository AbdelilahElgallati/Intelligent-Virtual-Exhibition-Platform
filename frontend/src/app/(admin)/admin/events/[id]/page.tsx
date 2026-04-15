'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft,
    Zap,
    XCircle,
    Calendar,
    Clock,
    MapPin,
    Users,
    RefreshCcw,
    AlertTriangle,
    CheckCircle2,
    Timer,
    Activity,
    DollarSign,
    Building2,
    BarChart2,
    ExternalLink,
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { OrganizerEvent } from '@/types/event';
import { resolveMediaUrl } from '@/lib/media';
import { formatInUserTZ } from '@/lib/timezone';
import { getEffectiveWorkflowState, getLiveWorkflowLabel } from '@/lib/eventWorkflowBadge';

// ── Types ───────────────────────────────────────────────────────────────────

type EventState =
    | 'pending_approval'
    | 'waiting_for_payment'
    | 'payment_proof_submitted'
    | 'payment_done'
    | 'live'
    | 'closed'
    | 'approved'
    | 'rejected';

// ── State badge config ───────────────────────────────────────────────────────

const STATE_CONFIG: Record<
    string,
    { labelKey: string; bg: string; text: string; dot: string; iconKey: string; icon: React.ReactNode }
> = {
    pending_approval: {
        labelKey: 'admin.eventDetail.states.pendingApproval',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        dot: 'bg-amber-400',
        iconKey: 'timer',
        icon: <Timer className="w-3.5 h-3.5" />,
    },
    approved: {
        labelKey: 'admin.eventDetail.states.approved',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        dot: 'bg-blue-400',
        iconKey: 'checkCircle',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    waiting_for_payment: {
        labelKey: 'admin.eventDetail.states.waitingForPayment',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        dot: 'bg-orange-400',
        iconKey: 'dollarSign',
        icon: <DollarSign className="w-3.5 h-3.5" />,
    },
    payment_proof_submitted: {
        labelKey: 'admin.eventDetail.states.reviewingPayment',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        dot: 'bg-blue-400',
        iconKey: 'clock',
        icon: <Clock className="w-3.5 h-3.5" />,
    },
    payment_done: {
        labelKey: 'admin.eventDetail.states.paymentDone',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        dot: 'bg-indigo-400',
        iconKey: 'checkCircle',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    live: {
        labelKey: 'admin.eventDetail.states.live',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        dot: 'bg-emerald-500',
        iconKey: 'activity',
        icon: <Activity className="w-3.5 h-3.5" />,
    },
    closed: {
        labelKey: 'admin.eventDetail.states.closed',
        bg: 'bg-zinc-100',
        text: 'text-zinc-600',
        dot: 'bg-zinc-400',
        iconKey: 'xCircle',
        icon: <XCircle className="w-3.5 h-3.5" />,
    },
    rejected: {
        labelKey: 'admin.eventDetail.states.rejected',
        bg: 'bg-red-50',
        text: 'text-red-700',
        dot: 'bg-red-400',
        iconKey: 'alertTriangle',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
};

// ── State Badge ──────────────────────────────────────────────────────────────

function StateBadge({ event }: { event: OrganizerEvent }) {
    const { t } = useTranslation();
    const effective = getEffectiveWorkflowState(event);
    if (event.state === 'live') {
        const live = getLiveWorkflowLabel(event);
        if (live) {
            if (live.kind === 'closed') {
                const cfg = STATE_CONFIG.closed;
                return (
                    <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg} ${cfg.text}`}
                    >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.icon}
                        {t(cfg.labelKey)}
                    </span>
                );
            }
            const pulse = live.kind === 'session_live';
            const liveCfg =
                live.kind === 'upcoming'
                    ? { labelKey: 'admin.eventDetail.states.upcoming', bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-400', icon: <Clock className="w-3.5 h-3.5" /> }
                    : live.kind === 'between_slots'
                        ? { labelKey: 'admin.eventDetail.states.inProgress', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400', icon: <Activity className="w-3.5 h-3.5" /> }
                        : { labelKey: 'admin.eventDetail.states.live', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: <Activity className="w-3.5 h-3.5" /> };
            return (
                <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${liveCfg.bg} ${liveCfg.text}`}
                >
                    <span className={`w-2 h-2 rounded-full ${liveCfg.dot} ${pulse ? 'animate-pulse' : ''}`} />
                    {liveCfg.icon}
                    {t(liveCfg.labelKey)}
                </span>
            );
        }
    }
    const cfg = STATE_CONFIG[effective] ?? {
        labelKey: '',
        label: effective,
        bg: 'bg-zinc-100',
        text: 'text-zinc-600',
        dot: 'bg-zinc-400',
        icon: null,
    };
    return (
        <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${cfg.bg} ${cfg.text}`}
        >
            <span className={`w-2 h-2 rounded-full ${cfg.dot} ${effective === 'live' ? 'animate-pulse' : ''}`} />
            {cfg.icon}
            {'labelKey' in cfg && cfg.labelKey ? t(cfg.labelKey) : cfg.label}
        </span>
    );
}

// ── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(target: Date | null) {
    const [remaining, setRemaining] = useState<number | null>(null);

    const targetTime = target?.getTime();

    useEffect(() => {
        if (!targetTime) { setRemaining(null); return; }
        const tick = () => {
            const diff = targetTime - Date.now();
            setRemaining(diff);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [targetTime]);

    return remaining;
}

function formatDuration(ms: number): string {
    if (ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

function CountdownBanner({ event }: { event: OrganizerEvent }) {
    const { t } = useTranslation();
    const state = event.state as EventState;
    const startDate = event.start_date ? new Date(event.start_date) : null;
    const endDate = event.end_date ? new Date(event.end_date) : null;

    const target =
        state === 'payment_done' ? startDate :
            state === 'live' ? endDate :
                null;

    const remaining = useCountdown(target);

    if (!target || state === 'closed' || state === 'pending_approval' || state === 'waiting_for_payment' || state === 'payment_proof_submitted') {
        return null;
    }

    const label = state === 'payment_done' ? t('admin.eventDetail.countdown.startsIn') : t('admin.eventDetail.countdown.endsIn');
    const isPast = remaining !== null && remaining <= 0;
    const pastLabel = state === 'payment_done' ? t('admin.eventDetail.countdown.startPassed') : t('admin.eventDetail.countdown.endPassed');

    const color = state === 'live' ? 'from-emerald-50 to-teal-50 border-emerald-200' : 'from-indigo-50 to-blue-50 border-indigo-200';
    const textColor = state === 'live' ? 'text-emerald-700' : 'text-indigo-700';

    return (
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border bg-gradient-to-r ${color}`}>
            <Timer className={`w-5 h-5 ${textColor} flex-shrink-0`} />
            {isPast ? (
                <p className={`text-sm font-medium ${textColor}`}>{pastLabel}</p>
            ) : (
                <p className={`text-sm font-medium ${textColor}`}>
                    {label}:{' '}
                    <span className="font-bold font-mono text-base">
                        {remaining !== null ? formatDuration(remaining) : '…'}
                    </span>
                </p>
            )}
        </div>
    );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

const TIMELINE_NODES: { key: EventState | string; labelKey: string; color: string; active: string }[] = [
    { key: 'pending_approval', labelKey: 'admin.eventDetail.timeline.pending', color: 'bg-zinc-200 text-zinc-500', active: 'bg-amber-400 text-white' },
    { key: 'waiting_for_payment', labelKey: 'admin.eventDetail.timeline.paymentDue', color: 'bg-zinc-200 text-zinc-500', active: 'bg-orange-400 text-white' },
    { key: 'payment_proof_submitted', labelKey: 'admin.eventDetail.timeline.verifying', color: 'bg-zinc-200 text-zinc-500', active: 'bg-blue-400 text-white' },
    { key: 'payment_done', labelKey: 'admin.eventDetail.timeline.paymentDone', color: 'bg-zinc-200 text-zinc-500', active: 'bg-indigo-500 text-white' },
    { key: 'live', labelKey: 'admin.eventDetail.timeline.live', color: 'bg-zinc-200 text-zinc-500', active: 'bg-emerald-500 text-white' },
    { key: 'closed', labelKey: 'admin.eventDetail.timeline.closed', color: 'bg-zinc-200 text-zinc-500', active: 'bg-zinc-500 text-white' },
];

const STATE_ORDER: Record<string, number> = {
    pending_approval: 0,
    approved: 0,
    waiting_for_payment: 1,
    payment_proof_submitted: 2,
    payment_done: 3,
    live: 4,
    closed: 5,
    rejected: -1,
};

function EventTimeline({ event }: { event: OrganizerEvent }) {
    const { t } = useTranslation();
    const currentIdx = STATE_ORDER[event.state] ?? 0;

    return (
        <div className="mt-6">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">{t('admin.eventDetail.timeline.title')}</h3>
            <div className="relative flex items-start">
                {/* connector line */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-zinc-200" />
                {/* progress fill */}
                <div
                    className="absolute top-4 left-4 h-0.5 bg-indigo-400 transition-all duration-500"
                    style={{ width: `${(currentIdx / (TIMELINE_NODES.length - 1)) * (100 - 8)}%` }}
                />

                <div className="relative flex justify-between w-full">
                    {TIMELINE_NODES.map((node, idx) => {
                        const isDone = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        const nodeColor = isCurrent
                            ? node.active
                            : isDone
                                ? 'bg-indigo-300 text-white'
                                : node.color;

                        const date =
                            node.key === 'payment_done' || node.key === 'live'
                                ? event.start_date
                                : node.key === 'closed'
                                    ? event.end_date
                                    : null;

                        return (
                            <div key={node.key} className="flex flex-col items-center gap-1.5">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${nodeColor} ${isCurrent ? 'ring-2 ring-offset-2 ring-indigo-400' : ''}`}
                                >
                                    {isDone ? '✓' : idx + 1}
                                </div>
                                <span className={`text-xs font-medium whitespace-nowrap ${isCurrent ? 'text-indigo-600' : isDone ? 'text-indigo-400' : 'text-zinc-400'}`}>
                                    {t(node.labelKey)}
                                </span>
                                {date && (node.key === 'live' || node.key === 'closed') && (
                                    <span className="text-xs text-zinc-400">
                                        {formatInUserTZ(date, { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${type === 'success' ? 'bg-white border-emerald-200 text-emerald-700' : 'bg-white border-red-200 text-red-700'
            }`}>
            {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message}
        </div>
    );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-zinc-100 rounded-lg ${className}`} />;
}

function PageSkeleton() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <Skeleton className="h-6 w-32" />
            <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </div>
    );
}

// ── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
    title,
    message,
    confirmLabel,
    confirmClass,
    onConfirm,
    onCancel,
}: {
    title: string;
    message: string;
    confirmLabel: string;
    confirmClass: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-md mx-4 p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">{title}</h3>
                <p className="text-sm text-zinc-600 mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        {t('common.actions.cancel')}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${confirmClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminEventDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [event, setEvent] = useState<OrganizerEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mutating, setMutating] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [confirm, setConfirm] = useState<'start' | 'close' | 'payment' | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

    const fetchEvent = useCallback(async () => {
        try {
            const data = await adminService.getEventById(id);
            setEvent(data);
            setError(null);
        } catch {
            setError(t('admin.eventDetail.errors.failedToLoad'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        fetchEvent();
        pollRef.current = setInterval(fetchEvent, 30_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fetchEvent]);

    const handleForceStart = async () => {
        setConfirm(null);
        setMutating(true);
        try {
            const updated = await adminService.forceStartEvent(id);
            setEvent(updated);
            showToast(t('admin.eventDetail.toast.startSuccess'), 'success');
        } catch (e: unknown) {
            const msg = (e as { message?: string })?.message || t('admin.eventDetail.toast.startFailed');
            showToast(msg, 'error');
        } finally {
            setMutating(false);
        }
    };

    const handleForceClose = async () => {
        setConfirm(null);
        setMutating(true);
        try {
            const updated = await adminService.forceCloseEvent(id);
            setEvent(updated);
            showToast(t('admin.eventDetail.toast.closeSuccess'), 'success');
        } catch (e: unknown) {
            const msg = (e as { message?: string })?.message || t('admin.eventDetail.toast.closeFailed');
            showToast(msg, 'error');
        } finally {
            setMutating(false);
        }
    };

    const handleConfirmPayment = async () => {
        setConfirm(null);
        setMutating(true);
        try {
            const updated = await adminService.confirmEventPayment(id);
            setEvent(updated);
            showToast(t('admin.eventDetail.toast.paymentSuccess'), 'success');
        } catch (e: unknown) {
            const msg = (e as { message?: string })?.message || t('admin.eventDetail.toast.paymentFailed');
            showToast(msg, 'error');
        } finally {
            setMutating(false);
        }
    };

    // ── Loading ──────────────────────────────────────────────────────────────
    if (loading) return <PageSkeleton />;

    if (error || !event) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 text-sm mb-6">
                    <ArrowLeft className="w-4 h-4" /> {t('common.buttons.back')}
                </button>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700 font-medium">{error ?? t('admin.eventDetail.errors.eventNotFound')}</p>
                    <button onClick={fetchEvent} className="mt-4 text-sm text-red-600 hover:text-red-800 underline">
                        {t('admin.eventDetail.actions.tryAgain')}
                    </button>
                </div>
            </div>
        );
    }

    const state = event.state as EventState;
    const canConfirmPayment = state === 'payment_proof_submitted';
    const canForceStart = state === 'payment_done';
    const canForceClose = state === 'live';

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push('/admin/events')}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 text-sm font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('admin.events.allEvents')}
                </button>
                <button
                    onClick={fetchEvent}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                    title={t('admin.events.refresh')}
                >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    {t('admin.events.refresh')}
                </button>
            </div>

            {/* Header card */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-zinc-100">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="space-y-2 min-w-0">
                            <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{event.title}</h1>
                            <StateBadge event={event} />
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-shrink-0">
                            {/* Sessions button — always visible 
                            <button
                                onClick={() => router.push(`/admin/events/${id}/sessions`)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                            >
                                <Calendar className="w-4 h-4" />
                                Sessions
                            </button>*/}
                            {/* Organizer Report button */}
                            <button
                                onClick={() => router.push(`/admin/events/${id}/organizer-report`)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-black text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                            >
                                <BarChart2 className="w-4 h-4" />
                                {t('admin.eventDetail.actions.organizerReport')}
                            </button>
                            {/* Live Monitor button — always shown for live events */}
                            {state === 'live' && (
                                <button
                                    onClick={() => router.push(`/admin/events/${id}/monitoring`)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                                >
                                    <BarChart2 className="w-4 h-4" />
                                    {t('admin.eventDetail.actions.liveMonitor')}
                                </button>
                            )}

                            {canConfirmPayment && (
                                <button
                                    id="btn-confirm-payment"
                                    disabled={mutating}
                                    onClick={() => setConfirm('payment')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('admin.eventDetail.actions.verifyPayment')}
                                </button>
                            )}
                            {canForceStart && (
                                <button
                                    id="btn-force-start"
                                    disabled={mutating}
                                    onClick={() => setConfirm('start')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                                >
                                    <Zap className="w-4 h-4" />
                                    {t('admin.eventDetail.actions.forceStart')}
                                </button>
                            )}
                            {canForceClose && (
                                <button
                                    id="btn-force-close"
                                    disabled={mutating}
                                    onClick={() => setConfirm('close')}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                                >
                                    <XCircle className="w-4 h-4" />
                                    {t('admin.eventDetail.actions.forceClose')}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Countdown */}
                    <div className="mt-4">
                        <CountdownBanner event={event} />
                    </div>
                </div>

                {/* Timeline */}
                <div className="px-6 py-5">
                    <EventTimeline event={event} />
                </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Event info */}
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">{t('admin.eventDetail.sections.eventDetails')}</h2>
                    {event.description && (
                        <p className="text-sm text-zinc-600 leading-relaxed">{event.description}</p>
                    )}
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5 text-sm text-zinc-600">
                            <Calendar className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                            <span>
                                {event.start_date
                                    ? formatInUserTZ(event.start_date, { dateStyle: 'medium', timeStyle: 'short' })
                                    : '—'}
                            </span>
                            <span className="text-zinc-300">→</span>
                            <span>
                                {event.end_date
                                    ? formatInUserTZ(event.end_date, { dateStyle: 'medium', timeStyle: 'short' })
                                    : '—'}
                            </span>
                        </div>
                        {event.location && (
                            <div className="flex items-center gap-2.5 text-sm text-zinc-600">
                                <MapPin className="w-4 h-4 text-zinc-400" />
                                {event.location}
                            </div>
                        )}
                        {event.num_enterprises != null && (
                            <div className="flex items-center gap-2.5 text-sm text-zinc-600">
                                <Building2 className="w-4 h-4 text-zinc-400" />
                                {event.num_enterprises} enterprise{event.num_enterprises !== 1 ? 's' : ''}
                            </div>
                        )}
                        {event.organizer_name && (
                            <div className="flex items-center gap-2.5 text-sm text-zinc-600">
                                <Users className="w-4 h-4 text-zinc-400" />
                                {event.organizer_name}
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment / lifecycle info */}
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">{t('admin.eventDetail.sections.lifecycleInfo')}</h2>
                    <div className="space-y-2.5">
                        {event.payment_amount != null && (
                            <div className="flex items-center gap-2.5 text-sm text-zinc-600">
                                <DollarSign className="w-4 h-4 text-zinc-400" />
                                Payment: <span className="font-semibold text-zinc-800">{event.payment_amount.toFixed(2)} MAD</span>
                            </div>
                        )}
                        {event.payment_proof_url && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                                <div className="text-[10px] font-bold uppercase text-blue-400 tracking-wider">
                                    {t('admin.eventDetail.sections.paymentProof')}
                                </div>
                                <a
                                    href={resolveMediaUrl(event.payment_proof_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium transition-colors"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t('admin.eventDetail.actions.viewProof')}
                                </a>
                            </div>
                        )}
                        {event.category && (
                            <div className="flex items-center gap-2.5 text-sm text-zinc-600">
                                <Activity className="w-4 h-4 text-zinc-400" />
                                {event.category}
                            </div>
                        )}
                        {event.created_at && (
                            <div className="flex items-center gap-2.5 text-sm text-zinc-500">
                                <Clock className="w-4 h-4 text-zinc-400" />
                                Created{' '}
                                {formatInUserTZ(event.created_at, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                        )}
                        {state === 'payment_done' && (
                            <div className="mt-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                <p className="text-xs text-indigo-700 font-medium">
                                    {t('admin.eventDetail.info.autoStartScheduled', { date: event.start_date ? formatInUserTZ(event.start_date, { dateStyle: 'medium', timeStyle: 'short' }) : t('admin.eventDetail.info.startDate') })}
                                </p>
                            </div>
                        )}
                        {state === 'live' && (
                            <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                <p className="text-xs text-emerald-700 font-medium">
                                    {t('admin.eventDetail.info.autoCloseScheduled', { date: event.end_date ? formatInUserTZ(event.end_date, { dateStyle: 'medium', timeStyle: 'short' }) : t('admin.eventDetail.info.endDate') })}
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Enterprises link */}
                    {state !== 'pending_approval' && state !== 'rejected' && (
                        <div className="pt-2">
                            <button
                                onClick={() => router.push(`/admin/events/${id}/enterprises`)}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 transition-colors"
                            >
                                {t('admin.eventDetail.actions.viewEnterpriseRequests')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirm modals */}
            {confirm === 'payment' && (
                <ConfirmModal
                    title={t('admin.eventDetail.confirm.paymentTitle')}
                    message={t('admin.eventDetail.confirm.paymentMessage', { title: event.title })}
                    confirmLabel={t('admin.eventDetail.confirm.paymentLabel')}
                    confirmClass="bg-blue-600 hover:bg-blue-700"
                    onConfirm={handleConfirmPayment}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm === 'start' && (
                <ConfirmModal
                    title={t('admin.eventDetail.confirm.startTitle')}
                    message={t('admin.eventDetail.confirm.startMessage', { title: event.title })}
                    confirmLabel={t('admin.eventDetail.confirm.startLabel')}
                    confirmClass="bg-indigo-600 hover:bg-indigo-700"
                    onConfirm={handleForceStart}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm === 'close' && (
                <ConfirmModal
                    title={t('admin.eventDetail.confirm.closeTitle')}
                    message={t('admin.eventDetail.confirm.closeMessage', { title: event.title })}
                    confirmLabel={t('admin.eventDetail.confirm.closeLabel')}
                    confirmClass="bg-red-600 hover:bg-red-700"
                    onConfirm={handleForceClose}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {/* Toast */}
            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    );
}
