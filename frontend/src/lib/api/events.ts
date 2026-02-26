import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { OrganizerEvent, EventCreatePayload, EventUpdatePayload, EventApprovePayload, EventRejectPayload } from '@/types/event';

export const eventsApi = {
    /** Get all events owned by the current organizer */
    getOrganizerEvents: async (): Promise<OrganizerEvent[]> => {
        const res = await apiClient.get<{ events: OrganizerEvent[]; total: number }>(
            ENDPOINTS.ORGANIZER.MY_EVENTS
        );
        return res.events ?? [];
    },

    /** Get all events (optionally filtered by state) */
    getAllEvents: async (params?: { state?: string; organizer_id?: string }): Promise<OrganizerEvent[]> => {
        const qs = params
            ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString()
            : '';
        const res = await apiClient.get<{ events: OrganizerEvent[]; total: number }>(
            `${ENDPOINTS.EVENTS.LIST}${qs}`
        );
        return res.events ?? [];
    },

    /** Get a single event by ID */
    getEventById: (id: string) =>
        apiClient.get<OrganizerEvent>(ENDPOINTS.EVENTS.GET(id)),

    /** Submit a new event request (PENDING_APPROVAL state) */
    createEvent: (data: EventCreatePayload) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.LIST, data),

    /** Update event fields (only while PENDING_APPROVAL) */
    updateEvent: (id: string, data: EventUpdatePayload) =>
        apiClient.patch<OrganizerEvent>(ENDPOINTS.EVENTS.GET(id), data),

    /** Delete a PENDING_APPROVAL or REJECTED event */
    deleteEvent: (id: string) =>
        apiClient.delete<void>(ENDPOINTS.EVENTS.DELETE(id)),

    // ── Admin actions ──────────────────────────────────────────────────────────

    /** Approve event request (PENDING_APPROVAL → WAITING_FOR_PAYMENT) */
    approveEvent: (id: string, data?: EventApprovePayload) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.APPROVE(id), data ?? {}),

    /** Reject event request (PENDING_APPROVAL → REJECTED) */
    rejectEvent: (id: string, data?: EventRejectPayload) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.REJECT(id), data ?? {}),

    // ── Organizer payment ──────────────────────────────────────────────────────

    /** Confirm payment (WAITING_FOR_PAYMENT → PAYMENT_DONE, generates links) */
    confirmPayment: (id: string) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.CONFIRM_PAYMENT(id)),

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    /** Start a live event (PAYMENT_DONE → LIVE) */
    startEvent: (id: string) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.START(id)),

    /** Close an ongoing event (LIVE → CLOSED) */
    closeEvent: (id: string) =>
        apiClient.post<OrganizerEvent>(ENDPOINTS.EVENTS.CLOSE(id)),

    /** Get analytics for an event */
    getEventAnalytics: (id: string) =>
        apiClient.get<any>(ENDPOINTS.EVENTS.ANALYTICS(id)),

    // ── Payment Details ────────────────────────────────────────────────────────

    /** Update organizer bank info for visitor payments (for paid events) */
    updatePaymentDetails: (id: string, details: {
        bank_name?: string;
        account_holder?: string;
        iban?: string;
        swift?: string;
        reference_note?: string;
    }) =>
        apiClient.patch<OrganizerEvent>(ENDPOINTS.PAYMENTS.UPDATE_DETAILS(id), details),
};
