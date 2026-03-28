import React from 'react';
import { Event } from '@/lib/api/types';
import { EventCard } from './EventCard';

interface EventsGridProps {
    events: Event[];
    isLoading?: boolean;
    registeredEventIds?: Set<string>;
    favoriteMap?: Map<string, string>;
    favoriteAnimatingEventId?: string | null;
    onToggleFavorite?: (eventId: string) => void;
}

export const EventsGrid: React.FC<EventsGridProps> = ({
    events,
    isLoading,
    registeredEventIds,
    favoriteMap,
    favoriteAnimatingEventId,
    onToggleFavorite,
}) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-[400px] w-full animate-pulse rounded-xl bg-zinc-100"></div>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-zinc-900">No events found</h3>
                <p className="text-zinc-500">Try adjusting your filters or search query.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map((event, index) => {
                const key = event.id || (event as any)._id || `${event.title}-${index}`;
                const evAny = event as any;
                const favoriteLookupKey = String(evAny?.id || evAny?._id || event.slug || '');
                const favoriteId =
                    (favoriteLookupKey && favoriteMap?.get(favoriteLookupKey)) ||
                    (evAny?.id && favoriteMap?.get(String(evAny.id))) ||
                    (evAny?._id && favoriteMap?.get(String(evAny._id))) ||
                    (event.slug && favoriteMap?.get(String(event.slug))) ||
                    null;
                const regId = String(evAny?.id || evAny?._id || '');
                const isRegistered = !!regId && !!registeredEventIds?.has(regId);
                return (
                    <EventCard
                        key={key}
                        event={event}
                        isRegistered={isRegistered}
                        favoriteId={favoriteId}
                        favoriteAnimating={
                            !!favoriteAnimatingEventId &&
                            (favoriteAnimatingEventId === favoriteLookupKey ||
                                favoriteAnimatingEventId === String(evAny?.id || '') ||
                                favoriteAnimatingEventId === String(evAny?._id || '') ||
                                favoriteAnimatingEventId === String(event.slug || ''))
                        }
                        onToggleFavorite={onToggleFavorite}
                    />
                );
            })}
        </div>
    );
};
