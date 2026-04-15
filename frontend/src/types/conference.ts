// TypeScript types for the conferences system

export type ConferenceStatus = 'scheduled' | 'live' | 'ended' | 'canceled';

export interface Conference {
    /** Public API serializes Mongo id as `id`. */
    id: string;
    /** Legacy / mirror when raw Mongo docs are used client-side. */
    _id?: string;
    title: string;
    description?: string;
    speaker_name?: string;
    assigned_enterprise_id: string;
    assigned_enterprise_name?: string;
    organizer_id: string;
    event_id?: string;
    stand_id?: string;
    start_time: string;
    end_time: string;
    status: ConferenceStatus;
    room_name?: string;  // was: livekit_room_name
    max_attendees: number;
    attendee_count: number;
    is_registered?: boolean;
    chat_enabled: boolean;
    qa_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface ConferenceTokenResponse {
    token: string;
    room_url: string;   // Daily.co room URL (https://<domain>/<room_name>)
    room_name: string;
    role: 'speaker' | 'audience';
}

export interface QAItem {
    _id: string;
    conference_id: string;
    user_id: string;
    user_name: string;
    question: string;
    is_answered: boolean;
    answer?: string;
    upvotes: number;
    created_at: string;
}
