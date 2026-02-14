"use client";

import React, { useState, useEffect } from 'react';
import { Container } from '@/components/common/Container';
import { SectionTitle } from '@/components/common/SectionTitle';
import { EventsFilters } from '@/components/events/EventsFilters';
import { EventsGrid } from '@/components/events/EventsGrid';
import { eventsService } from '@/services/events.service';
import { Event } from '@/types/event';

export default function EventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        async function fetchEvents() {
            setIsLoading(true);
            setError(null);
            try {
                const response = await eventsService.getEvents();
                // Assuming response structure correctly returns events array
                setEvents(response.events || []);
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
    }, []);

    const filteredEvents = events.filter(event => {
        const matchesSearch = event.title.toLowerCase().includes(search.toLowerCase()) ||
            event.description.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === '' || event.category === category;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="py-12 bg-zinc-50 min-h-screen">
            <Container>
                <SectionTitle
                    title="Upcoming Events"
                    subtitle="Discover immersive virtual exhibitions and connect with industry leaders."
                    align="left"
                />

                <EventsFilters
                    onSearchChange={setSearch}
                    onCategoryChange={setCategory}
                />

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-8">
                        {error}
                    </div>
                )}

                <EventsGrid events={filteredEvents} isLoading={isLoading} />
            </Container>
        </div>
    );
}
