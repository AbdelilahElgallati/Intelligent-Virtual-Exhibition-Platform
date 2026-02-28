/**
 * TypeScript types for enterprise join request management (Admin panel).
 */

export interface ParticipantItem {
    id: string;
    status: 'invited' | 'requested' | 'approved' | 'rejected';
    created_at: string;
    user_id: string;
    rejection_reason?: string | null;
}

export interface EnterpriseUserInfo {
    id: string;
    full_name?: string | null;
    email: string;
    is_active: boolean;
}

export interface EnterpriseOrgInfo {
    id: string;
    name: string;
    description?: string | null;
    industry?: string | null;
}

// Subscription plan feature disabled — not in use
// export interface EnterpriseSubscriptionInfo {
//     plan?: string | null;
// }

export interface EnterpriseHistoryInfo {
    total_approved: number;
    last_event_id?: string | null;
    last_event_date?: string | null;
}

export interface EnterpriseRequestItem {
    participant: ParticipantItem;
    user: EnterpriseUserInfo;
    organization?: EnterpriseOrgInfo | null;
    // subscription?: EnterpriseSubscriptionInfo | null;  // disabled
    history: EnterpriseHistoryInfo;
}

export interface EnterpriseRequestsResponse {
    items: EnterpriseRequestItem[];
    total: number;
    skip: number;
    limit: number;
}

export interface RejectBody {
    reason?: string;
}
