'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { eventsApi } from '@/lib/api/events';
import { OrganizerEvent, EventStatus } from '@/types/event';
import { Plus, Search, Eye, CreditCard, Play, XCircle, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatInUserTZ } from '@/lib/timezone';
import { getEffectiveWorkflowState, getLiveWorkflowLabel } from '@/lib/eventWorkflowBadge';
import { useTranslation } from 'react-i18next';

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<EventStatus, string> = {
    pending_approval: 'organizer.events.states.pendingApproval',
    approved: 'organizer.events.states.approved',
    rejected: 'organizer.events.states.rejected',
    waiting_for_payment: 'organizer.events.states.waitingForPayment',
    payment_proof_submitted: 'organizer.events.states.paymentProofSubmitted',
    payment_done: 'organizer.events.states.paymentDone',
    live: 'organizer.events.states.live',
    closed: 'organizer.events.states.closed',
};

const STATE_COLORS: Record<EventStatus, string> = {
    pending_approval: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    waiting_for_payment: 'bg-orange-100 text-orange-700',
    payment_proof_submitted: 'bg-teal-100 text-teal-700',
    payment_done: 'bg-indigo-100 text-indigo-700',
    live: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
};

/** When backend state is `live`, badge reflects real-world timing (upcoming / in-session / live), not only the workflow flag. */
function getOrganizerListStatusBadge(event: OrganizerEvent, t: (key: string) => string): { label: string; className: string } {
    const effective = getEffectiveWorkflowState(event);
    if (event.state !== 'live') {
        return { label: t(STATE_LABELS[effective]), className: STATE_COLORS[effective] };
    }
    const live = getLiveWorkflowLabel(event);
    if (!live) {
        return { label: t(STATE_LABELS[effective]), className: STATE_COLORS[effective] };
    }
    if (live.kind === 'closed') {
        return { label: t(STATE_LABELS.closed), className: STATE_COLORS.closed };
    }
    if (live.kind === 'session_live') {
        return { label: t('organizer.events.states.live'), className: STATE_COLORS.live };
    }
    if (live.kind === 'between_slots') {
        return { label: t('organizer.events.states.inProgress'), className: 'bg-sky-100 text-sky-700' };
    }
    return { label: t('organizer.events.states.upcoming'), className: 'bg-indigo-100 text-indigo-700' };
}

export default function OrganizerEvents() {
    const { t } = useTranslation();
    const [events, setEvents] = useState<OrganizerEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchEvents = async () => {
        try {
            const data = await eventsApi.getOrganizerEvents();
            setEvents(data || []);
        } catch (err) {
            console.error('Failed to fetch events', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    const handleStart = async (id: string) => {
        setActionLoading(id + '-start');
        try { await eventsApi.startEvent(id); await fetchEvents(); }
        catch (err: any) { alert(err.message || t('organizer.events.toast.startFailed')); }
        finally { setActionLoading(null); }
    };

    const handleClose = async (id: string) => {
        if (!confirm(t('organizer.events.confirm.closeMessage'))) return;
        setActionLoading(id + '-close');
        try { await eventsApi.closeEvent(id); await fetchEvents(); }
        catch (err: any) { alert(err.message || t('organizer.events.toast.closeFailed')); }
        finally { setActionLoading(null); }
    };

    const filtered = events.filter((e) => {
        const q = search.toLowerCase();
        const badge = getOrganizerListStatusBadge(e, t);
        return e.title.toLowerCase().includes(q) || badge.label.toLowerCase().includes(q);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('organizer.events.title')}</h1>
                    <p className="text-gray-500 text-sm">{t('organizer.events.subtitle')}</p>
                </div>
                <Link href="/organizer/events/new">
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        {t('organizer.events.newEvent')}
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('organizer.events.searchPlaceholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-500 text-sm">
                    {events.length === 0
                        ? t('organizer.events.empty')
                        : t('organizer.events.noMatch')}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold">{t('organizer.events.table.event')}</th>
                                <th className="px-4 py-3 text-left font-semibold">{t('organizer.events.table.dates')}</th>
                                <th className="px-4 py-3 text-left font-semibold">{t('organizer.events.table.enterprises')}</th>
                                <th className="px-4 py-3 text-left font-semibold">{t('organizer.events.table.payment')}</th>
                                <th className="px-4 py-3 text-left font-semibold">{t('organizer.events.table.status')}</th>
                                <th className="px-4 py-3 text-right font-semibold">{t('organizer.events.table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((event) => (
                                (() => {
                                    const effectiveState = getEffectiveWorkflowState(event);
                                    const listBadge = getOrganizerListStatusBadge(event, t);
                                    return (
                                <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 truncate max-w-[200px]">{event.title}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{event.category}</div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                                        <div>{formatInUserTZ(event.start_date, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                        <div className="text-xs text-gray-400">→ {formatInUserTZ(event.end_date, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">
                                        {event.num_enterprises ?? '—'}
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">
                                        {event.payment_amount != null
                                            ? <span className="font-medium text-gray-900">{event.payment_amount.toFixed(2)} MAD</span>
                                            : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${listBadge.className}`}>
                                            {listBadge.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                            {/* View details — always shown */}
                                            <Link href={`/organizer/events/${event.slug || event.id}`}>
                                                <Button variant="outline" size="sm" className="gap-1">
                                                    <Eye className="w-3.5 h-3.5" />
                                                    {t('organizer.events.actions.view')}
                                                </Button>
                                            </Link>

                                            {/* Pay — when waiting_for_payment */}
                                            {event.state === 'waiting_for_payment' && (
                                                <Link href={`/organizer/events/${event.slug || event.id}`}>
                                                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1">
                                                        <CreditCard className="w-3.5 h-3.5" />
                                                        {t('organizer.events.actions.payNow')}
                                                    </Button>
                                                </Link>
                                            )}

                                            {/* Start — when payment_done */}
                                            {event.state === 'payment_done' && (
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 gap-1"
                                                    isLoading={actionLoading === event.id + '-start'}
                                                    onClick={() => handleStart(event.id)}
                                                >
                                                    <Play className="w-3.5 h-3.5" />
                                                    {t('organizer.events.actions.start')}
                                                </Button>
                                            )}

                                            {/* Close — when live */}
                                            {/* {event.state === 'live' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                                                    isLoading={actionLoading === event.id + '-close'}
                                                    onClick={() => handleClose(event.id)}
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Close
                                                </Button>
                                            )} */}

                                            {/* Analytics — live or closed */}
                                            {(effectiveState === 'live' || effectiveState === 'closed') && (
                                                <Link href={`/organizer/events/${event.slug || event.id}/analytics`}>
                                                    <Button variant="outline" size="sm" className="gap-1">
                                                        <BarChart2 className="w-3.5 h-3.5" />
                                                        {t('organizer.events.actions.analytics')}
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                    );
                                })()
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
