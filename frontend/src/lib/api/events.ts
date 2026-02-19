import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { OrganizerEvent, EventCreatePayload, EventUpdatePayload } from '@/types/event';

export const eventsApi = {
    getOrganizerEvents: () =>
        apiClient.get<OrganizerEvent[]>(ENDPOINTS.ORGANIZER.MY_EVENTS),

    getEventById: (id: string) =>
        apiClient.get<OrganizerEvent>(ENDPOINTS.EVENTS.GET(id)),

    createEvent: (data: EventCreatePayload) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.LIST, data),

    updateEvent: (id: string, data: EventUpdatePayload) =>
        apiClient.patch<OrganizerEvent>(ENDPOINTS.EVENTS.GET(id), data),
};
