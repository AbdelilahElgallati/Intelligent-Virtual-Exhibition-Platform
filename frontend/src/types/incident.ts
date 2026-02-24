// Incident & content flag types

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved';

export interface Incident {
    id: string;
    title: string;
    description?: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface IncidentCreate {
    title: string;
    description?: string;
    severity: IncidentSeverity;
}

export interface IncidentUpdate {
    status?: IncidentStatus;
    notes?: string;
    title?: string;
    description?: string;
    severity?: IncidentSeverity;
}

export interface ContentFlag {
    id: string;
    entity_type: string;
    entity_id: string;
    reason: string;
    details?: string;
    created_at: string;
    reporter_id?: string;
}

export interface PlatformHealth {
    status: 'healthy' | 'degraded';
    timestamp: string;
    uptime: string;
    uptime_seconds: number;
    services: {
        mongodb: { status: string; latency_ms: number | null };
        redis: { status: string; latency_ms: number | null };
        api: { status: string; pid: number };
    };
}
