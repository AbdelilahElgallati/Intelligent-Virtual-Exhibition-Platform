'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { eventsApi } from '@/lib/api/events';
import { OrganizerEvent, EventStatus } from '@/types/event';
import { Plus, Search, Eye, CreditCard, Play, XCircle, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<EventStatus, string> = {
    pending_approval: 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    waiting_for_payment: 'Waiting for Payment',
    payment_done: 'Payment Done',
    live: 'Live',
    closed: 'Closed',
};

const STATE_COLORS: Record<EventStatus, string> = {
    pending_approval: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
    waiting_for_payment: 'bg-orange-100 text-orange-700',
    payment_done: 'bg-indigo-100 text-indigo-700',
    live: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
};

export default function OrganizerEvents() {
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
        catch (err: any) { alert(err.message || 'Failed to start event'); }
        finally { setActionLoading(null); }
    };

    const handleClose = async (id: string) => {
        if (!confirm('Are you sure you want to close this event?')) return;
        setActionLoading(id + '-close');
        try { await eventsApi.closeEvent(id); await fetchEvents(); }
        catch (err: any) { alert(err.message || 'Failed to close event'); }
        finally { setActionLoading(null); }
    };

    const filtered = events.filter(
        (e) =>
            e.title.toLowerCase().includes(search.toLowerCase()) ||
            STATE_LABELS[e.state].toLowerCase().includes(search.toLowerCase())
    );

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
                    <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
                    <p className="text-gray-500 text-sm">Manage and track your event requests.</p>
                </div>
                <Link href="/organizer/events/new">
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4 mr-2" />
                        New Event Request
                    </Button>
                </Link>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by title or status…"
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
                        ? "You haven't submitted any event requests yet."
                        : 'No events match your search.'}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold">Event</th>
                                <th className="px-4 py-3 text-left font-semibold">Dates</th>
                                <th className="px-4 py-3 text-left font-semibold">Enterprises</th>
                                <th className="px-4 py-3 text-left font-semibold">Payment</th>
                                <th className="px-4 py-3 text-left font-semibold">Status</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((event) => (
                                <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 truncate max-w-[200px]">{event.title}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{event.category}</div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                                        <div>{new Date(event.start_date).toLocaleDateString()}</div>
                                        <div className="text-xs text-gray-400">→ {new Date(event.end_date).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">
                                        {event.num_enterprises ?? '—'}
                                    </td>
                                    <td className="px-4 py-4 text-gray-600">
                                        {event.payment_amount != null
                                            ? <span className="font-medium text-gray-900">${event.payment_amount.toFixed(2)}</span>
                                            : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATE_COLORS[event.state]}`}>
                                            {STATE_LABELS[event.state]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2 flex-wrap">
                                            {/* View details — always shown */}
                                            <Link href={`/organizer/events/${event.id}`}>
                                                <Button variant="outline" size="sm" className="gap-1">
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View
                                                </Button>
                                            </Link>

                                            {/* Pay — when waiting_for_payment */}
                                            {event.state === 'waiting_for_payment' && (
                                                <Link href={`/organizer/events/${event.id}`}>
                                                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 gap-1">
                                                        <CreditCard className="w-3.5 h-3.5" />
                                                        Pay Now
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
                                                    Start
                                                </Button>
                                            )}

                                            {/* Close — when live */}
                                            {event.state === 'live' && (
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
                                            )}

                                            {/* Analytics — live or closed */}
                                            {(event.state === 'live' || event.state === 'closed') && (
                                                <Link href={`/organizer/events/${event.id}/analytics`}>
                                                    <Button variant="outline" size="sm" className="gap-1">
                                                        <BarChart2 className="w-3.5 h-3.5" />
                                                        Analytics
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
