import { User } from './user';

export interface Organization {
    id: string;
    name: string;
    description?: string;
    owner_id: string;
    created_at: string;
}

export interface OrganizerProfile extends User {
    organization?: Organization;
}

export interface StatCard {
    label: string;
    value: string | number;
    change?: string;
    trend?: 'up' | 'down' | 'neutral';
}

// ─── Week 6: Organizer Value Dashboard ────────────────────────────────────────

export interface RevenueSummary {
    ticket_revenue: number;
    stand_revenue: number;
    total_revenue: number;
}

export interface OverviewMetrics {
    total_visitors: number;
    enterprise_participation_rate: number;
    stand_engagement_score: number;
    leads_generated: number;
    meetings_booked: number;
    chat_interactions: number;
    revenue_summary: RevenueSummary;
}

export interface SafetyMetrics {
    total_flags: number;
    resolved_flags: number;
    resolution_rate: number;
}

export interface TrendPoint {
    date: string;
    value: number;
}

export interface PerformanceTrends {
    visitors_over_time: TrendPoint[];
    engagement_over_time: TrendPoint[];
    lead_generation_over_time: TrendPoint[];
}

export interface OrganizerSummary {
    overview: OverviewMetrics;
    safety: SafetyMetrics;
    performance_trends: PerformanceTrends;
    generated_at: string;
}
