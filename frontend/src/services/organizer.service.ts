import { http } from '@/lib/http';
import { OrganizerEvent } from '@/types/event';
import { OrganizerSummary } from '@/types/organizer';
import { getApiUrl } from '@/lib/config';

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
     * Submit payment proof (image/file) for an approved event.
     */
    async submitPaymentProof(eventId: string, file: File): Promise<any> {
        // In a real app, we might upload to S3 first and get a URL.
        const mockUrl = `/uploads/proofs/${eventId}_${file.name}`;
        const params = new URLSearchParams({ proof_url: mockUrl });
        return http.post(`/events/${eventId}/submit-proof?${params.toString()}`, {});
    },

    async startEvent(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/start`, {});
    },

    async closeEvent(eventId: string): Promise<OrganizerEvent> {
        return http.post(`/events/${eventId}/close`, {});
    },


    /**
     * Internal helper to handle PDF downloads with authentication.
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
        console.log(`[DEBUG] PDF Export URL: ${url}`);

        try {
            const res = await fetch(url, {
                method: 'GET',
                credentials: 'omit', // Standard for Bearer token auth in dev
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
    }
};
