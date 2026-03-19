import { http } from '@/lib/http';
import { OrganizerEvent } from '@/types/event';
import { OrganizerSummary } from '@/types/organizer';
import { DashboardData } from '@/types/analytics';
import { ENDPOINTS } from '@/lib/api/endpoints';

export const organizerService = {
    /**
     * Get aggregate performance summary for all events owned by the organizer.
     */
    async getOverallSummary(): Promise<OrganizerSummary> {
        return http.get('/organizer/overall-summary');
    },

    /**
     * Download the individual event report as PDF.
     */
    async exportEventReportPDF(eventId: string): Promise<void> {
        await this._downloadPDF(`/organizer/events/${eventId}/report?format=pdf`, `event_report_${eventId}.pdf`);
    },

    /**
     * Download the overall performance report as PDF.
     */
    async exportOverallReportPDF(): Promise<void> {
        await this._downloadPDF('/organizer/overall-summary/pdf', `overall_performance_${new Date().toISOString().split('T')[0]}.pdf`);
    },

    /**
     * Submit payment proof for an approved event using either a file (image/PDF)
     * or a direct URL/path.
     */
    async submitPaymentProof(eventId: string, proof: File | string): Promise<any> {
        if (typeof proof === 'string') {
            const normalized = proof.trim();
            if (!normalized) {
                throw new Error('Please provide a valid proof URL/path.');
            }
            return http.post(ENDPOINTS.EVENTS.SUBMIT_PAYMENT_PROOF(eventId, normalized), {});
        }

        const formData = new FormData();
        formData.append('file', proof);
        return http.post(ENDPOINTS.EVENTS.UPLOAD_PAYMENT_PROOF(eventId), formData);
    },

    async startEvent(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/start`, {});
    },

    async closeEvent(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/close`, {});
    },

    /**
     * Get live event analytics snapshot for organizer-owned events.
     */
    async getLiveEventAnalytics(eventId: string): Promise<{ dashboard: DashboardData; live: Record<string, number> }> {
        return http.get(`/analytics/live/events/${eventId}`);
    },

    /**
     * Fallback event analytics (non-live dashboard structure).
     */
    async getEventAnalytics(eventId: string): Promise<DashboardData> {
        return http.get(`/analytics/event/${eventId}`);
    },


    /**
     * Internal helper to handle PDF downloads with authentication.
     */
    async _downloadPDF(endpoint: string, filename: string): Promise<void> {
        try {
            const blob = await http.get<Blob>(endpoint, {
                responseType: 'blob',
                headers: {
                    'Accept': 'application/pdf',
                },
            });

            if (!blob || blob.size < 100) {
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
            throw new Error(error.message.includes('fetch') || error.message.includes('reach')
                ? 'Network error: Cannot reach the server. Please check your connection or CORS settings.'
                : error.message);
        }
    }
};
