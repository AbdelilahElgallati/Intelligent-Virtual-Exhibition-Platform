"use client";

import React, { useState, useEffect } from 'react';
import { Container } from '@/components/common/Container';
import { SectionTitle } from '@/components/common/SectionTitle';
import { EventsFilters } from '@/components/events/EventsFilters';
import { EventsGrid } from '@/components/events/EventsGrid';
import { eventsService } from '@/services/events.service';
import { Event } from '@/types/event';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { getEventLifecycle } from '@/lib/eventLifecycle';

type TimelineFilter = 'all' | 'live' | 'in_progress' | 'upcoming' | 'ended' | 'timeline_tbd';

export default function EventsPage() {
    const { isAuthenticated } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');

    useEffect(() => {
        async function fetchEvents() {
            setIsLoading(true);
            setError(null);
            try {
                const eventsPromise = eventsService.getEvents();
                const joinedPromise = isAuthenticated
                    ? apiClient.get<any>(ENDPOINTS.EVENTS.JOINED).catch(() => ({ items: [] }))
                    : Promise.resolve({ items: [] });

                const [eventsResponse, joinedResponse] = await Promise.all([eventsPromise, joinedPromise]);

                const allEvents = (eventsResponse as any).items || (eventsResponse as any).events || [];
                setEvents(allEvents);

                const joinedItems = (joinedResponse as any).items || (joinedResponse as any).events || [];
                const joinedSet = new Set<string>(
                    (joinedItems as any[])
                        .map((ev) => String(ev?.id || ev?._id || ''))
                        .filter((id) => id.length > 0)
                );
                setRegisteredEventIds(joinedSet);
            } catch (err) {
                console.error('Failed to fetch events', err);
                setError('Could not load events. Please try again later.');
                // For development/demo: if API fails, we could provide some mock data
                /*
                setEvents([
                  {
                    id: '1', title: 'Tech Expo 2026', description: 'The biggest tech exhibition in the world.', 
                    start_date: '2026-05-20', end_date: '2026-05-25', state: 'live', 
                    organizer_id: 'org1', category: 'technology', created_at: '', updated_at: ''
                  }
                ]);
                */
            } finally {
                setIsLoading(false);
            }
        }

        fetchEvents();
    }, [isAuthenticated]);

    const normalizedCategory = category.trim().toLowerCase();

    const filteredEvents = events.filter(event => {
        const title = event.title || '';
        const description = event.description || '';
        const eventCategory = (event.category || '').toLowerCase();

        const lifecycle = getEventLifecycle(event);
        const timelineStatus: TimelineFilter = !lifecycle.hasScheduleSlots
            ? 'timeline_tbd'
            : lifecycle.status === 'upcoming' && lifecycle.withinScheduleWindow
              ? 'in_progress'
              : lifecycle.status;

        const matchesSearch = title.toLowerCase().includes(search.toLowerCase()) ||
            description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !normalizedCategory || eventCategory === normalizedCategory;
        const matchesTimeline = timelineFilter === 'all' || timelineStatus === timelineFilter;
        return matchesSearch && matchesCategory && matchesTimeline;
    });

    const categories = Array.from(
        new Set(
            events
                .map((ev) => (ev.category || '').trim())
                .filter((cat) => cat.length > 0)
                .map((cat) => cat.toLowerCase())
        )
    );

    return (
        <div className="py-12 bg-zinc-50 min-h-screen">
            <Container>
                <SectionTitle
                    title="Events"
                    subtitle="Track upcoming, live, and ended exhibitions with timeline-aware access."
                    align="left"
                />

                <EventsFilters
                    onSearchChange={setSearch}
                    onCategoryChange={setCategory}
                    categories={categories}
                    selectedCategory={category}
                />

                <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mr-1">Timeline</span>
                    {([
                        { id: 'all', label: 'All' },
                        { id: 'live', label: 'Live' },
                        { id: 'in_progress', label: 'In Progress' },
                        { id: 'upcoming', label: 'Upcoming' },
                        { id: 'ended', label: 'Ended' },
                        { id: 'timeline_tbd', label: 'Timeline TBD' },
                    ] as Array<{ id: TimelineFilter; label: string }>).map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setTimelineFilter(item.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                timelineFilter === item.id
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-white text-zinc-600 border-zinc-300 hover:border-indigo-400 hover:text-indigo-600'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
                        {error}
                    </div>
                )}

                <EventsGrid
                    events={filteredEvents}
                    isLoading={isLoading}
                    registeredEventIds={isAuthenticated ? registeredEventIds : undefined}
                />
            </Container>
        </div>
    );
}
