import { http } from '@/lib/http';
import { Stand, StandUpdatePayload, StandsListResponse, StandResource } from '@/types/stand';

export const standsService = {
    /**
     * List all stands for an event.
     */
    async getEventStands(eventId: string, params?: {
        category?: string;
        search?: string;
        tags?: string;
        limit?: number;
        skip?: number;
    }): Promise<StandsListResponse> {
        const query = new URLSearchParams();
        if (params?.category) query.set('category', params.category);
        if (params?.search) query.set('search', params.search);
        if (params?.tags) query.set('tags', params.tags);
        if (params?.limit !== undefined) query.set('limit', String(params.limit));
        if (params?.skip !== undefined) query.set('skip', String(params.skip));
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/events/${eventId}/stands${qs}`);
    },

    /**
     * Get stand details by ID or Slug.
     */
    async getStand(eventId: string, standId: string): Promise<Stand> {
        return http.get(`/events/${eventId}/stands/${standId}`);
    },

    /**
     * Update stand details.
     */
    async updateStand(eventId: string, standId: string, data: StandUpdatePayload): Promise<Stand> {
        return http.patch(`/events/${eventId}/stands/${standId}`, data);
    },

    /**
     * Get all resources for a stand.
     */
    async getStandResources(standId: string): Promise<StandResource[]> {
        return http.get(`/resources/stand/${standId}`);
    },

    /**
     * Upload a resource for a stand.
     */
    async uploadStandResource(data: {
        stand_id: string;
        title: string;
        type: string;
        description?: string;
        file: File;
    }): Promise<StandResource> {
        const formData = new FormData();
        formData.append('stand_id', data.stand_id);
        formData.append('title', data.title);
        formData.append('type', data.type);
        if (data.description) formData.append('description', data.description);
        formData.append('file', data.file);

        return http.post('/resources/upload', formData);
    }
};
