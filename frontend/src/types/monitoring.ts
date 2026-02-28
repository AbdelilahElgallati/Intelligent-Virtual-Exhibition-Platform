// Types for Week 3: Live Event Monitoring

export interface KPIs {
    active_visitors: number;
    active_stands: number;
    ongoing_meetings: number;
    messages_per_minute: number;
    resource_downloads_last_hour: number;
    incident_flags_open: number;
}

export interface ActiveUser {
    user_id: string;
    full_name: string;
    role: string;
    connected_at: string; // ISO string
}

export interface RecentFlag {
    id: string;
    entity_type: string;
    entity_id: string;
    reason: string;
    created_at: string; // ISO string
}

export interface LiveMetrics {
    kpis: KPIs;
    active_users: ActiveUser[];
    recent_flags: RecentFlag[];
    timestamp: string; // ISO string
}

// Historical datapoint for sparkline / time-series charts
export interface MetricDataPoint {
    time: string;   // HH:MM label
    value: number;
}
