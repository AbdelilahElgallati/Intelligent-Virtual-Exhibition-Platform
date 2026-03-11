"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { http } from '@/lib/http';
import { Button } from '@/components/ui/Button';
import {
    Calendar, MapPin, Clock, CheckCircle2, CreditCard,
    Loader, Settings, AlertCircle, Globe, Users, DollarSign,
    Building2, X, Tag, ChevronRight, BarChart3, MessageSquare
} from 'lucide-react';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; badgeClass: string; icon: React.ReactNode }> = {
    pending_payment: {
        label: 'Pay Stand Fee',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: <CreditCard size={13} />,
    },
    pending_admin_approval: {
        label: 'Awaiting Approval',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Loader size={13} className="animate-spin" />,
    },
    approved: {
        label: 'Stand Approved',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 size={13} />,
    },
    rejected: {
        label: 'Stand Rejected',
        color: 'bg-red-50 text-red-700 border-red-200',
        badgeClass: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle size={13} />,
    },
};

// Helper: resolve stand price from raw event doc
const getStandPrice = (ev: any): number | null => {
    // Events schema uses "stand_price" but some legacy docs may use "stand_fee"
    const val = ev.stand_price ?? ev.stand_fee;
    return (val !== undefined && val !== null) ? Number(val) : null;
};

// ─── Day-by-Day Schedule Panel ───────────────────────────────────────────────

function ScheduleSection({ ev }: { ev: any }) {
    const scheduleDays: any[] = ev.schedule_days || [];

    // Fallback: if no structured days, show key dates
    const fmt = (d?: string) => d
        ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '—';

    if (scheduleDays.length === 0) {
        // Simple fallback dates
        const phases = [
            { label: 'Registration Opens', date: ev.schedule?.registration_open_date },
            { label: 'Registration Deadline', date: ev.schedule?.registration_deadline },
            { label: 'Event Starts', date: ev.start_date || ev.schedule?.start_date },
            { label: 'Event Ends', date: ev.end_date || ev.schedule?.end_date },
        ].filter(p => p.date);

        if (phases.length === 0) return null;

        return (
            <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                    <Clock size={14} /> Schedule
                </h3>
                <div className="space-y-2">
                    {phases.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                            <span className="text-sm text-zinc-500">{p.label}</span>
                            <span className="text-sm font-semibold text-zinc-900">{fmt(p.date)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-sm font-bold text-zinc-700 mb-4 flex items-center gap-2">
                <Calendar size={14} /> Detailed Schedule
            </h3>
            <div className="space-y-4">
                {scheduleDays.map((day: any, di: number) => (
                    <div key={di} className="rounded-xl border border-zinc-100 overflow-hidden">
                        {/* Day header */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                            <div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                                D{day.day_number}
                            </div>
                            <span className="text-sm font-bold text-indigo-900">
                                {day.date_label || `Day ${day.day_number}`}
                            </span>
                        </div>
                        {/* Slots */}
                        {day.slots && day.slots.length > 0 ? (
                            <div className="divide-y divide-zinc-50">
                                {day.slots.map((slot: any, si: number) => (
                                    <div key={si} className="flex items-start gap-3 px-4 py-3">
                                        <div className="flex-shrink-0 text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg whitespace-nowrap mt-0.5">
                                            {slot.start_time} – {slot.end_time}
                                        </div>
                                        <span className="text-sm text-zinc-700 leading-snug">
                                            {slot.label || 'Activity'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-3 text-xs text-zinc-400 italic">No slots defined for this day.</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function EventDetailPanel({ ev, onClose, onJoin, onPay, actionLoading }: {
    ev: any;
    onClose: () => void;
    onJoin: (id: string) => void;
    onPay: (id: string) => void;
    actionLoading: string | null;
}) {
    const evId = ev.id || ev._id;
    const participation = ev.participation;
    const partStatus = participation?.status;
    const statusConf = partStatus ? STATUS_CONFIG[partStatus] : null;
    const standPrice = getStandPrice(ev);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}>

                {/* Banner / Header */}
                <div className="relative">
                    {ev.banner_url ? (
                        <div className="h-44 w-full overflow-hidden rounded-t-2xl">
                            <img src={ev.banner_url} alt={ev.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent rounded-t-2xl" />
                        </div>
                    ) : (
                        <div className="h-44 w-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl" />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold drop-shadow">{ev.title}</h2>
                                <p className="text-white/80 text-sm mt-0.5 capitalize">
                                    {(ev.state || ev.status || '').replace(/_/g, ' ')}
                                </p>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    {statusConf && (
                        <span className={`absolute top-4 right-14 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusConf.color}`}>
                            {statusConf.icon} {statusConf.label}
                        </span>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {/* Description */}
                    {ev.description && (
                        <p className="text-zinc-600 text-sm leading-relaxed">{ev.description}</p>
                    )}

                    {/* Key Info Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {ev.organizer_name && (
                            <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                                <Building2 size={16} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-zinc-500">Organizer</p>
                                    <p className="text-sm font-semibold text-zinc-900">{ev.organizer_name}</p>
                                </div>
                            </div>
                        )}
                        {ev.location && (
                            <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                                <MapPin size={16} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-zinc-500">Location</p>
                                    <p className="text-sm font-semibold text-zinc-900">{ev.location}</p>
                                </div>
                            </div>
                        )}
                        {(ev.max_stands || ev.num_enterprises) && (
                            <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                                <Users size={16} className="text-indigo-600 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-zinc-500">Enterprise Slots</p>
                                    <p className="text-sm font-semibold text-zinc-900">
                                        {ev.stands_left !== undefined
                                            ? `${ev.stands_left} of ${ev.max_stands || ev.num_enterprises} remaining`
                                            : `${ev.max_stands || ev.num_enterprises} stands`
                                        }
                                    </p>
                                </div>
                            </div>
                        )}
                        {standPrice !== null && (
                            <div className={`flex items-center gap-3 p-3 rounded-xl border ${standPrice > 0 ? 'bg-amber-50 border-amber-100' : 'bg-zinc-50 border-zinc-100'}`}>
                                <DollarSign size={16} className={standPrice > 0 ? 'text-amber-600 flex-shrink-0' : 'text-zinc-400 flex-shrink-0'} />
                                <div>
                                    <p className={`text-xs ${standPrice > 0 ? 'text-amber-600' : 'text-zinc-500'}`}>Stand Fee</p>
                                    <p className={`text-sm font-bold ${standPrice > 0 ? 'text-amber-800' : 'text-zinc-600'}`}>
                                        {standPrice > 0 ? `$${standPrice}` : 'Free'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Day-by-Day Schedule */}
                    <ScheduleSection ev={ev} />

                    {/* Tags */}
                    {ev.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {ev.tags.map((tag: string) => (
                                <span key={tag} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full border border-indigo-100">
                                    <Tag size={10} /> {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Payment receipt */}
                    {participation?.payment_reference && (
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <p className="text-xs font-semibold text-emerald-700 mb-1">Payment Reference</p>
                            <p className="font-mono text-sm text-emerald-900">{participation.payment_reference}</p>
                        </div>
                    )}

                    {/* Rejection reason */}
                    {partStatus === 'rejected' && participation?.rejection_reason && (
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                            <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason</p>
                            <p className="text-sm text-red-800">{participation.rejection_reason}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        {!participation && (
                            <Button onClick={() => onJoin(evId)} isLoading={actionLoading === evId} className="flex-1">
                                Request to Join
                            </Button>
                        )}
                        {partStatus === 'pending_payment' && (
                            <Button
                                onClick={() => onPay(evId)}
                                isLoading={actionLoading === evId + '_pay'}
                                className={`flex-1 ${standPrice === 0 ? 'bg-zinc-600 hover:bg-zinc-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                            >
                                <CreditCard size={16} className="mr-2" />
                                {standPrice === 0 ? 'Confirm (Free Stand)' : `Pay Stand Fee (${standPrice} MAD)`}
                            </Button>
                        )}
                        {partStatus === 'pending_admin_approval' && (
                            <Button disabled className="flex-1 opacity-60 cursor-not-allowed">
                                Waiting for Admin Approval…
                            </Button>
                        )}
                        {partStatus === 'approved' && (
                            <Link href={`/enterprise/events/${evId}/stand`} className="flex-1">
                                <Button className="w-full flex items-center gap-2">
                                    <Settings size={16} /> Configure Stand
                                </Button>
                            </Link>
                        )}
                        <Button variant="outline" onClick={onClose} className="px-5">Close</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EnterpriseEventCard({
    ev, onDetails, onJoin, actionLoading,
}: {
    ev: any;
    onDetails: () => void;
    onJoin: (id: string) => void;
    actionLoading: string | null;
}) {
    const evId = ev.id || ev._id;
    const participation = ev.participation;
    const partStatus = participation?.status;
    const statusConf = partStatus ? STATUS_CONFIG[partStatus] : null;
    const standPrice = getStandPrice(ev);

    const fmtDate = (d?: string) => d
        ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;
    const startDate = fmtDate(ev.start_date || ev.schedule?.start_date);
    const endDate = fmtDate(ev.end_date || ev.schedule?.end_date);

    return (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col group">
            {/* Banner */}
            <div className="relative h-44 w-full overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 flex-shrink-0">
                {ev.banner_url ? (
                    <img
                        src={ev.banner_url}
                        alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-30">
                        <Globe size={48} className="text-white" />
                    </div>
                )}
                {/* Status badge */}
                {statusConf ? (
                    <span className={`absolute top-3 right-3 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusConf.badgeClass}`}>
                        {statusConf.icon} {statusConf.label}
                    </span>
                ) : (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/90 text-zinc-600 border border-zinc-200 capitalize">
                        {(ev.state || '').replace(/_/g, ' ')}
                    </span>
                )}
                {/* Stand fee badge — only show when there's an actual price */}
                {standPrice !== null && (
                    <span className={`absolute bottom-3 left-3 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${standPrice > 0 ? 'bg-amber-500 text-white' : 'bg-white/90 text-zinc-600 border border-zinc-200'}`}>
                        <DollarSign size={9} />
                        {standPrice > 0 ? `$${standPrice} stand fee` : 'Free stand'}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col flex-1 gap-3">
                <div>
                    <h3 className="font-bold text-zinc-900 text-base leading-snug group-hover:text-indigo-700 transition-colors line-clamp-1">
                        {ev.title}
                    </h3>
                    {ev.description && (
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{ev.description}</p>
                    )}
                </div>

                {/* Meta */}
                <div className="flex flex-col gap-1.5 text-xs text-zinc-400">
                    {ev.organizer_name && (
                        <span className="flex items-center gap-1.5">
                            <Building2 size={12} className="text-indigo-400 flex-shrink-0" />
                            <span className="truncate font-medium text-zinc-600">{ev.organizer_name}</span>
                        </span>
                    )}
                    {(startDate || endDate) && (
                        <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-indigo-400 flex-shrink-0" />
                            {startDate}{endDate && startDate !== endDate ? ` → ${endDate}` : ''}
                        </span>
                    )}
                    {ev.location && (
                        <span className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-indigo-400 flex-shrink-0" />
                            <span className="truncate">{ev.location}</span>
                        </span>
                    )}
                </div>

                {/* Tags */}
                {ev.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {ev.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                                {tag}
                            </span>
                        ))}
                        {ev.tags.length > 3 && <span className="text-[10px] text-zinc-400">+{ev.tags.length - 3}</span>}
                    </div>
                )}

                {/* Stands left indicator */}
                {ev.stands_left !== undefined && ev.num_enterprises > 0 && !participation && (
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border w-fit ${ev.stands_left === 0
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : ev.stands_left <= 2
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                        <Users size={10} />
                        {ev.stands_left === 0 ? 'Fully Booked' : `${ev.stands_left} stand${ev.stands_left > 1 ? 's' : ''} left`}
                    </div>
                )}

                <div className="flex-1" />

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-4 mt-auto border-t border-zinc-100">
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={onDetails} className="flex-1 flex items-center justify-center gap-1.5 text-xs h-10 border-zinc-200 hover:bg-zinc-50 font-bold">
                            View Details
                        </Button>
                        {!participation && ev.stands_left !== 0 && (
                            <Button size="sm" onClick={() => onJoin(evId)} isLoading={actionLoading === evId} className="flex-1 text-xs h-10 bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 font-bold">
                                Join Event
                            </Button>
                        )}
                        {!participation && ev.stands_left === 0 && (
                            <Button size="sm" disabled className="flex-1 text-xs h-10 opacity-50 bg-zinc-100 text-zinc-400 font-bold">
                                Fully Booked
                            </Button>
                        )}
                        {partStatus === 'pending_payment' && (
                            <Button size="sm" onClick={onDetails} className="flex-1 text-xs h-10 bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-200 font-bold">
                                {standPrice === 0 ? 'Confirm' : 'Pay Fee'}
                            </Button>
                        )}
                        {partStatus === 'approved' && (
                            <Link href={`/enterprise/events/${evId}/manage`} className="flex-1">
                                <Button size="sm" className="w-full flex items-center justify-center gap-1.5 text-xs h-10 bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 font-bold text-white">
                                    <MessageSquare size={14} /> Manage Event
                                </Button>
                            </Link>
                        )}
                    </div>

                    {partStatus === 'approved' && (
                        <div className="flex gap-2">
                            <Link href={`/enterprise/events/${evId}/analytics`} className="flex-1">
                                <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-1.5 text-xs h-9 border-zinc-200 font-semibold text-zinc-600">
                                    <BarChart3 size={13} /> Analytics
                                </Button>
                            </Link>
                            <Link href={`/enterprise/events/${evId}/stand`} className="flex-1">
                                <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-1.5 text-xs h-9 border-zinc-200 font-semibold text-zinc-600">
                                    <Settings size={13} /> Configure
                                </Button>
                            </Link>
                        </div>
                    )}

                    {(partStatus === 'pending_admin_approval' || partStatus === 'rejected') && (
                        <Button size="sm" variant="outline" disabled className="w-full text-xs h-10 opacity-60 bg-zinc-50 border-zinc-100">
                            {partStatus === 'rejected' ? 'Request Rejected' : 'Waiting for Approval…'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnterpriseEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [search, setSearch] = useState('');
    const searchParams = useSearchParams();
    const paymentSuccess = searchParams.get('payment_success') === 'true';
    const paymentCancelled = searchParams.get('payment_cancelled') === 'true';

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const data = await http.get<any[]>('/enterprise/events');
            setEvents(data);
        } catch (err) {
            console.error('Failed to fetch events', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    const handleJoin = async (eventId: string) => {
        setActionLoading(eventId);
        try {
            await http.post(`/enterprise/events/${eventId}/join`, {});
            await fetchEvents();
            setSelectedEvent(null);
        } catch (err: any) {
            alert(err.message || 'Failed to join event');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePay = async (eventId: string) => {
        setActionLoading(eventId + '_pay');
        try {
            const res = await http.post(`/enterprise/events/${eventId}/pay`, {});
            // If Payzone returns a payment_url, redirect to it
            if (res.payment_url) {
                window.location.href = res.payment_url;
                return;
            }
            // Otherwise (free stand fee), just refresh
            await fetchEvents();
            setSelectedEvent(null);
        } catch (err: any) {
            alert(err.message || 'Payment failed');
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = events.filter(ev =>
        !search ||
        ev.title?.toLowerCase().includes(search.toLowerCase()) ||
        ev.description?.toLowerCase().includes(search.toLowerCase()) ||
        ev.organizer_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {paymentSuccess && (
                <div className="rounded-xl p-4 text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                    <p className="font-bold">Stand Fee Payment Successful!</p>
                    <p className="mt-1">Your payment has been confirmed. Your stand request is now pending admin approval.</p>
                </div>
            )}
            {paymentCancelled && (
                <div className="rounded-xl p-4 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <p className="font-bold">Payment Cancelled</p>
                    <p className="mt-1">Stand fee payment was cancelled. You can try again from the event details.</p>
                </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-zinc-500 text-sm">Browse available events and manage your participation.</p>
                <input
                    type="text"
                    placeholder="Search events…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full sm:w-64 pl-4 pr-4 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
                />
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-96 rounded-2xl bg-zinc-100 animate-pulse" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-20 text-center">
                    <Globe className="mx-auto text-zinc-200 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-zinc-900 mb-2">
                        {events.length === 0 ? 'No events available' : 'No events match your search'}
                    </h3>
                    <p className="text-zinc-500">{events.length === 0 ? 'Check back later.' : 'Try a different search term.'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(ev => (
                        <EnterpriseEventCard
                            key={ev.id || ev._id}
                            ev={ev}
                            onDetails={() => setSelectedEvent(ev)}
                            onJoin={handleJoin}
                            actionLoading={actionLoading}
                        />
                    ))}
                </div>
            )}

            {selectedEvent && (
                <EventDetailPanel
                    ev={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    onJoin={handleJoin}
                    onPay={handlePay}
                    actionLoading={actionLoading}
                />
            )}
        </div>
    );
}
