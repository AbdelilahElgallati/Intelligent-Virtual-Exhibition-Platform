export const ENDPOINTS = {
  USERS: {
    ME: '/users/me',
    PROFILE: '/users/me',
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
    APPROVE: (id: string) => `/events/${id}/approve`,
    REJECT: (id: string) => `/events/${id}/reject`,
    CONFIRM_PAYMENT: (id: string) => `/events/${id}/confirm-payment`,
    START: (id: string) => `/events/${id}/start`,
    CLOSE: (id: string) => `/events/${id}/close`,
    DELETE: (id: string) => `/events/${id}`,
    ANALYTICS: (id: string) => `/analytics/event/${id}`,
  },
  ADMIN: {
    PENDING_EVENTS: '/events?state=pending_approval',
    PAYMENTS: '/admin/payments',
    APPROVE_PAYMENT: (id: string) => `/admin/payments/${id}/approve`,
    REJECT_PAYMENT: (id: string) => `/admin/payments/${id}/reject`,
    VIEW_PAYMENT_PROOF: (id: string) => `/admin/payments/${id}/proof`,
  },
  PARTICIPANTS: {
    LIST: (eventId: string) => `/events/${eventId}/participants`,
    INVITE: (eventId: string) => `/events/${eventId}/participants/invite`,
    REQUEST: (eventId: string) => `/events/${eventId}/participants/request`,
    APPROVE: (eventId: string, participantId: string) => `/events/${eventId}/participants/${participantId}/approve`,
    REJECT: (eventId: string, participantId: string) => `/events/${eventId}/participants/${participantId}/reject`,
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
    CREATE: (eventId: string) => `/events/${eventId}/stands`,
  },
  ORGANIZATIONS: {
    LIST: '/organizations',
    CREATE: '/organizations/create',
    INVITE: '/organizations/invite',
  },
  RESOURCES: {
    LIST: (standId: string) => `/resources/stand/${standId}`,
    UPLOAD: '/resources/upload',
  },
  CHAT: {
    ROOMS: '/chat/rooms',
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
  PAYMENTS: {
    SUBMIT_PROOF: (eventId: string) => `/events/${eventId}/payment-proof`,
    MY_STATUS: (eventId: string) => `/events/${eventId}/my-payment-status`,
    UPDATE_DETAILS: (eventId: string) => `/events/${eventId}/payment-details`,
  },
};
