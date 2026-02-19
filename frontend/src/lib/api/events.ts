import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { OrganizerEvent, EventCreatePayload, EventUpdatePayload } from '@/types/event';

export const eventsApi = {
    /** Get all events owned by the current organizer */
    getOrganizerEvents: async (): Promise<OrganizerEvent[]> => {
        const res = await apiClient.get<{ events: OrganizerEvent[]; total: number }>(
            ENDPOINTS.ORGANIZER.MY_EVENTS
        );
        return res.events ?? [];
    },

    /** Get a single event by ID */
    getEventById: (id: string) =>
        apiClient.get<OrganizerEvent>(ENDPOINTS.EVENTS.GET(id)),

    /** Create a new event (DRAFT state) */
    createEvent: (data: EventCreatePayload) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.LIST, data),

    /** Update event fields */
    updateEvent: (id: string, data: EventUpdatePayload) =>
        apiClient.patch<OrganizerEvent>(ENDPOINTS.EVENTS.GET(id), data),

    /** Delete a DRAFT event */
    deleteEvent: (id: string) =>
        apiClient.delete<void>(ENDPOINTS.EVENTS.DELETE(id)),

    /** Submit event for admin approval (DRAFT → PENDING_APPROVAL) */
    submitEvent: (id: string) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.SUBMIT(id)),

    /** Start a live event (APPROVED → LIVE) */
    startEvent: (id: string) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.START(id)),

    /** Close an ongoing event (LIVE → CLOSED) */
    closeEvent: (id: string) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.CLOSE(id)),
};
