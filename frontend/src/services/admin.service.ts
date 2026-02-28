import { http } from '@/lib/http';
import { OrganizerEvent } from '@/types/event';
import { User } from '@/types/user';
import { AdminOrganization, AdminSubscription } from '@/types/admin';
import { DashboardData } from '@/types/analytics';
import { AuditLog } from '@/types/audit';
import { PlatformHealth, Incident, IncidentCreate, IncidentUpdate, ContentFlag } from '@/types/incident';
import { EnterpriseRequestsResponse, RejectBody } from '@/types/participant';
import { LiveMetrics } from '@/types/monitoring';
import { OrganizerSummary } from '@/types/organizer';
import { getApiUrl } from '@/lib/config';

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

    // ── Enterprise Join Requests ──────────────────────────────────────────

    async getEnterpriseRequests(
        eventId: string,
        params: { status?: string; search?: string; skip?: number; limit?: number } = {},
    ): Promise<EnterpriseRequestsResponse> {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.search) query.set('search', params.search);
        if (params.skip !== undefined) query.set('skip', String(params.skip));
        if (params.limit !== undefined) query.set('limit', String(params.limit));
        const qs = query.toString() ? `?${query.toString()}` : '';
        return http.get(`/admin/events/${eventId}/enterprise-requests${qs}`);
    },

    async approveEnterpriseRequest(eventId: string, participantId: string): Promise<unknown> {
        return http.post(`/events/${eventId}/participants/${participantId}/approve`, {});
    },

    async rejectEnterpriseRequest(eventId: string, participantId: string, body: RejectBody = {}): Promise<unknown> {
        return http.post(`/events/${eventId}/participants/${participantId}/reject`, body);
    },

    // ── Event Lifecycle (Week 2) ──────────────────────────────────────────────

    async getEventById(id: string): Promise<OrganizerEvent> {
        return http.get(`/events/${id}`);
    },

    async forceStartEvent(id: string): Promise<OrganizerEvent> {
        return http.post(`/admin/events/${id}/force-start`, {});
    },

    async forceCloseEvent(id: string): Promise<OrganizerEvent> {
        return http.post(`/admin/events/${id}/force-close`, {});
    },

    // ── Week 3: Live Monitoring ───────────────────────────────────────────────

    async getLiveMetrics(eventId: string): Promise<LiveMetrics> {
        return http.get(`/admin/events/${eventId}/live-metrics`);
    },

    // ── Sessions (Week 5) ──────────────────────────────────────────────

    async getSessions(eventId: string): Promise<import('@/types/sessions').Session[]> {
        return http.get(`/admin/events/${eventId}/sessions`);
    },

    async createSession(eventId: string, data: import('@/types/sessions').CreateSessionPayload): Promise<import('@/types/sessions').Session> {
        return http.post(`/admin/events/${eventId}/sessions`, data);
    },

    /** Import conference/keynote/workshop slots from the event's schedule_days */
    async syncSessionsFromSchedule(eventId: string): Promise<import('@/types/sessions').Session[]> {
        return http.post(`/admin/events/${eventId}/sessions/sync`, {});
    },

    async startSession(sessionId: string): Promise<import('@/types/sessions').Session> {
        return http.patch(`/admin/sessions/${sessionId}/start`, {});
    },

    async endSession(sessionId: string): Promise<import('@/types/sessions').Session> {
        return http.patch(`/admin/sessions/${sessionId}/end`, {});
    },

    // ── Organizer Report (Week 6) ──────────────────────────────────────────

    async getOrganizerSummary(eventId: string): Promise<OrganizerSummary> {
        return http.get(`/admin/events/${eventId}/organizer-summary`);
    },

    /**
     * Trigger a PDF download of the organizer report for the given event.
     * Opens the PDF URL in a new tab — the browser will prompt for download.
     */
    async exportOrganizerSummaryPDF(eventId: string): Promise<void> {
        await this._downloadPDF(
            `/admin/events/${eventId}/organizer-summary/pdf`,
            `organizer_report_${eventId}.pdf`
        );
    },

    /**
     * Trigger a PDF download of the platform-wide report.
     */
    async exportPlatformReportPDF(): Promise<void> {
        await this._downloadPDF(
            '/analytics/report/export?format=pdf',
            `platform_report_${new Date().toISOString().split('T')[0]}.pdf`
        );
    },

    /**
     * Internal helper to handle PDF downloads with authentication consistently.
     */
    async _downloadPDF(endpoint: string, filename: string): Promise<void> {
        let token = null;
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('auth_tokens');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    token = parsed.access_token;
                }
            } catch (e) {
                console.error('Failed to extract token for PDF export', e);
            }
        }

        const url = getApiUrl(endpoint);

        try {
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'omit',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    'Accept': 'application/pdf',
                },
            });

            if (!res.ok) {
                let errorMsg = `Export failed (${res.status})`;
                try {
                    const errorData = await res.json();
                    errorMsg = errorData.detail || errorData.message || errorMsg;
                } catch { /* not json */ }
                throw new Error(errorMsg);
            }

            const blob = await res.blob();
            if (blob.size < 100) {
                throw new Error('Received an empty or invalid document.');
            }

            const href = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = href;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(href), 1000);
        } catch (error: any) {
            console.error('PDF Export Error:', error);
            throw new Error(error.message === 'Failed to fetch'
                ? 'Network error: Cannot reach the server. Please check your connection or CORS settings.'
                : error.message);
        }
    },
    /**
     * Confirm payment for an event (Admin action).
     */
    async confirmEventPayment(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/confirm-payment`, {});
    },

    async startEvent(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/start`, {});
    },

    async closeEvent(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/close`, {});
    },
};





