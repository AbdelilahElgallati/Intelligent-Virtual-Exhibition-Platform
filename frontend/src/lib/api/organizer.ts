import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { OrganizerProfile } from '@/types/organizer';

export const organizerApi = {
    getProfile: () =>
        apiClient.get<OrganizerProfile>(ENDPOINTS.USERS.PROFILE),

    updateProfile: (data: Partial<OrganizerProfile>) =>
        apiClient.patch<OrganizerProfile>(ENDPOINTS.USERS.PROFILE, data),
};
