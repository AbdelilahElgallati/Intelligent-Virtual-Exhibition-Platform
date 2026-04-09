import { http } from '@/lib/http';
import { ChatRoom, ChatMessage } from '@/types/chat';

export const chatService = {
    /**
     * Get chat rooms for the current user.
     */
    async getChatRooms(params?: {
        event_id?: string;
        room_category?: 'visitor' | 'b2b';
    }): Promise<ChatRoom[]> {
        const query = new URLSearchParams();
        if (params?.event_id) query.set('event_id', params.event_id);
        if (params?.room_category) query.set('room_category', params.room_category);
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/chat/rooms${qs}`);
    },

    /**
     * Get message history for a chat room.
     */
    async getChatMessages(roomId: string, params?: {
        limit?: number;
        skip?: number;
    }): Promise<ChatMessage[]> {
        const query = new URLSearchParams();
        if (params?.limit !== undefined) query.set('limit', String(params.limit));
        if (params?.skip !== undefined) query.set('skip', String(params.skip));
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/chat/rooms/${roomId}/messages${qs}`);
    },

    /**
     * Initiate a chat with a stand.
     */
    async initiateStandChat(standId: string): Promise<ChatRoom> {
        return http.post(`/chat/rooms/stand/${standId}`, {});
    },

    /**
     * Initiate a B2B chat with another organization.
     */
    async initiateB2BChat(partnerOrgId: string, eventId: string): Promise<ChatRoom> {
        return http.post(`/chat/rooms/b2b/${partnerOrgId}`, { event_id: eventId });
    }
};
