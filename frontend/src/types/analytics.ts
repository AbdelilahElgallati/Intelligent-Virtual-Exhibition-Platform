// Analytics types — mirrors backend DashboardData schema

export interface KPIMetric {
    label: string;
    value: number;
    unit?: string;
    trend?: number | null;
}

export interface TimeSeriesPoint {
    timestamp: string; // ISO 8601
    value: number;
}

export interface DashboardData {
    kpis: KPIMetric[];
    main_chart: TimeSeriesPoint[];
    distribution: Record<string, number>;
    recent_activity: RecentActivity[];
}

export interface RecentActivity {
    id: string;
    title: string;
    state: string;
    created_at: string;
    organizer_name?: string;
}
