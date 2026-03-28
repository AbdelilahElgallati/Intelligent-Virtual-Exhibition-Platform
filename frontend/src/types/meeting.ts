// TypeScript types for the video meeting system

export type MeetingType = 'one_to_one' | 'b2b';
export type SessionStatus = 'scheduled' | 'live' | 'ended';
export type MeetingStatus = 'pending' | 'approved' | 'rejected' | 'canceled' | 'completed';

export interface Meeting {
    _id: string;
    id?: string;
    event_id?: string;
    visitor_id: string;
    stand_id: string;
    start_time: string;
    end_time: string;
    purpose?: string;
    status: MeetingStatus;
    created_at: string;
    updated_at: string;

    // Enriched
    requester_name?: string;
    requester_role?: string;
    requester_org_name?: string;
    receiver_org_name?: string;

    // Video session (new)
    meeting_type: MeetingType;
    initiator_id?: string;
    session_status: SessionStatus;
    room_name?: string;  // was: livekit_room_name
}

export interface MeetingJoinResponse {
    token: string;
    room_url: string;   // Daily.co room URL (https://<domain>/<room_name>)
    room_name: string;
    starts_at?: string;
    ends_at?: string;
}
