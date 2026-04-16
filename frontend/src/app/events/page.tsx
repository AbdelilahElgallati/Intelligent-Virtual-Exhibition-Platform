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
import { getEventLifecycle, EventDisplayState } from '@/lib/eventLifecycle';
import { favoritesService } from '@/services/favorites.service';
import { useTranslation } from 'react-i18next';

type TimelineFilter = 'all' | 'LIVE' | 'IN_PROGRESS' | 'UPCOMING' | 'ENDED' | 'timeline_tbd';
const PUBLIC_VISIBLE_STATES = new Set(['approved', 'payment_done', 'live', 'closed']);

export default function EventsPage() {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(new Set());
    const [favoriteMap, setFavoriteMap] = useState<Map<string, string>>(new Map());
    const [favoriteAnimatingEventId, setFavoriteAnimatingEventId] = useState<string | null>(null);
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
                const favoritesPromise = isAuthenticated
                    ? favoritesService.list().catch(() => [])
                    : Promise.resolve([]);

                const [eventsResponse, joinedResponse, favoritesResponse] = await Promise.all([
                    eventsPromise, joinedPromise, favoritesPromise,
                ]);

                const allEvents = (eventsResponse as any).items || (eventsResponse as any).events || [];
                const visibleEvents = (allEvents as Event[]).filter((ev) => PUBLIC_VISIBLE_STATES.has(String((ev as any).state || '')));
                setEvents(visibleEvents);

                const joinedItems = (joinedResponse as any).items || (joinedResponse as any).events || [];
                const joinedSet = new Set<string>((joinedItems as any[]).map((ev) => String(ev?.id || ev?._id || '')).filter((id) => id.length > 0));
                setRegisteredEventIds(joinedSet);

                if (Array.isArray(favoritesResponse)) {
                    const nextMap = new Map<string, string>();
                    favoritesResponse.filter(f => f?.target_type === 'event' && f?.target_id).forEach(fav => {
                        const fid = String(fav?.id || fav?._id || '');
                        const tid = String(fav.target_id);
                        nextMap.set(tid, fid);
                        visibleEvents.forEach(ev => {
                            if ([ (ev as any)?.id, (ev as any)?._id, ev.slug ].filter(Boolean).map(String).includes(tid)) {
                                [ (ev as any)?.id, (ev as any)?._id, ev.slug ].filter(Boolean).forEach(a => nextMap.set(String(a), fid));
                            }
                        });
                    });
                    setFavoriteMap(nextMap);
                }
            } catch (err) { setError(t('events.listing.errorLoad')); } finally { setIsLoading(false); }
        }
        fetchEvents();
    }, [isAuthenticated]);

    const handleToggleFavorite = async (eventId: string) => {
        if (!eventId || !isAuthenticated) return;
        const prev = favoriteMap.get(eventId);
        try {
            setFavoriteAnimatingEventId(eventId);
            if (prev) {
                setFavoriteMap(m => { const nm = new Map(m); nm.delete(eventId); return nm; });
                await favoritesService.remove(prev);
            } else {
                const created = await favoritesService.add('event', eventId);
                const fid = String((created as any)?.id || (created as any)?._id || '');
                if (fid) setFavoriteMap(m => { const nm = new Map(m); nm.set(eventId, fid); return nm; });
            }
        } catch { if (prev) setFavoriteMap(m => { const nm = new Map(m); nm.set(eventId, prev); return nm; }); }
        finally { window.setTimeout(() => setFavoriteAnimatingEventId(null), 250); }
    };

    const filteredEvents = events.filter(event => {
        const lifecycle = getEventLifecycle(event);
        const timelineStatus: TimelineFilter = !lifecycle.hasScheduleSlots ? 'timeline_tbd' : lifecycle.displayState as TimelineFilter;
        const matchesSearch = (event.title || '').toLowerCase().includes(search.toLowerCase()) || (event.description || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !category || (event.category || '').toLowerCase() === category.toLowerCase();
        const matchesTimeline = timelineFilter === 'all' || timelineStatus === timelineFilter;
        return matchesSearch && matchesCategory && matchesTimeline;
    });

    const categories = Array.from(new Set(events.map(ev => (ev.category || '').trim().toLowerCase()).filter(Boolean)));

    return (
        <div className="py-12 bg-zinc-50 min-h-screen">
            <Container>
                <SectionTitle title={t('events.listing.title')} subtitle={t('events.listing.subtitle')} align="left" />
                <EventsFilters onSearchChange={setSearch} onCategoryChange={setCategory} categories={categories} selectedCategory={category} />
                <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mr-1">{t('events.listing.timelineLabel')}</span>
                    {([ { id: 'all', label: t('events.listing.timelineFilters.all') }, { id: 'LIVE', label: t('events.listing.timelineFilters.live') }, { id: 'IN_PROGRESS', label: t('events.listing.timelineFilters.inProgress') }, { id: 'UPCOMING', label: t('events.listing.timelineFilters.upcoming') }, { id: 'ENDED', label: t('events.listing.timelineFilters.ended') }, { id: 'timeline_tbd', label: t('events.listing.timelineFilters.timelineTbd') } ] as Array<{ id: TimelineFilter; label: string }>).map((item) => (
                        <button key={item.id} onClick={() => setTimelineFilter(item.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${timelineFilter === item.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-300 hover:border-indigo-400 hover:text-indigo-600'}`}>{item.label}</button>
                    ))}
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">{error}</div>}
                <EventsGrid events={filteredEvents} isLoading={isLoading} registeredEventIds={isAuthenticated ? registeredEventIds : undefined} favoriteMap={favoriteMap} favoriteAnimatingEventId={favoriteAnimatingEventId} onToggleFavorite={handleToggleFavorite} />
            </Container>
        </div>
    );
}
