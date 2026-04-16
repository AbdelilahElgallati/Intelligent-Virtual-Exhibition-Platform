'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock3, Timer, UserRound, Building2, Mic2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { Conference } from '@/types/conference';
import { Meeting } from '@/types/meeting';
import { useTranslation } from 'react-i18next';

import { formatInTZ, getUserTimezone, parseISOUTC } from '@/lib/timezone';
import { Event } from '@/types/event';

interface EventConferencesTabProps {
    eventId: string;
    event?: Event | null;
}

type EventWithAliases = Event & {
    _id?: string;
};

type CardStatus = 'live' | 'upcoming' | 'ended' | 'canceled' | 'pending';

interface MeetingCardModel {
    id: string;
    withWho: string;
    purpose: string;
    startTime: string;
    endTime: string;
    status: CardStatus;
    canJoin: boolean;
    route: string;
}

interface ConferenceCardModel {
    id: string;
    title: string;
    enterpriseHost: string;
    speakerName: string;
    startTime: string;
    endTime: string;
    status: CardStatus;
    canJoin: boolean;
    route: string;
}

function parseMs(iso: string): number {
    return parseISOUTC(iso).getTime();
}

function normalizeConferenceListPayload(payload: unknown): Conference[] {
    if (Array.isArray(payload)) {
        return payload as Conference[];
    }
    if (payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown }).items)) {
        return (payload as { items: Conference[] }).items;
    }
    return [];
}

function normalizeComparableId(value: unknown): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const objectIdMatch = trimmed.match(/^ObjectId\("([a-fA-F0-9]{24})"\)$/);
        return (objectIdMatch ? objectIdMatch[1] : trimmed).toLowerCase();
    }
    if (value && typeof value === 'object') {
        const asOid = (value as { $oid?: unknown }).$oid;
        if (typeof asOid === 'string') return asOid.trim().toLowerCase();

        const asId = (value as { id?: unknown }).id;
        if (typeof asId === 'string') return asId.trim().toLowerCase();
    }
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
}

function formatDateTime(iso: string, timeZone: string = 'UTC'): string {
    return formatInTZ(iso, timeZone, 'dd MMM HH:mm');
}

function formatDuration(startIso: string, endIso: string, t: (key: string, options?: Record<string, unknown>) => string): string {
    const start = parseMs(startIso);
    const end = parseMs(endIso);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return t('visitor.eventConferencesTab.na');

    const totalMin = Math.round((end - start) / 60000);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;

    if (hours > 0 && minutes > 0) return t('visitor.eventConferencesTab.durationHoursMinutes', { h: hours, m: minutes });
    if (hours > 0) return t('visitor.eventConferencesTab.durationHours', { h: hours });
    return t('visitor.eventConferencesTab.durationMinutes', { m: minutes });
}

function formatTimeLeft(startIso: string, nowMs: number, t: (key: string, options?: Record<string, unknown>) => string): string {
    const start = parseMs(startIso);
    const diff = start - nowMs;

    if (Number.isNaN(start)) return t('visitor.eventConferencesTab.invalidStartTime');
    if (diff <= 0) return t('visitor.eventConferencesTab.startingNow');

    const totalMin = Math.floor(diff / 60000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const minutes = totalMin % 60;

    if (days > 0) return t('visitor.eventConferencesTab.startsInDaysHours', { d: days, h: hours });
    if (hours > 0) return t('visitor.eventConferencesTab.startsInHoursMinutes', { h: hours, m: minutes });
    return t('visitor.eventConferencesTab.startsInMinutes', { m: minutes });
}

function statusStyle(status: CardStatus, t: (key: string) => string): { label: string; text: string; bg: string; border: string } {
    if (status === 'live') {
        return { label: t('visitor.conferencesTab.status.live'), text: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
    }
    if (status === 'upcoming') {
        return { label: t('visitor.conferencesTab.status.upcoming'), text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
    }
    if (status === 'pending') {
        return { label: t('visitor.eventConferencesTab.status.pending'), text: '#b45309', bg: '#fffbeb', border: '#fde68a' };
    }
    if (status === 'canceled') {
        return { label: t('visitor.eventConferencesTab.status.canceled'), text: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
    }
    return { label: t('visitor.conferencesTab.status.ended'), text: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
}

export default function EventConferencesTab({ eventId, event: initialEvent }: EventConferencesTabProps) {
    const { t } = useTranslation();
    const router = useRouter();

    const [event, setEvent] = useState<Event | null>(initialEvent || null);

    useEffect(() => {
        if (initialEvent) {
            setEvent(initialEvent);
        }
    }, [initialEvent]);
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState<number>(() => Date.now());

    const timeZone = getUserTimezone();

    useEffect(() => {
        const interval = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const getConferenceStatus = useCallback((c: Conference, now: number): CardStatus => {
        if (c.status === 'canceled') return 'canceled';

        const start = parseMs(c.start_time);
        const end = parseMs(c.end_time);
        if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming';

        if (now >= end) return 'ended';
        if (now >= start && now < end) return 'live';
        return 'upcoming';
    }, []);

    const getMeetingStatus = useCallback((m: Meeting, now: number): CardStatus => {
        if (m.status === 'pending') return 'pending';
        if (m.status === 'canceled' || m.status === 'rejected') return 'canceled';

        const start = parseMs(m.start_time);
        const end = parseMs(m.end_time);
        const isApproved = m.status === 'approved' || m.status === 'completed';

        if (!isApproved) return 'pending';
        if (Number.isNaN(start) || Number.isNaN(end)) return 'upcoming';
        if (now >= end) return 'ended';
        if (now >= start && now < end) return 'live';
        return 'upcoming';
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const evMerged = initialEvent || event;
            const canonicalEventId = String(
                (evMerged as EventWithAliases | null)?.id ||
                    (evMerged as EventWithAliases | null)?._id ||
                    eventId,
            );

            const [conferencesRes, meetingsRes, eventRes] = await Promise.allSettled([
                apiClient.get<unknown>(
                    `/conferences/?event_id=${encodeURIComponent(canonicalEventId)}`,
                ),
                apiClient.get<Meeting[]>('/meetings/my-meetings'),
                !(initialEvent || event)
                    ? apiClient.get<Event>(`/events/${eventId}`)
                    : Promise.resolve((initialEvent || event) as Event),
            ]);

            if (conferencesRes.status === 'fulfilled') {
                setConferences(normalizeConferenceListPayload(conferencesRes.value));
            } else {
                setConferences([]);
            }

            const resolvedEvent: EventWithAliases | null =
                eventRes.status === 'fulfilled'
                    ? (eventRes.value as EventWithAliases | null)
                    : ((initialEvent || event) as EventWithAliases | null);

            const eventAliasIds = new Set(
                [
                    eventId,
                    resolvedEvent?.id,
                    resolvedEvent?._id,
                ]
                    .map((value) => normalizeComparableId(value))
                    .filter((value) => value.length > 0)
            );

            if (meetingsRes.status === 'fulfilled') {
                const allMeetings = Array.isArray(meetingsRes.value) ? meetingsRes.value : [];
                // Deduplicate by meeting id, prefer 'sent' if current enterprise is sender
                const deduped: Record<string, Meeting> = {};
                const currentEnterpriseId = (typeof window !== 'undefined' && localStorage.getItem('enterprise_id')) || '';
                allMeetings.forEach((m) => {
                    const meetingEventId = normalizeComparableId(m.event_id);
                    if (!(meetingEventId.length > 0 && eventAliasIds.has(meetingEventId))) return;
                    const id = m.id || m._id;
                    if (!id) return;
                    // If current enterprise is sender, prefer this as 'sent'
                    if (!deduped[id] || (m.sender_enterprise_id === currentEnterpriseId)) {
                        deduped[id] = m;
                    }
                });
                setMeetings(Object.values(deduped));
            } else {
                setMeetings([]);
            }

            if (eventRes.status === 'fulfilled') {
                setEvent(eventRes.value);
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : t('visitor.eventConferencesTab.errors.loadFailed');
            setError(message);
            setConferences([]);
            setMeetings([]);
        } finally {
            setLoading(false);
        }
    }, [eventId, event, initialEvent]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, [load]);

    const meetingCards = useMemo<MeetingCardModel[]>(() => {
        return meetings
            .map((m) => {
                const status = getMeetingStatus(m, nowMs);
                const withWho =
                    m.requester_name ||
                    m.receiver_org_name ||
                    m.requester_org_name ||
                    t('visitor.eventConferencesTab.enterpriseRepresentative');
                const id = m.id || m._id;

                return {
                    id,
                    withWho,
                    purpose: m.purpose || t('visitor.eventConferencesTab.meetingSession'),
                    startTime: m.start_time,
                    endTime: m.end_time,
                    status,
                    canJoin: status === 'live',
                    route: `/meetings/${id}/room`,
                };
            })
            .sort((a, b) => parseMs(a.startTime) - parseMs(b.startTime));
    }, [meetings, getMeetingStatus, nowMs]);

    const conferenceCards = useMemo<ConferenceCardModel[]>(() => {
        return conferences
            .map((c) => {
                const status = getConferenceStatus(c, nowMs);
                const confId = String(c.id || c._id || '').trim();
                if (!confId) return null;
                return {
                    id: confId,
                    title: c.title || t('visitor.eventConferencesTab.conferenceSession'),
                    enterpriseHost: c.assigned_enterprise_name || t('visitor.eventConferencesTab.enterpriseHost'),
                    speakerName: c.speaker_name || t('visitor.eventConferencesTab.speakerNotSet'),
                    startTime: c.start_time,
                    endTime: c.end_time,
                    status,
                    canJoin: status === 'live',
                    route: `/events/${eventId}/live/conferences/${encodeURIComponent(confId)}/watch`,
                };
            })
            .filter((row): row is ConferenceCardModel => row !== null)
            .sort((a, b) => parseMs(a.startTime) - parseMs(b.startTime));
    }, [conferences, eventId, getConferenceStatus, nowMs]);

    const liveCount =
        meetingCards.filter((m) => m.status === 'live').length +
        conferenceCards.filter((c) => c.status === 'live').length;

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '0 0 6px 0' }}>
                    {t('visitor.eventConferencesTab.timelineTitle')}
                </h2>
                <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                    {t('visitor.eventConferencesTab.timelineSubtitle')}
                </p>

                {liveCount > 0 && (
                    <div
                        style={{
                            marginTop: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: 20,
                            padding: '6px 14px',
                        }}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                background: '#10b981',
                                borderRadius: '50%',
                                animation: 'pulse 2s infinite',
                                display: 'inline-block',
                            }}
                        />
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>
                            {t('visitor.eventConferencesTab.liveSessionsCount', { n: liveCount })}
                        </span>
                    </div>
                )}
            </div>

            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            border: '3px solid #e2e8f0',
                            borderTopColor: '#4f46e5',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }}
                    />
                </div>
            )}

            {!loading && error && (
                <div
                    style={{
                        marginBottom: 20,
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px solid rgba(239,68,68,0.25)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#b91c1c',
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    {error}
                </div>
            )}

            {!loading && (
                <div style={{ display: 'grid', gap: 26 }}>
                    <section>
                        <div style={{ marginBottom: 10 }}>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{t('visitor.eventConferencesTab.myMeetings')}</h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                                {t('visitor.eventConferencesTab.myMeetingsSubtitle')}
                            </p>
                        </div>

                        {meetingCards.length === 0 ? (
                            <EmptyState text={t('visitor.eventConferencesTab.noMeetings')} />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                                {meetingCards.map((m) => (
                                    <SessionCard
                                        key={`meeting-${m.id}`}
                                        title={m.purpose}
                                        details={[
                                            { icon: <UserRound size={14} />, label: `${t('visitor.eventConferencesTab.with')}: ${m.withWho}` },
                                            { icon: <CalendarDays size={14} />, label: `${t('visitor.eventConferencesTab.start')}: ${formatDateTime(m.startTime, timeZone)}` },
                                            { icon: <Clock3 size={14} />, label: `${t('visitor.eventConferencesTab.duration')}: ${formatDuration(m.startTime, m.endTime, t)}` },
                                            {
                                                icon: <Timer size={14} />,
                                                label:
                                                    m.status === 'upcoming'
                                                        ? formatTimeLeft(m.startTime, nowMs, t)
                                                        : m.status === 'live'
                                                          ? t('visitor.eventConferencesTab.inProgressNow')
                                                          : t('visitor.eventConferencesTab.timeWindowClosed'),
                                            },
                                        ]}
                                        status={m.status}
                                        buttonLabel={m.canJoin ? t('visitor.eventConferencesTab.joinMeeting') : m.status === 'ended' ? t('visitor.conferencesTab.actions.ended') : t('visitor.eventConferencesTab.wait')}
                                        buttonEnabled={m.canJoin}
                                        onButtonClick={() => router.push(m.route)}
                                        frozen={m.status === 'ended' || m.status === 'canceled'}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <div style={{ marginBottom: 10 }}>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{t('visitor.conferencesTab.title')}</h3>
                            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                                {t('visitor.eventConferencesTab.conferencesSubtitle')}
                            </p>
                        </div>

                        {conferenceCards.length === 0 ? (
                            <EmptyState text={t('visitor.eventConferencesTab.noConferences')} />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                                {conferenceCards.map((c) => (
                                    <SessionCard
                                        key={`conference-${c.id}`}
                                        title={c.title}
                                        details={[
                                            { icon: <Building2 size={14} />, label: `${t('visitor.eventConferencesTab.host')}: ${c.enterpriseHost}` },
                                            { icon: <Mic2 size={14} />, label: `${t('visitor.eventConferencesTab.speaker')}: ${c.speakerName}` },
                                            { icon: <CalendarDays size={14} />, label: `${t('visitor.eventConferencesTab.start')}: ${formatDateTime(c.startTime, timeZone)}` },
                                            { icon: <Clock3 size={14} />, label: `${t('visitor.eventConferencesTab.duration')}: ${formatDuration(c.startTime, c.endTime, t)}` },
                                            {
                                                icon: <Timer size={14} />,
                                                label:
                                                    c.status === 'upcoming'
                                                        ? formatTimeLeft(c.startTime, nowMs, t)
                                                        : c.status === 'live'
                                                          ? t('visitor.eventConferencesTab.conferenceIsLive')
                                                          : t('visitor.eventConferencesTab.timeWindowClosed'),
                                            },
                                        ]}
                                        status={c.status}
                                        buttonLabel={c.canJoin ? t('visitor.eventConferencesTab.joinConference') : c.status === 'ended' ? t('visitor.conferencesTab.actions.ended') : t('visitor.eventConferencesTab.wait')}
                                        buttonEnabled={c.canJoin}
                                        onButtonClick={() => router.push(c.route)}
                                        frozen={c.status === 'ended' || c.status === 'canceled'}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div
            style={{
                textAlign: 'center',
                padding: '24px 18px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px dashed #cbd5e1',
                color: '#64748b',
                fontSize: 13,
            }}
        >
            {text}
        </div>
    );
}

function SessionCard({
    title,
    details,
    status,
    buttonLabel,
    buttonEnabled,
    onButtonClick,
    frozen,
}: {
    title: string;
    details: Array<{ icon: React.ReactNode; label: string }>;
    status: CardStatus;
    buttonLabel: string;
    buttonEnabled: boolean;
    onButtonClick: () => void;
    frozen: boolean;
}) {
    const { t } = useTranslation();
    const style = statusStyle(status, t);

    return (
        <div
            style={{
                border: `1px solid ${style.border}`,
                background: '#fff',
                borderRadius: 14,
                padding: 14,
                opacity: frozen ? 0.72 : 1,
                filter: frozen ? 'grayscale(0.15)' : 'none',
                transition: 'opacity 0.2s ease',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start', marginBottom: 8 }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{title}</h4>
                <span
                    style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: style.text,
                        background: style.bg,
                        borderRadius: 999,
                        padding: '3px 8px',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {style.label}
                </span>
            </div>

            <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                {details.map((d, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            color: '#475569',
                            fontSize: 13,
                        }}
                    >
                        <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center' }}>{d.icon}</span>
                        <span>{d.label}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={onButtonClick}
                disabled={!buttonEnabled}
                style={{
                    width: '100%',
                    borderRadius: 10,
                    border: buttonEnabled ? 'none' : '1px solid #e2e8f0',
                    padding: '9px 10px',
                    background: buttonEnabled ? '#059669' : '#f8fafc',
                    color: buttonEnabled ? '#fff' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: buttonEnabled ? 'pointer' : 'not-allowed',
                }}
            >
                {buttonLabel}
            </button>
        </div>
    );
}
