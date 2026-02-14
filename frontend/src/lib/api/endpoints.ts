export const ENDPOINTS = {
  EVENTS: {
    LIST: '/events',
    GET: (id: string) => `/events/${id}`,
    JOINED: '/events/joined',
    MY_STATUS: (id: string) => `/events/${id}/my-status`,
    JOIN: (id: string) => `/events/${id}/join`,
  },
  RECOMMENDATIONS: {
    EVENTS: '/recommendations/events',
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
  },
};
