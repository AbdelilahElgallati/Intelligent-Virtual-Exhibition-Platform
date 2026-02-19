export const ENDPOINTS = {
  USERS: {
    ME: '/users/me',
    PROFILE: '/users/profile',
  },
  ORGANIZER: {
    MY_EVENTS: '/events/organizer/my-events',
  },
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
  STANDS: {
    LIST: (eventId: string) => `/events/${eventId}/stands`,
    GET: (eventId: string, standId: string) => `/events/${eventId}/stands/${standId}`,
  },
  RESOURCES: {
    LIST: (standId: string) => `/resources/stand/${standId}`,
  },
  CHAT: {
    START: (standId: string) => `/chat/rooms/stand/${standId}`,
    HISTORY: (roomId: string) => `/chat/rooms/${roomId}/messages`,
  },
  MEETINGS: {
    REQUEST: '/meetings/',
  },
  TRANSCRIPTS: {
    UPLOAD: '/transcripts/transcribe-file',
  },
  FAVORITES: {
    LIST: '/favorites',
    ADD: '/favorites',
    DELETE: (id: string) => `/favorites/${id}`,
  },
};
