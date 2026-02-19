// Canonical type re-exports (single source of truth)
export type { User } from '@/types/user';
export type { OrganizerEvent } from '@/types/event';
export type { Stand } from '@/types/stand';

// Types not yet elevated to types/ — defined here

export type ParticipantStatus = 'NOT_JOINED' | 'INVITED' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PENDING';

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
