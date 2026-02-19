import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { Notification } from './types';

export const notificationsApi = {
    getNotifications: () =>
        apiClient.get<Notification[]>(ENDPOINTS.NOTIFICATIONS.LIST),

    markAsRead: (id: string) =>
        apiClient.post(`${ENDPOINTS.NOTIFICATIONS.LIST}/${id}/read`),
};
