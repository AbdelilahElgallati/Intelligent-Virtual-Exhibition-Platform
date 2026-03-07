import { http } from '@/lib/http';
import { Event, EventsResponse } from '@/types/event';

export const eventsService = {
    async getEvents(params: Record<string, any> = {}): Promise<EventsResponse> {
        const query = new URLSearchParams(params).toString();
        const endpoint = `/events${query ? `?${query}` : ''}`;
        return http.get<EventsResponse>(endpoint);
    },

    async getEventById(id: string): Promise<Event> {
        return http.get<Event>(`/events/${id}`);
    },
};
