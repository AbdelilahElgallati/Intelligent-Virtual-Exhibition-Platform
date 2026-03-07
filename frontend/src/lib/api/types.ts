// Canonical type re-exports (single source of truth)
export type { User } from '@/types/user';
export type { OrganizerEvent, OrganizerEvent as Event } from '@/types/event';
export type { Stand, StandsListResponse } from '@/types/stand';

// Types not yet elevated to types/ — defined here

export type ParticipantStatus = 'NOT_JOINED' | 'INVITED' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PENDING' | 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING';

export type PaymentStatus = 'none' | 'pending' | 'paid' | 'failed';

export interface JoinEventResponse {
  requires_payment?: boolean;
  payment_status?: PaymentStatus;
  ticket_price?: number;
  // Standard participant response fields (for free events)
  id?: string;
  event_id?: string;
  user_id?: string;
  status?: string;
}

export interface EventPayment {
  id: string;
  _id: string;
  event_id: string;
  user_id: string;
  amount: number;
  status: PaymentStatus;
  stripe_session_id?: string;
  stripe_payment_intent?: string;
  currency?: string;
  paid_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'event' | 'stand' | 'resource';
  score: number;
  reason?: string;
}

export interface ParticipationStatus {
  status: ParticipantStatus;
  participant_id: string | null;
}

export interface Resource {
  id: string;
  title: string;
  description?: string;
  type: string;
  file_path: string;
  file_size: number;
  stand_id: string;
  downloads: number;
}
