import { http } from '@/lib/http';
import { OrganizerEvent } from '@/types/event';
import { OrganizerSummary } from '@/types/organizer';
import { DashboardData } from '@/types/analytics';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { getDirectApiUrl } from '@/lib/config';

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
        await this._downloadPDF(`/metrics/reports/organizer/events/${eventId}?format=pdf`, `event_report_${eventId}.pdf`);
    },

    /**
     * Download the overall performance report as PDF.
     */
    async exportOverallReportPDF(): Promise<void> {
        const filename = `overall_performance_${new Date().toISOString().split('T')[0]}.pdf`;
        try {
            await this._downloadPDF('/organizer/overall-summary/pdf', filename);
        } catch (error: unknown) {
            const message = String((error as Error)?.message || 'Export failed');
            // Some hosted environments may not expose the PDF route yet.
            if (message.includes('404')) {
                const summary = await this.getOverallSummary();
                await this._downloadOverallSummaryFallbackPDF(summary, filename);
                return;
            }
            throw error;
        }
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

    async updateEvent(eventId: string, data: any): Promise<OrganizerEvent> {
        return http.patch(`/events/${eventId}`, data);
    },

    /**
     * Get live event analytics snapshot for organizer-owned events.
     */
    async getLiveEventAnalytics(eventId: string): Promise<{ dashboard: DashboardData; live: Record<string, number> }> {
        return http.get(`/metrics/live/events/${eventId}`);
    },

    /**
     * Fallback event analytics (non-live dashboard structure).
     */
    async getEventAnalytics(eventId: string): Promise<DashboardData> {
        return http.get(`/metrics/event/${eventId}`);
    },


    /**
     * Internal helper to handle PDF downloads with authentication.
     */
    async _downloadPDF(endpoint: string, filename: string): Promise<void> {
        try {
            const blob = await http.getBlob(endpoint, { accept: 'application/pdf' });

            const ctype = (blob.type || '').toLowerCase();
            if (blob.size < 100) {
                console.error('PDF Blob validation failed: size too small', blob.size);
                throw new Error('Received an empty or invalid document (file size too small).');
            }
            if (ctype && !ctype.includes('pdf') && !ctype.includes('octet-stream')) {
                let preview = '';
                try {
                    preview = (await blob.slice(0, 120).text()).trim();
                } catch {
                    /* ignore */
                }
                if (preview.toLowerCase().startsWith('<!doctype') || preview.toLowerCase().includes('<html')) {
                    throw new Error('Server returned HTML instead of a PDF. Check the API URL and that the report endpoint is available.');
                }
                if (preview.toLowerCase().includes('error') || preview.toLowerCase().includes('traceback')) {
                    throw new Error(preview.length < 300 ? preview : 'Server returned a non-PDF response. See backend logs for details.');
                }
            }

            const href = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = href;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(href), 15_000);
        } catch (error: unknown) {
            console.error('PDF Export Critical Error:', error);
            const message = String((error as Error)?.message || 'Export failed');
            const isFailedFetch =
                error instanceof TypeError &&
                (message === 'Failed to fetch' || message.toLowerCase().includes('failed to fetch'));
            const isAbort = error instanceof DOMException && error.name === 'AbortError';

            if (isFailedFetch || isAbort) {
                throw new Error(
                    `Unable to download the report from the API (${getDirectApiUrl(endpoint)}). Confirm the backend is reachable and CORS allows this origin. Details: ${message}`,
                );
            }

            throw error instanceof Error ? error : new Error(message);
        }
    },

    /**
     * Client-side fallback PDF generator when backend PDF endpoint is unavailable.
     */
    async _downloadOverallSummaryFallbackPDF(summary: OrganizerSummary, filename: string): Promise<void> {
        const { default: jsPDF } = await import('jspdf');
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF();
        const generatedAt = summary?.generated_at ? new Date(summary.generated_at) : new Date();
        const currencyFmt = new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' });

        doc.setFontSize(20);
        doc.setTextColor(67, 56, 202);
        doc.text('Organizer Overall Performance Report', 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated: ${generatedAt.toLocaleString()}`, 14, 28);

        const overviewRows = [
            ['Total Visitors', String(summary?.overview?.total_visitors ?? 0)],
            ['Enterprise Participation Rate', `${Number(summary?.overview?.enterprise_participation_rate ?? 0).toFixed(1)}%`],
            ['Stand Engagement Score', `${Number(summary?.overview?.stand_engagement_score ?? 0).toFixed(1)}`],
            ['Leads Generated', String(summary?.overview?.leads_generated ?? 0)],
            ['Meetings Booked', String(summary?.overview?.meetings_booked ?? 0)],
            ['Chat Interactions', String(summary?.overview?.chat_interactions ?? 0)],
        ];

        autoTable(doc, {
            startY: 36,
            head: [['Overview KPI', 'Value']],
            body: overviewRows,
            theme: 'striped',
            headStyles: { fillColor: [67, 56, 202], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
        });

        const revenue = summary?.overview?.revenue_summary;
        const revenueRows = [
            ['Ticket Revenue', currencyFmt.format(Number(revenue?.ticket_revenue ?? 0))],
            ['Stand Revenue', currencyFmt.format(Number(revenue?.stand_revenue ?? 0))],
            ['Total Revenue', currencyFmt.format(Number(revenue?.total_revenue ?? 0))],
        ];

        const afterOverview = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;
        autoTable(doc, {
            startY: afterOverview + 8,
            head: [['Revenue Summary', 'Amount']],
            body: revenueRows,
            theme: 'striped',
            headStyles: { fillColor: [5, 150, 105], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
        });

        const safety = summary?.safety;
        const safetyRows = [
            ['Total Flags', String(safety?.total_flags ?? 0)],
            ['Resolved Flags', String(safety?.resolved_flags ?? 0)],
            ['Resolution Rate', `${Number(safety?.resolution_rate ?? 0).toFixed(1)}%`],
        ];

        const afterRevenue = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 190;
        autoTable(doc, {
            startY: afterRevenue + 8,
            head: [['Safety & Moderation', 'Value']],
            body: safetyRows,
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 4 },
        });

        doc.save(filename);
    }
};
