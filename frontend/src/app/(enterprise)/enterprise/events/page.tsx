"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { http } from '@/lib/http';
import { resolveMediaUrl } from '@/lib/media';
import { formatInTZ, getUserTimezone, formatInUserTZ, zonedToUtc, getEventDayDate } from '@/lib/timezone';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import {
    Calendar, MapPin, Clock, CheckCircle2, CreditCard,
    Loader, Settings, AlertCircle, Globe, Users, DollarSign,
    Building2, X, Tag, ChevronRight, BarChart3, MessageSquare,
    Download,
    CalendarClock, Lock, CalendarCheck,
} from 'lucide-react';
import { downloadEnterpriseStandFeeReceiptPdf } from '@/lib/pdf/receipts';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { formatSlotRangeLabel, isOvernightSlot } from '@/lib/schedule';
import { getLiveWorkflowLabel, getEffectiveWorkflowState } from '@/lib/eventWorkflowBadge';
import { useTranslation } from 'react-i18next';

const resolveDisplayTimezone = (rawTz?: string, fallback?: string): string => {
    const base = fallback || 'Africa/Casablanca';
    if (!rawTz) return base;
    const tz = String(rawTz).trim();
    if (!tz || tz.toUpperCase() === 'UTC' || tz === 'Etc/UTC' || tz.toUpperCase() === 'GMT') return 'Africa/Casablanca';
    return tz;
};

// Helper: extract ISO string from raw date value (handles MongoDB $date objects)
const extractDateStr = (raw: any): string => {
    if (!raw) return '';
    let str = '';
    if (typeof raw === 'string') {
        str = raw;
    } else if (raw instanceof Date) {
        str = raw.toISOString();
    } else if (typeof raw === 'object' && raw.$date) {
        const val = raw.$date;
        str = typeof val === 'number' ? new Date(val).toISOString() : String(val);
    } else {
        str = String(raw);
    }

    if (str.includes('T') && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
        return str + 'Z';
    }
    return str;
};

// Helper: format date in enterprise display timezone
const formatToUTCDisplay = (rawDate?: any, formatStr: string = 'MMM d, yyyy', tz?: string) => {
    const dateStr = extractDateStr(rawDate);
    if (!dateStr) return null;
    const displayTz = resolveDisplayTimezone(tz);
    try {
        const formatted = formatInTZ(dateStr, displayTz, formatStr);
        // Robust cleanup: replace narrow non-breaking spaces (\u202f) and standard NBSP (\u00A0) with normal spaces
        return formatted.replace(/[\u202f\u00A0]/g, " ");
    } catch (err) {
        console.error('formatToUTCDisplay error:', err);
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            const result = new Intl.DateTimeFormat('en-US', {
                ...(formatStr.includes('yyyy') || formatStr.includes('MMMM') || formatStr.includes('MMM') ? {
                    year: 'numeric',
                    month: formatStr.includes('MMMM') ? 'long' : 'short',
                    day: 'numeric',
                } : {}),
                ...(formatStr.includes('h:mm') || formatStr.includes('HH:mm') ? {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: formatStr.includes('a'),
                } : {}),
                timeZone: displayTz,
            }).format(date);
            return result.replace(/[\u202f\u00A0]/g, " ");
        } catch {
            return null;
        }
    }
};

// --- Status config ---

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; badgeClass: string; icon: React.ReactNode }> = {
    pending_payment: {
        labelKey: 'enterprise.events.status.payStandFee',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
        icon: <CreditCard size={13} />,
    },
    pending_admin_approval: {
        labelKey: 'enterprise.events.status.awaitingApproval',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <Loader size={13} className="animate-spin" />,
    },
    approved: {
        labelKey: 'enterprise.events.status.standApproved',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 size={13} />,
    },
    guest_approved: {
        labelKey: 'enterprise.events.status.guestApproved',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        icon: <CheckCircle2 size={13} />,
    },
    rejected: {
        labelKey: 'enterprise.events.status.standRejected',
        color: 'bg-red-50 text-red-700 border-red-200',
        badgeClass: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle size={13} />,
    },
};

const getStandPrice = (ev: any): number | null => {
    const val = ev.stand_price ?? ev.stand_fee;
    return (val !== undefined && val !== null) ? Number(val) : null;
};

const parseClockTime = (value?: string): [number, number] | null => {
    if (!value || !value.includes(':')) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return [hours, minutes];
};

const getEventScheduleWindow = (ev: any): { start: Date | null; end: Date | null } => {
    const scheduleDays: any[] = Array.isArray(ev?.schedule_days) ? ev.schedule_days : [];
    const baseDateValue = extractDateStr(ev?.start_date) || extractDateStr(ev?.schedule?.start_date);

    if (scheduleDays.length > 0 && baseDateValue) {
        let earliest: Date | null = null;
        let latest: Date | null = null;

        for (const day of scheduleDays) {
            const slots: any[] = Array.isArray(day?.slots) ? day.slots : [];
            const dayOffset = Math.max(0, Number(day?.day_number ?? 1) - 1);

            for (const slot of slots) {
                const startParts = parseClockTime(slot?.start_time);
                const endParts = parseClockTime(slot?.end_time);
                if (!startParts || !endParts) continue;

                const slotStart = new Date(baseDateValue);
                slotStart.setHours(0, 0, 0, 0);
                slotStart.setDate(slotStart.getDate() + dayOffset);
                slotStart.setHours(startParts[0], startParts[1], 0, 0);

                const slotEnd = new Date(baseDateValue);
                slotEnd.setHours(0, 0, 0, 0);
                slotEnd.setDate(slotEnd.getDate() + dayOffset);
                slotEnd.setHours(endParts[0], endParts[1], 0, 0);
                if (slotEnd <= slotStart) {
                    slotEnd.setDate(slotEnd.getDate() + 1);
                }

                if (!earliest || slotStart < earliest) earliest = slotStart;
                if (!latest || slotEnd > latest) latest = slotEnd;
            }
        }

        if (earliest || latest) {
            return { start: earliest, end: latest };
        }
    }

    return {
        start: baseDateValue ? new Date(baseDateValue) : null,
        end: extractDateStr(ev?.end_date) ? new Date(extractDateStr(ev.end_date)) : (extractDateStr(ev?.schedule?.end_date) ? new Date(extractDateStr(ev.schedule.end_date)) : null),
    };
};

function resolveEnterpriseEventTimeline(ev: any) {
    const normalizedEv = {
        ...ev,
        start_date: extractDateStr(ev.start_date),
        end_date: extractDateStr(ev.end_date),
    };
    const lifecycle = getEventLifecycle(normalizedEv);
    const explicitState = String(ev?.state || '').toLowerCase();
    const explicitClosed = explicitState === 'closed';
    const explicitLive = explicitState === 'live';

    const isBetweenSlots = lifecycle.isBetweenSlots;
    const timelineLive = lifecycle.hasScheduleSlots && lifecycle.displayState === 'LIVE';

    const explicitLiveFallback =
        explicitLive && !lifecycle.hasScheduleSlots && lifecycle.displayState === 'LIVE';

    const chronologyEnded = lifecycle.displayState === 'ENDED';
    const isEnded = explicitClosed || chronologyEnded;
    const isLive =
        !explicitClosed &&
        !chronologyEnded &&
        (timelineLive || explicitLiveFallback || (explicitLive && lifecycle.displayState === 'LIVE'));
    const isUpcoming = !isLive && !isEnded && !isBetweenSlots;

    const eventNotOpenedYet = !explicitLive && explicitState !== 'closed';
    if (eventNotOpenedYet) {
        return {
            lifecycle,
            isLive: false,
            isBetweenSlots: false,
            isEnded,
            isUpcoming: !isEnded,
        };
    }

    return {
        lifecycle,
        isLive,
        isEnded,
        isUpcoming,
        isBetweenSlots,
    };
}

// --- Day-by-Day Schedule Panel ---

function ScheduleSection({ ev }: { ev: any }) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const userTimezone = mounted ? (user?.timezone || getUserTimezone() || 'Africa/Casablanca') : 'Africa/Casablanca';

    const scheduleDays: any[] = ev.schedule_days || [];
    
    const formatDayLabel = (dayNumber: number, dayIndex: number): string => {
        const dayNum = Number(dayNumber || (dayIndex + 1));
        const eventTZ = resolveDisplayTimezone(ev.event_timezone, userTimezone);
        const startStr = extractDateStr(ev.start_date) || extractDateStr(ev.schedule?.start_date) || new Date().toISOString();
        const dayDate = getEventDayDate(startStr, eventTZ, dayNum);
        const options: Intl.DateTimeFormatOptions = {
            weekday: 'short', day: '2-digit', month: 'short'
        };
        const result = formatInUserTZ(dayDate, options, undefined, userTimezone);
        return result.replace(/[\u202f\u00A0]/g, " ");
    };

    const formatSlotTime = (dayNumber: number, timeStr: string, nextDay = false) => {
        const eventTZ = resolveDisplayTimezone(ev.event_timezone, userTimezone);
        const startStr = extractDateStr(ev.start_date) || extractDateStr(ev.schedule?.start_date);
        if (!startStr || !timeStr) return '--:--';

        const dayNum = Number(dayNumber) + (nextDay ? 1 : 0);
        const dayDate = getEventDayDate(startStr, eventTZ, dayNum);
        const ymd = formatInTZ(dayDate, eventTZ, 'yyyy-MM-dd');
        const utcDate = zonedToUtc(`${ymd}T${timeStr}:00`, eventTZ);

        const result = formatInUserTZ(utcDate, { hour: '2-digit', minute: '2-digit', hour12: false }, undefined, userTimezone);
        return result.replace(/[\u202f\u00A0]/g, " ");
    };

    const fmt = (d?: any) => formatToUTCDisplay(d, 'MMM d, yyyy h:mm a') || '-';

    if (scheduleDays.length === 0) {
        const phases = [
            { label: t('enterprise.events.detail.registrationOpens'), date: ev.schedule?.registration_open_date },
            { label: t('enterprise.events.detail.registrationDeadline'), date: ev.schedule?.registration_deadline },
            { label: t('enterprise.events.detail.eventStarts'), date: extractDateStr(ev.start_date) || extractDateStr(ev.schedule?.start_date) },
            { label: t('enterprise.events.detail.eventEnds'), date: extractDateStr(ev.end_date) || extractDateStr(ev.schedule?.end_date) },
        ].filter(p => p.date);

        if (phases.length === 0) return null;

        return (
            <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-3 flex items-center gap-2">
                    <Clock size={14} /> {t('enterprise.events.detail.schedule')}
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
                <Calendar size={14} /> {t('enterprise.events.detail.detailedSchedule')}
            </h3>
            <div className="space-y-4">
                {scheduleDays.map((day: any, di: number) => (
                    <div key={di} className="rounded-xl border border-zinc-100 overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                            <div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                                D{day.day_number}
                            </div>
                            <span className="text-sm font-bold text-indigo-900">
                                {formatDayLabel(day.day_number, di)}
                            </span>
                        </div>
                        {day.slots && day.slots.length > 0 ? (
                            <div className="divide-y divide-zinc-50">
                                {day.slots.map((slot: any, si: number) => (
                                    <div key={si} className="flex items-start gap-3 px-4 py-3">
                                        <div className="flex-shrink-0 text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg whitespace-nowrap mt-0.5">
                                            {formatSlotTime(day.day_number, slot.start_time)} - {formatSlotTime(day.day_number, slot.end_time)}
                                        </div>
                                        <span className="text-sm text-zinc-700 leading-snug">
                                            {slot.label || t('enterprise.events.detail.activityFallback')}
                                        </span>
                                        {isOvernightSlot(slot.start_time, slot.end_time) && (
                                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 border border-indigo-200 rounded-full px-2 py-0.5">
                                                {t('enterprise.events.detail.overnight')}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-4 py-3 text-xs text-zinc-400 italic">{t('enterprise.events.detail.noSlots')}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Detail Modal ---

function EventDetailPanel({ ev, onClose, onJoin, onPay, actionLoading }: {
    ev: any;
    onClose: () => void;
    onJoin: (id: string) => void;
    onPay: (id: string) => void;
    actionLoading: string | null;
}) {
    const { t } = useTranslation();
    const evId = ev.slug || ev.id || ev._id;
    const participation = ev.participation;
    const partStatus = participation?.status;
    const isAccepted = partStatus === 'approved' || partStatus === 'guest_approved';
    const statusConf = partStatus ? STATUS_CONFIG[partStatus] : null;
    const standPrice = getStandPrice(ev);
    const evState = String(ev.state || '');
    const {
        lifecycle,
        isLive: isEventLive,
        isEnded: isEventEnded,
        isUpcoming: isEventUpcoming,
        isBetweenSlots: isEventInProgress,
    } = (() => {
        const evStateStr = String(ev.state || '');
        const resolved = resolveEnterpriseEventTimeline(ev);
        if (evStateStr !== 'live') {
            return {
                ...resolved,
                isLive: false,
                isBetweenSlots: false,
                isUpcoming: !resolved.isEnded,
            };
        }
        return resolved;
    })();
    const canConfigure = isAccepted;
    const canManage = isAccepted && lifecycle.hasScheduleSlots;
    const canAnalytics = isAccepted && (lifecycle.displayState === 'LIVE' || lifecycle.displayState === 'ENDED');

    const tz = resolveDisplayTimezone(ev.event_timezone);
    const fmtDate = (d?: any) => formatToUTCDisplay(d, 'MMMM d, yyyy', tz);
    const startDate = fmtDate(extractDateStr(ev.start_date) || extractDateStr(ev.schedule?.start_date));
    const endDate = fmtDate(extractDateStr(ev.end_date) || extractDateStr(ev.schedule?.end_date));

    // Accent color based on event lifecycle
    const accentColor = isEventLive
        ? 'from-emerald-500 to-teal-500'
        : isEventInProgress
            ? 'from-sky-500 to-blue-500'
            : isEventEnded
                ? 'from-zinc-400 to-zinc-500'
                : isEventUpcoming
                    ? 'from-indigo-500 to-purple-500'
                    : 'from-amber-500 to-orange-500';

    const accentText = isEventLive
        ? 'text-emerald-600'
        : isEventInProgress
            ? 'text-blue-700'
            : isEventEnded
                ? 'text-zinc-500'
                : isEventUpcoming
                    ? 'text-indigo-600'
                    : 'text-amber-600';
    const accentBg = isEventLive
        ? 'bg-emerald-50'
        : isEventInProgress
            ? 'bg-blue-50'
            : isEventEnded
                ? 'bg-zinc-50'
                : isEventUpcoming
                    ? 'bg-indigo-50'
                    : 'bg-amber-50';
    const accentBorder = isEventLive
        ? 'border-emerald-200'
        : isEventInProgress
            ? 'border-blue-200'
            : isEventEnded
                ? 'border-zinc-200'
                : isEventUpcoming
                    ? 'border-indigo-200'
                    : 'border-amber-200';

    const downloadReceipt = async () => {
        try {
            const user = await http.get<any>('/users/me').catch(() => null);
            const tz = resolveDisplayTimezone(ev.event_timezone);
            const startDateLabel = formatToUTCDisplay(ev.start_date, 'MMM d, yyyy h:mm a', tz) || undefined;
            const endDateLabel = formatToUTCDisplay(ev.end_date, 'MMM d, yyyy h:mm a', tz) || undefined;
            await downloadEnterpriseStandFeeReceiptPdf({
                eventId: String(evId),
                eventTitle: ev.title || 'Event',
                organizerName: ev.organizer_name || '',
                buyerName: user?.full_name || user?.name || 'Enterprise',
                buyerEmail: user?.email || '',
                amount: Number(standPrice || 0),
                paidAt: participation?.updated_at,
                paymentReference: participation?.payment_reference || 'N/A',
                paymentMethodLabel: participation?.payment_reference ? 'Stripe (Online Card Payment)' : 'Free Access',
                eventLocation: ev.location,
                eventTimezone: ev.event_timezone,
                category: ev.category,
                startDateLabel,
                endDateLabel,
            });
        } catch (error) {
            console.error('Error generating receipt:', error);
            alert(t('enterprise.events.modal.receiptError'));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}>

                <div className={`h-1.5 bg-gradient-to-r ${accentColor} flex-shrink-0`}>
                    {isEventLive && <div className="h-full w-full bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse" />}
                </div>

                <div className="overflow-y-auto flex-1">
                    <div className="relative">
                        {ev.banner_url ? (
                            <div className="h-48 w-full overflow-hidden">
                                <img src={resolveMediaUrl(ev.banner_url)} alt={ev.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
                            </div>
                        ) : (
                            <div className={`h-48 w-full bg-gradient-to-br ${accentColor} opacity-90`} />
                        )}

                        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors backdrop-blur-sm">
                            <X size={18} />
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                            <h2 className="text-2xl font-bold tracking-tight drop-shadow-lg">{ev.title}</h2>
                            {(startDate || endDate) && (
                                <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
                                    <Calendar size={13} />
                                    {startDate}{endDate && startDate !== endDate ? ` - ${endDate}` : ''}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className={`px-6 py-3 ${accentBg} border-b ${accentBorder} flex items-center justify-between flex-wrap gap-2`}>
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${accentText}`}>
                                {isEventLive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                {isEventLive
                                    ? 'Live Now'
                                    : isEventInProgress
                                        ? 'In Progress'
                                        : (evState === 'approved' || evState === 'payment_done' || isEventUpcoming)
                                            ? 'Upcoming'
                                            : isEventEnded
                                                ? 'Ended'
                                                : 'Upcoming'}
                            </span>
                            {statusConf && (
                                <>
                                    <span className="text-zinc-300">|</span>
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${statusConf.color.includes('emerald') ? 'text-emerald-600' : statusConf.color.includes('amber') ? 'text-amber-600' : statusConf.color.includes('blue') ? 'text-blue-600' : statusConf.color.includes('red') ? 'text-red-600' : 'text-zinc-600'}`}>
                                        {statusConf.icon} {statusConf.label}
                                    </span>
                                </>
                            )}
                        </div>
                        {isEventLive && lifecycle.currentSlot?.label && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                {lifecycle.currentSlot?.label}
                            </span>
                        )}
                        {isEventUpcoming && lifecycle.nextSlot?.start && (
                            <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-full">
                                {formatTimeToStart(lifecycle.nextSlot?.start)}
                            </span>
                        )}
                        {isEventInProgress && lifecycle.nextSlot?.start && (
                            <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                                Next slot: {formatTimeToStart(lifecycle.nextSlot?.start)}
                            </span>
                        )}
                    </div>

                    <div className="p-6 space-y-5">
                        {ev.description && (
                            <p className="text-zinc-600 text-sm leading-relaxed">{ev.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-2.5">
                            {ev.organizer_name && (
                                <div className="flex items-center gap-2.5 p-3 bg-zinc-50 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Building2 size={14} className="text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('enterprise.events.detail.organizer')}</p>
                                        <p className="text-sm font-semibold text-zinc-900 truncate">{ev.organizer_name}</p>
                                    </div>
                                </div>
                            )}
                            {ev.location && (
                                <div className="flex items-center gap-2.5 p-3 bg-zinc-50 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <MapPin size={14} className="text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('enterprise.events.detail.location')}</p>
                                        <p className="text-sm font-semibold text-zinc-900 truncate">{ev.location}</p>
                                    </div>
                                </div>
                            )}
                            {(ev.max_stands || ev.num_enterprises) && (
                                <div className="flex items-center gap-2.5 p-3 bg-zinc-50 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Users size={14} className="text-indigo-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">{t('enterprise.events.detail.enterpriseSlots')}</p>
                                        <p className="text-sm font-semibold text-zinc-900">
                                            {ev.stands_left !== undefined
                                                ? t('enterprise.events.detail.standsLeft', { left: ev.stands_left, total: ev.max_stands || ev.num_enterprises })
                                                : t('enterprise.events.detail.standsTotal', { total: ev.max_stands || ev.num_enterprises })
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}
                            {standPrice !== null && (
                                <div className={`flex items-center gap-2.5 p-3 rounded-xl ${standPrice > 0 ? 'bg-amber-50' : 'bg-zinc-50'}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${standPrice > 0 ? 'bg-amber-100' : 'bg-zinc-100'}`}>
                                        <DollarSign size={14} className={standPrice > 0 ? 'text-amber-600' : 'text-zinc-400'} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-[10px] uppercase tracking-wider font-semibold ${standPrice > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>{t('enterprise.events.detail.standFee')}</p>
                                        <p className={`text-sm font-bold ${standPrice > 0 ? 'text-amber-800' : 'text-zinc-600'}`}>
                                            {standPrice > 0 ? `${standPrice} MAD` : t('enterprise.events.detail.free')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {ev.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {ev.tags.map((tag: string) => (
                                    <span key={tag} className="text-xs bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <ScheduleSection ev={ev} />

                        {partStatus === 'rejected' && participation?.rejection_reason && (
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start gap-3">
                                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-red-700 mb-0.5">{t('enterprise.events.detail.rejectionReason')}</p>
                                    <p className="text-sm text-red-800">{participation.rejection_reason}</p>
                                </div>
                            </div>
                        )}

                        {isAccepted && (
                            <div className="grid grid-cols-3 gap-2">
                                {canManage && (
                                    <Link href={`/enterprise/events/${evId}/manage`}>
                                        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer group/nav">
                                            <MessageSquare size={18} className="text-zinc-400 group-hover/nav:text-indigo-600 transition-colors" />
                                            <span className="text-[11px] font-semibold text-zinc-500 group-hover/nav:text-indigo-600 transition-colors">{t('enterprise.events.actions.manage')}</span>
                                        </div>
                                    </Link>
                                )}
                                {canAnalytics && (
                                    <Link href={`/enterprise/events/${evId}/analytics`}>
                                        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer group/nav">
                                            <BarChart3 size={18} className="text-zinc-400 group-hover/nav:text-indigo-600 transition-colors" />
                                            <span className="text-[11px] font-semibold text-zinc-500 group-hover/nav:text-indigo-600 transition-colors">{t('enterprise.events.actions.viewAnalytics')}</span>
                                        </div>
                                    </Link>
                                )}
                                {canConfigure && (
                                    <Link href={`/enterprise/events/${evId}/stand`}>
                                        <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer group/nav">
                                            <Settings size={18} className="text-zinc-400 group-hover/nav:text-indigo-600 transition-colors" />
                                            <span className="text-[11px] font-semibold text-zinc-500 group-hover/nav:text-indigo-600 transition-colors">{t('enterprise.events.actions.configureStand')}</span>
                                        </div>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/80 flex gap-3 flex-shrink-0">
                    {!participation && !isEventEnded && (
                        <Button onClick={() => onJoin(evId)} isLoading={actionLoading === evId} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 font-bold shadow-sm shadow-indigo-200">
                            {t('enterprise.events.actions.requestToJoin')}
                        </Button>
                    )}
                    {partStatus === 'pending_payment' && !isEventEnded && (
                        <Button
                            onClick={() => onPay(evId)}
                            isLoading={actionLoading === evId + '_pay'}
                            className={`flex-1 h-11 font-bold shadow-sm ${standPrice === 0 ? 'bg-zinc-600 hover:bg-zinc-700 shadow-zinc-200' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'}`}
                        >
                            <CreditCard size={16} className="mr-2" />
                            {standPrice === 0 ? t('enterprise.events.actions.confirmFreeStand') : `${t('enterprise.events.actions.payFee')} (${standPrice} MAD)`}
                        </Button>
                    )}
                    {partStatus === 'pending_admin_approval' && (
                        <Button disabled className="flex-1 h-11 opacity-60 cursor-not-allowed font-bold">
                            <Loader size={16} className="mr-2 animate-spin" /> {t('enterprise.events.actions.waitingForAdminApproval')}
                        </Button>
                    )}
                    {isAccepted && (
                        <button
                            onClick={downloadReceipt}
                            title={t('enterprise.events.actions.downloadReceipt')}
                            className="h-11 px-4 flex items-center gap-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold transition-colors"
                        >
                            <Download size={14} /> {t('enterprise.events.actions.receipt')}
                        </button>
                    )}
                    <Button variant="outline" onClick={onClose} className="px-5 h-11 border-zinc-200 font-bold">{t('enterprise.events.actions.close')}</Button>
                </div>
            </div>
        </div>
    );
}

// --- Event Card ---

function EnterpriseEventCard({
    ev, onDetails, onJoin, actionLoading,
}: {
    ev: any;
    onDetails: () => void;
    onJoin: (id: string) => void;
    actionLoading: string | null;
}) {
    const { t } = useTranslation();
    const evId = ev.slug || ev.id || ev._id;
    const participation = ev.participation;
    const partStatus = participation?.status;
    const isAccepted = partStatus === 'approved' || partStatus === 'guest_approved';
    const statusConf = partStatus ? STATUS_CONFIG[partStatus] : null;
    const standPrice = getStandPrice(ev);

    const downloadReceipt = async () => {
        try {
            const user = await http.get<any>('/users/me').catch(() => null);
            const tz = resolveDisplayTimezone(ev.event_timezone);
            const startDateLabel = formatToUTCDisplay(ev.start_date, 'MMM d, yyyy h:mm a', tz) || undefined;
            const endDateLabel = formatToUTCDisplay(ev.end_date, 'MMM d, yyyy h:mm a', tz) || undefined;
            await downloadEnterpriseStandFeeReceiptPdf({
                eventId: String(evId),
                eventTitle: ev.title || 'Event',
                organizerName: ev.organizer_name || '',
                buyerName: user?.full_name || user?.name || 'Enterprise',
                buyerEmail: user?.email || '',
                amount: Number(standPrice || 0),
                paidAt: participation?.updated_at,
                paymentReference: participation?.payment_reference || 'N/A',
                paymentMethodLabel: participation?.payment_reference ? 'Stripe (Online Card Payment)' : 'Free Access',
                eventLocation: ev.location,
                eventTimezone: ev.event_timezone,
                category: ev.category,
                startDateLabel,
                endDateLabel,
            });
        } catch (error) {
            console.error('Error generating receipt:', error);
            alert(t('enterprise.events.modal.receiptError'));
        }
    };

    const tz = resolveDisplayTimezone(ev.event_timezone);
    const fmtDate = (d?: any) => formatToUTCDisplay(d, 'MMM d, yyyy', tz);
    const startDate = fmtDate(extractDateStr(ev.start_date) || extractDateStr(ev.schedule?.start_date));
    const endDate = fmtDate(extractDateStr(ev.end_date) || extractDateStr(ev.schedule?.end_date));

    // Timeline status
    const evState = String(ev.state || '');
    const _resolved = resolveEnterpriseEventTimeline(ev);
    const _isLive = evState === 'live' ? _resolved.isLive : false;
    const _isBetweenSlots = evState === 'live' ? _resolved.isBetweenSlots : false;
    const _isEnded = _resolved.isEnded;
    const _isUpcoming = !_isLive && !_isBetweenSlots && !_isEnded;
    const lifecycle = _resolved.lifecycle;
    const isEventLive = _isLive;
    const isEventEnded = _isEnded;
    const isEventUpcoming = _isUpcoming;
    const isBetweenSlots = _isBetweenSlots;
    const isEventNotReady = ['pending_approval', 'waiting_for_payment', 'payment_proof_submitted'].includes(evState);

    const timelineBadge = (() => {
        const evStateStr = String(ev.state || '');

        if (evStateStr === 'approved' || evStateStr === 'payment_done') {
            return { label: t('enterprise.events.status.upcoming'), class: 'bg-indigo-500 text-white', pulse: false };
        }

        if (evStateStr === 'closed' || isEventEnded) {
            return { label: t('enterprise.events.status.ended'), class: 'bg-zinc-500 text-white', pulse: false };
        }

        if (evStateStr === 'live') {
            const liveLabel = getLiveWorkflowLabel(ev as any);
            if (liveLabel) {
                if (liveLabel.kind === 'session_live') {
                    return { label: t('enterprise.events.status.live'), class: 'bg-emerald-500 text-white', pulse: true };
                }
                if (liveLabel.kind === 'between_slots') {
                    return { label: t('enterprise.events.status.inProgress'), class: 'bg-blue-500 text-white', pulse: false };
                }
                if (liveLabel.kind === 'closed') {
                    return { label: t('enterprise.events.status.ended'), class: 'bg-zinc-500 text-white', pulse: false };
                }
                return { label: t('enterprise.events.status.upcoming'), class: 'bg-indigo-500 text-white', pulse: false };
            }
            return { label: t('enterprise.events.status.upcoming'), class: 'bg-indigo-500 text-white', pulse: false };
        }

        if (isEventNotReady) {
            return {
                label: evStateStr.replace(/_/g, ' '),
                class: 'bg-amber-100 text-amber-700',
                pulse: false,
            };
        }

        return { label: t('enterprise.events.status.upcoming'), class: 'bg-indigo-500 text-white', pulse: false };
    })();

    return (
        <div
            className={`bg-white rounded-2xl border overflow-hidden flex flex-col group cursor-pointer transition-all duration-300 ${
                isEventEnded
                    ? 'opacity-70 border-zinc-200'
                    : isEventLive
                        ? 'border-emerald-200 shadow-md shadow-emerald-50 hover:shadow-lg hover:shadow-emerald-100'
                        : 'border-zinc-200 shadow-sm hover:shadow-lg hover:border-indigo-200'
            }`}
            onClick={onDetails}
        >
            <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0">
                {ev.banner_url ? (
                    <img
                        src={resolveMediaUrl(ev.banner_url)}
                        alt={ev.title}
                        className={`w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ${isEventEnded ? 'grayscale-[40%]' : ''}`}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-30">
                        <Globe size={40} className="text-white" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {timelineBadge && (
                    <span className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm ${timelineBadge.class}`}>
                        {timelineBadge.pulse && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        {timelineBadge.label}
                    </span>
                )}
            </div>

            <div className="p-5 flex flex-col flex-1 gap-2.5">
                <h3 className="font-bold text-zinc-900 text-[15px] leading-snug group-hover:text-indigo-700 transition-colors line-clamp-1">
                    {ev.title}
                </h3>

                {(startDate || endDate) && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Calendar size={12} className="text-indigo-400 flex-shrink-0" />
                        <span>{startDate}{endDate && startDate !== endDate ? ` - ${endDate}` : ''}</span>
                    </div>
                )}

                {isEventLive && lifecycle.currentSlot?.label && (
                    <div className="text-[11px] font-semibold text-emerald-600">
                        Live slot: {lifecycle.currentSlot?.label}
                    </div>
                )}
                {lifecycle.displayState === 'UPCOMING' && lifecycle.nextSlot?.start && (
                    <div className="text-[11px] font-semibold text-indigo-600">
                        {formatTimeToStart(lifecycle.nextSlot?.start)}
                    </div>
                )}

                {statusConf && (
                    <div className={`flex items-center gap-1.5 text-[11px] font-semibold w-fit`}>
                        <span className={`inline-flex items-center gap-1 ${statusConf.color.includes('emerald') ? 'text-emerald-600' : statusConf.color.includes('amber') ? 'text-amber-600' : statusConf.color.includes('blue') ? 'text-blue-600' : statusConf.color.includes('red') ? 'text-red-600' : 'text-zinc-600'}`}>
                            {statusConf.icon} {statusConf.label}
                        </span>
                    </div>
                )}
                {!participation && !isEventEnded && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <Clock size={11} /> Not registered
                    </div>
                )}

                {ev.description && (
                    <p className="text-[13px] text-zinc-500 line-clamp-2 leading-relaxed">{ev.description}</p>
                )}

                {ev.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {ev.tags.slice(0, 3).map((tag: string, index: number) => (
                            <span key={`${index}-${tag}`} className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                                {tag}
                            </span>
                        ))}
                        {ev.tags.length > 3 && <span className="text-[10px] text-zinc-400">+{ev.tags.length - 3}</span>}
                    </div>
                )}

                {ev.stands_left !== undefined && ev.num_enterprises > 0 && !participation && (
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold w-fit ${
                        ev.stands_left === 0 ? 'text-red-500' : ev.stands_left <= 2 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                        <Users size={10} />
                        {ev.stands_left === 0 ? 'Fully Booked' : `${ev.stands_left} stand${ev.stands_left > 1 ? 's' : ''} left`}
                    </div>
                )}

                <div className="flex-1" />

                <div className="flex flex-col gap-2 pt-3 mt-auto border-t border-zinc-100" onClick={e => e.stopPropagation()}>
                    {!isAccepted ? (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={onDetails} className="flex-1 flex items-center justify-center gap-1.5 text-xs h-10 border-zinc-200 hover:bg-zinc-50 font-bold">
                                {t('enterprise.events.actions.viewDetails')}
                            </Button>
                            {!participation && !isEventEnded && ev.stands_left !== 0 && (
                                <Button
                                    size="sm"
                                    onClick={() => onJoin(evId)}
                                    isLoading={actionLoading === evId}
                                    className="flex-1 text-xs h-10 bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 font-bold"
                                >
                                    {t('enterprise.events.actions.joinEvent')}
                                </Button>
                            )}
                            {!participation && !isEventEnded && ev.stands_left === 0 && (
                                <Button size="sm" disabled className="flex-1 text-xs h-10 opacity-50 bg-zinc-100 text-zinc-400 font-bold">
                                    {t('enterprise.events.status.fullyBooked')}
                                </Button>
                            )}
                            {partStatus === 'pending_payment' && !isEventEnded && (
                                <Button size="sm" onClick={onDetails} className="flex-1 text-xs h-10 bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-100 font-bold">
                                    <CreditCard size={14} className="mr-1.5" />
                                    {standPrice === 0 ? t('enterprise.events.actions.confirm') : t('enterprise.events.actions.payFee')}
                                </Button>
                            )}
                            {(partStatus === 'pending_admin_approval') && (
                                <Button size="sm" variant="outline" disabled className="flex-1 text-xs h-10 opacity-60 bg-zinc-50 border-zinc-100 font-bold">
                                    {t('enterprise.events.status.awaitingApproval')}
                                </Button>
                            )}
                            {partStatus === 'rejected' && (
                                <Button size="sm" variant="outline" disabled className="flex-1 text-xs h-10 opacity-60 bg-red-50 border-red-100 text-red-400 font-bold">
                                    {t('enterprise.events.status.rejected')}
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={onDetails} className="flex items-center justify-center gap-1.5 text-[11px] h-9 border-zinc-200 hover:bg-zinc-50 font-bold">
                                {t('enterprise.events.actions.details')}
                            </Button>

                            {lifecycle.displayState !== 'ENDED' && (
                                <Link href={`/enterprise/events/${evId}/stand`} className="contents">
                                    <Button variant="outline" size="sm" className="flex items-center justify-center gap-1.5 text-[11px] h-9 border-zinc-200 hover:bg-zinc-50 font-bold">
                                        <Settings size={13} /> {t('enterprise.events.actions.configureStand')}
                                    </Button>
                                </Link>
                            )}

                            <Link href={`/enterprise/events/${evId}/analytics`} className="contents">
                                <Button variant="outline" size="sm" className="flex items-center justify-center gap-1.5 text-[11px] h-9 border-zinc-200 hover:bg-zinc-50 font-bold">
                                    <BarChart3 size={13} /> {t('enterprise.events.actions.viewAnalytics')}
                                </Button>
                            </Link>

                            <Button variant="outline" size="sm" onClick={downloadReceipt} className="flex items-center justify-center gap-1.5 text-[11px] h-9 border-zinc-200 hover:bg-zinc-50 font-bold">
                                <Download size={13} /> {t('enterprise.events.actions.receipt')}
                            </Button>

                            {lifecycle.displayState === 'LIVE' && (
                                <Link href={`/enterprise/events/${evId}/manage`} className="col-span-2">
                                    <Button size="sm" className="w-full flex items-center justify-center gap-1.5 text-[11px] h-9 bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200 font-bold text-white">
                                        <MessageSquare size={13} /> {t('enterprise.events.actions.manageEvent')}
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Main Page ---

export default function EnterpriseEventsPage() {
    const { t } = useTranslation();
    const VISIBLE_STATES = new Set(['approved', 'payment_done', 'live', 'closed']);
    const [events, setEvents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'in_progress' | 'upcoming' | 'ended' | 'mine'>('all');
    const searchParams = useSearchParams();
    const paymentSuccess = searchParams.get('payment_success') === 'true';
    const paymentCancelled = searchParams.get('payment_cancelled') === 'true';
    const eventEnded = searchParams.get('event_ended') === 'true';

    const fetchEvents = async () => {
        setIsLoading(true);
        try {
            const data = await http.get<any[]>('/enterprise/events');
            setEvents((Array.isArray(data) ? data : []).filter((ev) => VISIBLE_STATES.has(String(ev?.state || ''))));
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
            alert(err.message || t('enterprise.events.empty'));
        } finally {
            setActionLoading(null);
        }
    };

    const handlePay = async (eventId: string) => {
        setActionLoading(eventId + '_pay');
        try {
            const res = await http.post<any>(`/enterprise/events/${eventId}/pay`, {});
            if (res.payment_url) {
                window.location.href = res.payment_url;
                return;
            }
            await fetchEvents();
            setSelectedEvent(null);
        } catch (err: any) {
            alert(err.message || t('enterprise.events.notifications.paymentCancelled'));
        } finally {
            setActionLoading(null);
        }
    };

    const filtered = events.filter(ev => {
        if (search) {
            const q = search.toLowerCase();
            const matchText =
                ev.title?.toLowerCase().includes(q) ||
                ev.description?.toLowerCase().includes(q) ||
                ev.organizer_name?.toLowerCase().includes(q);
            if (!matchText) return false;
        }
        if (filterStatus !== 'all') {
            const { isLive, isEnded, isUpcoming, isBetweenSlots } = resolveEnterpriseEventTimeline(ev);
            const hasPart = Boolean(ev.participation);
            if (filterStatus === 'live' && !isLive) return false;
            if (filterStatus === 'in_progress' && !isBetweenSlots) return false;
            if (filterStatus === 'upcoming' && !isUpcoming) return false;
            if (filterStatus === 'ended' && !isEnded) return false;
            if (filterStatus === 'mine' && !hasPart) return false;
        }
        return true;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {paymentSuccess && (
                <div className="rounded-xl p-4 text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                    <p className="font-bold">{t('enterprise.events.notifications.paymentSuccess')}</p>
                    <p className="mt-1">{t('enterprise.events.notifications.paymentSuccessMessage')}</p>
                </div>
            )}
            {paymentCancelled && (
                <div className="rounded-xl p-4 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <p className="font-bold">{t('enterprise.events.notifications.paymentCancelled')}</p>
                    <p className="mt-1">{t('enterprise.events.notifications.paymentCancelledMessage')}</p>
                </div>
            )}
            {eventEnded && (
                <div className="rounded-xl p-4 text-sm font-medium bg-slate-100 text-slate-700 border border-slate-300">
                    <p className="font-bold">{t('enterprise.events.banner.liveSessionEndedTitle')}</p>
                    <p className="mt-1">{t('enterprise.events.banner.liveSessionEndedDescription')}</p>
                </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-zinc-500 text-sm">{t('enterprise.events.banner.browseDescription')}</p>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
                        className="pl-3 pr-8 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition text-zinc-700 cursor-pointer"
                    >
                        <option value="all">{t('enterprise.events.filters.all')}</option>
                        <option value="live">{t('enterprise.events.filters.live')}</option>
                        <option value="in_progress">{t('enterprise.events.filters.inProgress')}</option>
                        <option value="upcoming">{t('enterprise.events.filters.upcoming')}</option>
                        <option value="ended">{t('enterprise.events.filters.ended')}</option>
                        <option value="mine">{t('enterprise.events.filters.mine')}</option>
                    </select>
                    <input
                        type="text"
                        placeholder={t('enterprise.events.searchPlaceholder')}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full sm:w-56 pl-4 pr-4 py-2 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
                    />
                </div>
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
                            {events.length === 0 ? t('enterprise.events.empty') : t('enterprise.events.empty')}
                        </h3>
                    <p className="text-zinc-500">{events.length === 0 ? t('enterprise.events.empty') : t('enterprise.events.empty')}</p>
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
