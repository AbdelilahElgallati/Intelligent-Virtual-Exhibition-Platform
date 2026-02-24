// Audit log types

export interface AuditLog {
    id: string;
    actor_id: string;
    action: string;
    entity: string;
    entity_id?: string;
    timestamp: string; // ISO 8601
    metadata?: Record<string, unknown>;
}
