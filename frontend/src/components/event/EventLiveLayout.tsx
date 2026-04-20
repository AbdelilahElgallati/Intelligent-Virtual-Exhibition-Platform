'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Event, ParticipantStatus } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Container } from '@/components/common/Container';
import { LoadingState } from '@/components/ui/LoadingState';
import { Calendar, MapPin, User } from 'lucide-react';
import clsx from 'clsx';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { resolveMediaUrl } from '@/lib/media';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

interface EventLiveLayoutProps {
    eventId: string;
    children: React.ReactNode | ((event: Event | null) => React.ReactNode);
}

export function EventLiveLayout({ eventId, children }: EventLiveLayoutProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('NOT_JOINED');
    const [loading, setLoading] = useState(true);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    useEffect(() => {
        if (!eventId) {
            setLoading(false);
            return;
        }
        const fetchEvent = async () => {
            try {
                const [eventData, statusData] = await Promise.all([
                    apiClient.get<Event>(ENDPOINTS.EVENTS.GET(eventId)),
                    apiClient.get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(eventId)).catch(() => ({ status: 'NOT_JOINED' as ParticipantStatus })),
                ]);
                setEvent(eventData);
                setParticipantStatus(statusData.status || 'NOT_JOINED');
            } catch (error) {
                console.error('Failed to fetch event', error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [eventId]);

    useEffect(() => {
        const timer = window.setInterval(() => setTimelineNow(Date.now()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    const lifecycle = event ? getEventLifecycle(event, new Date(timelineNow)) : null;

    useEffect(() => {
        if (lifecycle?.displayState === 'ENDED') {
            const timer = window.setTimeout(() => router.replace(`/events/${eventId}?event_ended=true`), 2500);
            return () => window.clearTimeout(timer);
        }
    }, [eventId, lifecycle, router]);

    if (loading) return <LoadingState message={t('visitor.eventLiveLayout.loading')} />;
    if (!event || !lifecycle) return <div className="text-center py-20 text-gray-500">{t('visitor.eventLiveLayout.unavailable')}</div>;

    const isApproved = participantStatus === 'APPROVED' || participantStatus === 'GUEST_APPROVED';
    const canAccessLive = isApproved && lifecycle.accessState === 'OPEN_SLOT_ACTIVE';

    const statusPill = {
        LIVE: { class: 'bg-green-100 text-green-800', label: t('visitor.eventLiveLayout.liveNow') },
        IN_PROGRESS: { class: 'bg-blue-100 text-blue-800', label: t('visitor.eventLiveLayout.inProgress') },
        UPCOMING: { class: 'bg-cyan-100 text-cyan-800', label: t('visitor.eventLiveLayout.upcoming') },
        ENDED: { class: 'bg-slate-200 text-slate-700', label: t('visitor.eventLiveLayout.closed') },
    }[lifecycle.displayState];

    const tabs = [
        { name: t('visitor.liveEvent.tabs.recommended'), id: 'overview', href: `/events/${eventId}/live` },
        { name: t('visitor.liveEvent.tabs.allStands'), id: 'stands', href: `/events/${eventId}/live?tab=stands` },
        { name: t('visitor.liveEvent.tabs.schedule'), id: 'schedule', href: `/events/${eventId}/live?tab=schedule` },
        { name: t('visitor.liveEvent.tabs.conferences'), id: 'conferences', href: `/events/${eventId}/live?tab=conferences` },
        { name: t('visitor.liveEvent.tabs.networking'), id: 'networking', href: `/events/${eventId}/live?tab=networking` },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-white border-b border-gray-200">
                <div className="h-36 sm:h-48 md:h-64 w-full bg-gradient-to-r from-indigo-900 to-purple-800 relative overflow-hidden">
                    {event.banner_url ? <img src={resolveMediaUrl(event.banner_url)} alt={event.title} className="w-full h-full object-cover opacity-80" /> : <div className="absolute inset-0 flex items-center justify-center text-white opacity-20 text-6xl font-bold">{event.title.charAt(0)}</div>}
                    <div className="absolute bottom-3 sm:bottom-4 left-0 right-0">
                        <Container><span className={clsx('px-2 py-1 rounded text-xs font-medium uppercase tracking-wide', statusPill.class)}>{statusPill.label}</span></Container>
                    </div>
                </div>
                <Container className="py-4 sm:py-6">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{event.title}</h1>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1"><User size={16} /><span>{event.organizer_name}</span></div>
                        <div className="flex items-center gap-1"><Calendar size={16} /><span>{formatInTZ(event.start_date, getUserTimezone(), 'MMMM d, yyyy')}</span></div>
                    </div>
                    {canAccessLive && (
                        <div className="mt-4 sm:mt-8 border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8 overflow-x-auto">
                                {tabs.map((tab) => (
                                    <Link key={tab.id} href={tab.href} className={clsx(currentTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700', 'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors')}>
                                        {tab.name}
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    )}
                </Container>
            </div>
            <div className="flex-1 py-4 sm:py-8">
                <Container>
                    {!isApproved ? (
                        <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                            <h3 className="text-xl font-semibold text-amber-900">{t('visitor.eventLiveLayout.registrationRequired')}</h3>
                            <Link href={`/events/${eventId}`} className="inline-flex mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold">{t('visitor.eventLiveLayout.registerNow')}</Link>
                        </div>
                    ) : lifecycle.accessState === 'OPEN_SLOT_ACTIVE' ? (
                        <>{typeof children === 'function' ? children(event) : children}</>
                    ) : (
                        <div className="max-w-2xl mx-auto rounded-2xl border p-6 text-center bg-white">
                            <h3 className="text-xl font-semibold">
                                {lifecycle.displayState === 'IN_PROGRESS' ? t('visitor.standPage.accessState.inProgress') : 
                                 lifecycle.displayState === 'ENDED' ? t('visitor.standPage.accessState.ended') : t('visitor.standPage.accessState.notStarted')}
                            </h3>
                            <p className="mt-2 text-gray-600">
                                {lifecycle.accessState === 'CLOSED_BETWEEN_SLOTS' ? t('visitor.eventLiveLayout.accessNextSlot') : 
                                 lifecycle.accessState === 'CLOSED_AFTER_EVENT' ? t('visitor.eventLiveLayout.eventConcluded') : t('visitor.eventLiveLayout.accessOpens')}
                            </p>
                            {lifecycle.nextSlot && <p className="mt-3 font-bold text-indigo-600">{formatTimeToStart(lifecycle.nextSlot.start)}</p>}
                            <Link href={`/events/${eventId}`} className="inline-flex mt-4 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold">{t('visitor.eventLiveLayout.backToDetails')}</Link>
                        </div>
                    )}
                </Container>
            </div>
        </div>
    );
}
