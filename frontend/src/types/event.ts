export type EventStatus =
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'waiting_for_payment'
    | 'payment_done'
    | 'live'
    | 'closed';

export interface OrganizerEvent {
    id: string;
    title: string;
    description?: string;
    organizer_id: string;
    state: EventStatus;
    banner_url?: string;
    category?: string;
    start_date: string;
    end_date: string;
    location?: string;
    tags: string[];
    created_at: string;
    organizer_name?: string;
    // Request-specific fields
    num_enterprises?: number;
    event_timeline?: string;
    extended_details?: string;
    additional_info?: string;
    // Payment & links
    payment_amount?: number;
    enterprise_link?: string;
    visitor_link?: string;
    rejection_reason?: string;
}

export type Event = OrganizerEvent;

export interface EventCreatePayload {
    title: string;
    description?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    banner_url?: string;
    tags?: string[];
    organizer_name?: string;
    // Required request fields
    num_enterprises: number;
    event_timeline: string;
    extended_details: string;
    additional_info?: string;
}

export interface EventUpdatePayload {
    title?: string;
    description?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    banner_url?: string;
    tags?: string[];
    organizer_name?: string;
    num_enterprises?: number;
    event_timeline?: string;
    extended_details?: string;
    additional_info?: string;
}

export interface EventApprovePayload {
    payment_amount?: number;
}

export interface EventRejectPayload {
    reason?: string;
}
