export type ParticipantStatus = 'NOT_JOINED' | 'INVITED' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PENDING';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  organizer_id: string;
  organizer_name?: string;
  state: string;
  banner_url?: string;
  category?: string;
  start_date: string;
  end_date: string;
  location?: string;
  tags?: string[];
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

export interface Stand {
  id: string;
  event_id: string;
  organization_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  tags?: string[];
  stand_type?: string;
  created_at: string;
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
