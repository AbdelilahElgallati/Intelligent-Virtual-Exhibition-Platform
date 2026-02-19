export type EventStatus = 'draft' | 'pending_approval' | 'approved' | 'live' | 'closed';

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
}

export interface EventCreatePayload {
    title: string;
    description?: string;
    category?: string;
    start_date?: string;   // ISO datetime string
    end_date?: string;     // ISO datetime string
    location?: string;
    banner_url?: string;
    tags?: string[];
    organizer_name?: string;
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
}
