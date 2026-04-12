export interface ChatMessage {
    id: string;
    room_id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    type: 'text' | 'image' | 'file';
    timestamp: string;
}

export interface ChatRoom {
    id: string;
    _id?: string;
    name: string;
    room_category: 'visitor' | 'b2b';
    event_id?: string;
    stand_id?: string;
    members: string[];
    created_at: string;
    last_message?: ChatMessage;
    last_read_by?: Record<string, string>;
}

export interface MessageCreatePayload {
    content: string;
    type?: 'text' | 'image' | 'file';
}
