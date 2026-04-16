'use client';

import React from 'react';
import { Event } from '@/lib/api/types';
import { EventCard } from './EventCard';
import { useTranslation } from 'react-i18next';

interface EventsGridProps {
    events: Event[];
    isLoading?: boolean;
    favoriteMap?: Map<string, string>;
    registeredEventIds?: Set<string>;
    favoriteAnimatingEventId?: string | null;
    onToggleFavorite?: (eventId: string, currentFavoriteId: string | null) => Promise<void>;
}

export const EventsGrid: React.FC<EventsGridProps> = ({
    events,
    favoriteMap,
    registeredEventIds,
    favoriteAnimatingEventId,
    onToggleFavorite,
}) => {
    const { t } = useTranslation();
    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-4xl mb-4">📅</div>
                <h3 className="text-lg font-bold text-zinc-900">{t('visitor.eventsGrid.noEvents')}</h3>
                <p className="text-zinc-500">{t('visitor.eventsGrid.checkBackLater')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((event, index) => {
                const key = event.id || (event as any)._id || `${event.title}-${index}`;
                return (
                    <EventCard
                        key={key}
                        event={event}
                    />
                );
            })}
        </div>
    );
};
