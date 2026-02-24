// ── Admin-specific type definitions for IVEP ─────────────────────────

import { OrganizerEvent } from './event';
import { User } from './user';

// Re-export event type for admin use
export type { OrganizerEvent, User };

export interface AdminEventSummary extends OrganizerEvent {
    organizer_email?: string;
}

// ── Organization moderation ───────────────────────────────────────────

export interface AdminOrganization {
    _id: string;
    name: string;
    description?: string;
    owner_id: string;
    created_at: string;
    is_verified: boolean;
    is_flagged: boolean;
    is_suspended: boolean;
}

// ── Subscription management ───────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'pro';

export interface AdminSubscription {
    organization_id: string;
    organization_name?: string;
    plan: SubscriptionPlan;
    status?: 'active' | 'cancelled' | 'past_due';
}

// ── Shared admin pagination / list response ───────────────────────────

export interface AdminListResponse<T> {
    items: T[];
    total: number;
}
