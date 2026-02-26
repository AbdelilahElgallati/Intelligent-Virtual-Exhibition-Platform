'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Event } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Container } from '@/components/common/Container';
import { LoadingState } from '@/components/ui/LoadingState';
import { Calendar, MapPin, User } from 'lucide-react';
import clsx from 'clsx';

interface EventLiveLayoutProps {
    eventId: string;
    children: React.ReactNode;
}

export function EventLiveLayout({ eventId, children }: EventLiveLayoutProps) {
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const data = await apiClient.get<Event>(ENDPOINTS.EVENTS.GET(eventId));
                setEvent(data);

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

    if (loading) return <LoadingState message="Loading event..." />;
    if (!event) return <div className="text-center py-20 text-gray-500">Event not found</div>;

    const tabs = [
        { name: 'Recommended', id: 'overview', href: `/events/${eventId}/live` },
        { name: 'All Stands', id: 'stands', href: `/events/${eventId}/live?tab=stands` },
        { name: 'Schedule', id: 'schedule', href: '#' }, // Placeholder
        { name: 'Networking', id: 'networking', href: '#' }, // Placeholder
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Event Header */}
            <div className="bg-white border-b border-gray-200">
                {/* Banner */}
                <div className="h-48 md:h-64 w-full bg-gradient-to-r from-indigo-900 to-purple-800 relative overflow-hidden">
                    {event.banner_url ? (
                        <img
                            src={event.banner_url}
                            alt={event.title}
                            className="w-full h-full object-cover opacity-80"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white opacity-20 text-6xl font-bold">
                            {event.title.charAt(0)}
                        </div>
                    )}
                    <div className="absolute bottom-4 left-0 right-0">
                        <Container>
                            <div className="flex items-center space-x-2">
                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 uppercase tracking-wide">
                                    Live Now
                                </span>
                            </div>
                        </Container>
                    </div>
                </div>

                <Container className="py-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
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

                    {/* Navigation Tabs */}
                    <div className="mt-8 border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
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
                                            'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                                        )}
                                        aria-current={isActive ? 'page' : undefined}
                                    >
                                        {tab.name}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </Container>
            </div>

            {/* Content Area */}
            <div className="flex-1 py-8">
                <Container>
                    {children}
                </Container>
            </div>
        </div>
    );
}
