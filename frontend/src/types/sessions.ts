export type SessionStatus = 'scheduled' | 'live' | 'ended';

export interface Session {
    id: string;
    event_id: string;
    title: string;
    speaker: string;
    description?: string | null;
    start_time: string;   // ISO datetime
    end_time: string;     // ISO datetime
    status: SessionStatus;
    created_at: string;
    updated_at: string;
    started_at?: string | null;
    ended_at?: string | null;
}

export interface CreateSessionPayload {
    title: string;
    speaker: string;
    description?: string;
    start_time: string;   // ISO datetime
    end_time: string;     // ISO datetime
}
