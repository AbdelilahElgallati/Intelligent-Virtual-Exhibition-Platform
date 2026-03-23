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

interface EventLiveLayoutProps {
    eventId: string;
    children: React.ReactNode | ((event: Event | null) => React.ReactNode);
}

export function EventLiveLayout({ eventId, children }: EventLiveLayoutProps) {
    const router = useRouter();
    const [event, setEvent] = useState<Event | null>(null);
    const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('NOT_JOINED');
    const [loading, setLoading] = useState(true);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const [eventData, statusData] = await Promise.all([
                    apiClient.get<Event>(ENDPOINTS.EVENTS.GET(eventId)),
                    apiClient.get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(eventId)).catch(() => ({ status: 'NOT_JOINED' as ParticipantStatus })),
                ]);

                setEvent(eventData);
                setParticipantStatus(statusData.status || 'NOT_JOINED');

                // Silently log view analytics
                try {
                    await apiClient.post('/analytics/log', {
                        type: 'event_view',
                        event_id: eventId,
                    });
                } catch (e) {
                    // ignore analytics error
                }
            } catch (error) {
                console.error('Failed to fetch event', error);
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [eventId]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    const lifecycle = event ? getEventLifecycle(event, new Date(timelineNow)) : null;

    // Keep hook order stable across renders; guard internally when data is unavailable.
    useEffect(() => {
        if (!event || !lifecycle || lifecycle.status !== 'ended') return;
        const timer = window.setTimeout(() => {
            router.replace(`/events/${eventId}?event_ended=true`);
        }, 2500);
        return () => window.clearTimeout(timer);
    }, [event, eventId, lifecycle, router]);

    if (loading) return <LoadingState message="Loading event..." />;
    if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

    const isBetweenSlots = lifecycle.hasScheduleSlots && lifecycle.status === 'upcoming' && lifecycle.withinScheduleWindow;
    const isApproved = participantStatus === 'APPROVED' || participantStatus === 'GUEST_APPROVED';
        const canAccessLive = isApproved && lifecycle.hasScheduleSlots && lifecycle.status === 'live';

    const statusPillClass =
                !lifecycle.hasScheduleSlots
                        ? 'bg-amber-100 text-amber-800'
                        : isBetweenSlots
                        ? 'bg-blue-100 text-blue-800'
                        : lifecycle.status === 'live'
            ? 'bg-green-100 text-green-800'
            : lifecycle.status === 'upcoming'
              ? 'bg-cyan-100 text-cyan-800'
              : 'bg-slate-200 text-slate-700';
        const statusPillText = !lifecycle.hasScheduleSlots
                ? 'Timeline pending'
                : isBetweenSlots
                    ? 'In progress'
                : lifecycle.status === 'live'
                    ? 'Live now'
                    : lifecycle.status === 'upcoming'
                        ? 'Upcoming'
                        : 'Ended';

    const tabs = [
        { name: 'Recommended', id: 'overview', href: `/events/${eventId}/live` },
        { name: 'All Stands', id: 'stands', href: `/events/${eventId}/live?tab=stands` },
        { name: 'Schedule', id: 'schedule', href: `/events/${eventId}/live?tab=schedule` },
        { name: '🎙️ Conferences', id: 'conferences', href: `/events/${eventId}/live?tab=conferences` },
        { name: 'Networking', id: 'networking', href: `/events/${eventId}/live?tab=networking` },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Event Header */}
            <div className="bg-white border-b border-gray-200">
                {/* Banner */}
                <div className="h-36 sm:h-48 md:h-64 w-full bg-gradient-to-r from-indigo-900 to-purple-800 relative overflow-hidden">
                    {event.banner_url ? (
                        <img
                            src={resolveMediaUrl(event.banner_url)}
                            alt={event.title}
                            className="w-full h-full object-cover opacity-80"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white opacity-20 text-6xl font-bold">
                            {event.title.charAt(0)}
                        </div>
                    )}
                    <div className="absolute bottom-3 sm:bottom-4 left-0 right-0">
                        <Container>
                            <div className="flex items-center space-x-2">
                                <span className={clsx('px-2 py-1 rounded text-xs font-medium uppercase tracking-wide', statusPillClass)}>
                                    {statusPillText}
                                </span>
                            </div>
                        </Container>
                    </div>
                </div>

                <Container className="py-4 sm:py-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{event.title}</h1>
                            <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    <span>{event.organizer_name || 'Organizer'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    <span>{new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(event.start_date))}</span>
                                </div>
                                {event.location && (
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        <span>{event.location}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {/* Future actions: Share, Add to Calendar */}
                        </div>
                    </div>

                    {canAccessLive && (
                        <div className="mt-4 sm:mt-8 border-b border-gray-200 -mx-4 sm:mx-0 px-4 sm:px-0">
                            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide">
                                {tabs.map((tab) => {
                                    const isActive = currentTab === tab.id;
                                    return (
                                        <Link
                                            key={tab.name}
                                            href={tab.href}
                                            className={clsx(
                                                isActive
                                                    ? 'border-indigo-500 text-indigo-600'
                                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                                                'whitespace-nowrap border-b-2 py-3 sm:py-4 px-1 text-xs sm:text-sm font-medium transition-colors'
                                            )}
                                            aria-current={isActive ? 'page' : undefined}
                                        >
                                            {tab.name}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    )}
                </Container>
            </div>

            {/* Content Area */}
            <div className="flex-1 py-4 sm:py-8">
                <Container>
                    {!isApproved ? (
                        <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                            <h3 className="text-xl font-semibold text-amber-900">Registration Required</h3>
                            <p className="mt-2 text-amber-800">
                                You need approved participation before entering the live event experience.
                            </p>
                            <Link
                                href={`/events/${eventId}`}
                                className="inline-flex mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
                            >
                                Go to Event Registration
                            </Link>
                        </div>
                    ) : !lifecycle.hasScheduleSlots ? (
                        <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                            <h3 className="text-xl font-semibold text-amber-900">Timeline Not Published Yet</h3>
                            <p className="mt-2 text-amber-800">
                                Live access is enabled only from schedule slots. The organizer has not published slots yet.
                            </p>
                            <Link
                                href={`/events/${eventId}`}
                                className="inline-flex mt-4 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition-colors"
                            >
                                Back to Event Details
                            </Link>
                        </div>
                    ) : lifecycle.status === 'upcoming' ? (
                        <div className="max-w-2xl mx-auto rounded-2xl border border-cyan-200 bg-cyan-50 p-6 text-center">
                            <h3 className={`text-xl font-semibold ${isBetweenSlots ? 'text-blue-900' : 'text-cyan-900'}`}>
                                {isBetweenSlots ? 'Event In Progress' : 'Event Not Live Yet'}
                            </h3>
                            <p className="mt-2 text-cyan-800">
                                {isBetweenSlots
                                    ? 'The event has started, but there is no active live slot right now.'
                                    : 'Live access opens when the next scheduled slot starts.'}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-cyan-900">
                                {isBetweenSlots
                                    ? `Next slot ${formatTimeToStart(lifecycle.nextSlotStart || null).replace('Starts in ', 'in ')}`
                                    : formatTimeToStart(lifecycle.nextSlotStart || null)}
                            </p>
                            <Link
                                href={`/events/${eventId}?tab=schedule`}
                                className="inline-flex mt-4 px-4 py-2 rounded-lg bg-cyan-700 text-white text-sm font-semibold hover:bg-cyan-800 transition-colors"
                            >
                                View Event Schedule
                            </Link>
                        </div>
                    ) : lifecycle.status === 'ended' ? (
                        <div className="max-w-2xl mx-auto rounded-2xl border border-slate-300 bg-slate-100 p-6 text-center">
                            <h3 className="text-xl font-semibold text-slate-900">Event Timeline Ended</h3>
                            <p className="mt-2 text-slate-700">
                                This event has ended, so live visitor access is now closed.
                            </p>
                            <p className="mt-2 text-sm font-medium text-slate-600">
                                Redirecting you back to event details...
                            </p>
                            <Link
                                href={`/events/${eventId}`}
                                className="inline-flex mt-4 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                            >
                                Back to Event Details
                            </Link>
                        </div>
                    ) : (
                        <>{typeof children === 'function' ? children(event) : children}</>
                    )}
                </Container>
            </div>
        </div>
    );
}
