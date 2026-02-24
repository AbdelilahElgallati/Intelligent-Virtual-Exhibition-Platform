import { http } from '@/lib/http';
import { OrganizerEvent } from '@/types/event';
import { User } from '@/types/user';
import { AdminOrganization, AdminSubscription } from '@/types/admin';
import { DashboardData } from '@/types/analytics';
import { AuditLog } from '@/types/audit';
import { PlatformHealth, Incident, IncidentCreate, IncidentUpdate, ContentFlag } from '@/types/incident';

// ── Events (Day 2) ─────────────────────────────────────────────────────

export const adminService = {
    // ── Events ────────────────────────────────────────────────────────

    /**
     * List events filtered by state (defaults to pending_approval for review).
     */
    async getEvents(state?: string): Promise<{ events: OrganizerEvent[]; total: number }> {
        const params = state ? `?state=${state}` : '';
        return http.get(`/events${params}`);
    },

    async approveEvent(id: string, payload: { payment_amount?: number } = {}): Promise<OrganizerEvent> {
        return http.post(`/events/${id}/approve`, payload);
    },

    async rejectEvent(id: string, payload: { reason?: string } = {}): Promise<OrganizerEvent> {
        return http.post(`/events/${id}/reject`, payload);
    },

    // ── Users (Day 3) ─────────────────────────────────────────────────

    async getUsers(params: { role?: string; search?: string } = {}): Promise<User[]> {
        const query = new URLSearchParams();
        if (params.role) query.set('role', params.role);
        if (params.search) query.set('search', params.search);
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/users/admin/all${qs}`);
    },

    async activateUser(id: string): Promise<User> {
        return http.patch(`/users/admin/${id}/activate`, {});
    },

    async suspendUser(id: string): Promise<User> {
        return http.patch(`/users/admin/${id}/suspend`, {});
    },

    // ── Organizations (Day 4) ─────────────────────────────────────────

    async getOrganizations(): Promise<AdminOrganization[]> {
        return http.get('/organizations/');
    },

    async verifyOrganization(id: string): Promise<AdminOrganization> {
        return http.patch(`/organizations/${id}/verify`, {});
    },

    async flagOrganization(id: string): Promise<AdminOrganization> {
        return http.patch(`/organizations/${id}/flag`, {});
    },

    async suspendOrganization(id: string): Promise<AdminOrganization> {
        return http.patch(`/organizations/${id}/suspend`, {});
    },

    // ── Subscriptions (Day 5) ─────────────────────────────────────────

    async getSubscriptions(): Promise<AdminSubscription[]> {
        return http.get('/subscriptions/admin/all');
    },

    async cancelSubscription(orgId: string): Promise<AdminSubscription> {
        return http.delete(`/subscriptions/admin/${orgId}`);
    },

    async overrideSubscription(orgId: string, plan: string): Promise<AdminSubscription> {
        return http.patch(`/subscriptions/admin/${orgId}/override`, { plan });
    },

    // ── Analytics (Day 6–7) ───────────────────────────────────────────

    async getPlatformAnalytics(): Promise<DashboardData> {
        return http.get('/analytics/platform');
    },

    async getEventAnalytics(eventId: string): Promise<DashboardData> {
        return http.get(`/analytics/event/${eventId}`);
    },

    // ── Health (Day 8) ────────────────────────────────────────────────

    async getHealth(): Promise<PlatformHealth> {
        return http.get('/admin/health');
    },

    // ── Audit Logs (Day 9) ────────────────────────────────────────────

    async getAuditLogs(params: {
        actor_id?: string;
        action?: string;
        entity?: string;
        from_date?: string;
        to_date?: string;
        limit?: number;
        skip?: number;
    } = {}): Promise<AuditLog[]> {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.set(k, String(v)); });
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/audit/${qs}`);
    },

    async getAuditActions(): Promise<string[]> {
        return http.get('/audit/actions');
    },

    // ── Incidents (Day 10) ────────────────────────────────────────────

    async getIncidents(params: { status?: string; limit?: number } = {}): Promise<Incident[]> {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.limit) query.set('limit', String(params.limit));
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/incidents/${qs}`);
    },

    async createIncident(data: IncidentCreate): Promise<Incident> {
        return http.post('/incidents/', data);
    },

    async updateIncident(id: string, data: IncidentUpdate): Promise<Incident> {
        return http.patch(`/incidents/${id}`, data);
    },

    async flagContent(data: { entity_type: string; entity_id: string; reason: string; details?: string }): Promise<ContentFlag> {
        return http.post('/incidents/flag', data);
    },

    async getFlags(): Promise<ContentFlag[]> {
        return http.get('/incidents/flags');
    },
};


