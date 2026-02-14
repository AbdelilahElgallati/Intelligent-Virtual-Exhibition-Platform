export type EventStatus = 'draft' | 'pending_approval' | 'approved' | 'live' | 'closed';

export interface Event {
    id: string;
    title: string;
    description: string;
    banner_url?: string;
    start_date: string;
    end_date: string;
    state: EventStatus;
    organizer_id: string;
    organizer_name?: string;
    category?: string;
    location?: string;
    created_at: string;
    updated_at: string;
    tags?: string[];
}

export interface EventsResponse {
    events: Event[];
    total: number;
    page: number;
    size: number;
}
