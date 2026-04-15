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
    UPLOAD_BANNER: '/events/uploads/banner',
    GET: (id: string) => `/events/${id}`,
    JOINED: '/events/joined',
    MY_STATUS: (id: string) => `/events/${id}/my-status`,
    JOIN: (id: string) => `/events/${id}/join`,
    ACCEPT_VISITOR_INVITE: (id: string, token?: string) => token
      ? `/events/${id}/accept-visitor-invite?token=${encodeURIComponent(token)}`
      : `/events/${id}/accept-visitor-invite`,
    APPROVE: (id: string) => `/events/${id}/approve`,
    REJECT: (id: string) => `/events/${id}/reject`,
    CONFIRM_PAYMENT: (id: string) => `/events/${id}/confirm-payment`,
    START: (id: string) => `/events/${id}/start`,
    CLOSE: (id: string) => `/events/${id}/close`,
    SUBMIT_PAYMENT_PROOF: (id: string, proofUrl: string) =>
      `/events/${id}/submit-proof?proof_url=${encodeURIComponent(proofUrl)}`,
    UPLOAD_PAYMENT_PROOF: (id: string) => `/events/${id}/upload-payment-proof`,
    DELETE: (id: string) => `/events/${id}`,
    ANALYTICS: (id: string) => `/metrics/event/${id}`,
  },
  ADMIN: {
    PENDING_EVENTS: '/events?state=pending_approval',
    EVENT_PAYMENTS: '/admin/event-payments',
    FINANCE_TRANSACTIONS: '/admin/finance/transactions',
    FINANCE_PAYOUTS: '/admin/finance/payouts',
    MARK_FINANCE_PAYOUT: (transactionId: string) => `/admin/finance/payouts/${transactionId}`,
    UPDATE_FINANCE_PAYOUT: (payoutId: string) => `/admin/finance/payouts/${payoutId}`,
    DELETE_FINANCE_PAYOUT: (payoutId: string) => `/admin/finance/payouts/${payoutId}`,
  },
  PARTICIPANTS: {
    LIST: (eventId: string) => `/participants/event/${eventId}/`,
    INVITE: (eventId: string) => `/participants/event/${eventId}/invite`,
    REQUEST: (eventId: string) => `/participants/event/${eventId}/request`,
    APPROVE: (eventId: string, participantId: string) => `/participants/event/${eventId}/${participantId}/approve`,
    REJECT: (eventId: string, participantId: string) => `/participants/event/${eventId}/${participantId}/reject`,
    ATTENDEES: (eventId: string) => `/participants/event/${eventId}/attendees`,
    ENTERPRISES: (eventId: string) => `/participants/event/${eventId}/enterprises`,
  },
  RECOMMENDATIONS: {
    EVENTS: '/recommendations/events',
  },
  MARKETPLACE: {
    PRODUCTS: (standId: string) => `/marketplace/stands/${standId}/products`,
    STAND_ORDERS: (standId: string) => `/marketplace/stands/${standId}/orders`,
    ENTERPRISE_ORDERS: '/marketplace/enterprise/orders',
    CART_CHECKOUT: (standId: string) => `/marketplace/stands/${standId}/cart/checkout`,
    UPDATE_ORDER_FULFILLMENT: (orderId: string) => `/marketplace/orders/${orderId}/fulfillment-status`,
    CANCEL_ORDER: (orderId: string) => `/marketplace/orders/${orderId}/cancel`,
    MY_ORDERS: '/marketplace/orders',
    UNIFIED_ORDERS: '/marketplace/orders/unified',
    UNIFIED_ORDERS_BY_SESSION: (sessionId: string) => `/marketplace/orders/unified?session_id=${encodeURIComponent(sessionId)}`,
    UNIFIED_ORDERS_BY_GROUP: (groupId: string) => `/marketplace/orders/unified?group_id=${encodeURIComponent(groupId)}`,
    ORDERS_BY_SESSION: (sessionId: string) => `/marketplace/orders/by-session?session_id=${sessionId}`,
    ORDER_RECEIPT: (orderId: string) => `/marketplace/orders/${orderId}/receipt`,
    PRODUCT: (productId: string) => `/marketplace/products/${productId}`,
    CHECKOUT: (standId: string, productId: string) =>
      `/marketplace/stands/${standId}/products/${productId}/checkout`,
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
    GET: (id: string) => `/organizations/${id}`,
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
    READ: (roomId: string) => `/chat/rooms/${roomId}/read`,
  },
  MEETINGS: {
    REQUEST: '/meetings',
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
    CHECKOUT: (eventId: string) => `/events/${eventId}/checkout`,
    VERIFY: (eventId: string) => `/events/${eventId}/verify-payment`,
    MY_STATUS: (eventId: string) => `/events/${eventId}/my-payment-status`,
    RECEIPT: (eventId: string) => `/events/${eventId}/my-receipt`,
  },
  ENTERPRISE: {
    ACCEPT_INVITE: (eventId: string, token?: string) => token
      ? `/enterprise/events/${eventId}/accept-invite?token=${encodeURIComponent(token)}`
      : `/enterprise/events/${eventId}/accept-invite`,
  }

};