export type EventStatus =
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'waiting_for_payment'
    | 'payment_done'
    | 'live'
    | 'closed';

// ── Structured schedule ───────────────────────────────────────────────────
export interface EventScheduleSlot {
    start_time: string;    // "HH:MM" e.g. "09:00"
    end_time: string;    // "HH:MM" e.g. "17:00"
    label: string;    // Activity description
}

export interface EventScheduleDay {
    day_number: number;       // 1, 2, 3 …
    date_label?: string;       // optional human label e.g. "Mon 3 Mar"
    slots: EventScheduleSlot[];
}

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
    event_timeline?: string;       // legacy free-text (kept for backward-compat)
    schedule_days?: EventScheduleDay[]; // new structured schedule
    extended_details?: string;
    additional_info?: string;
    // Pricing
    stand_price?: number;          // enterprise stand fee
    is_paid?: boolean;             // visitor ticket required?
    ticket_price?: number;         // visitor ticket price
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
    event_timeline: string;           // JSON-serialised EventScheduleDay[]
    schedule_days?: EventScheduleDay[]; // human-friendly copy
    extended_details: string;
    additional_info?: string;
    // Pricing
    stand_price: number;
    is_paid: boolean;
    ticket_price?: number;
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
    stand_price?: number;
    is_paid?: boolean;
    ticket_price?: number;
}

export interface EventApprovePayload {
    payment_amount?: number;
}

export interface EventRejectPayload {
    reason?: string;
}
