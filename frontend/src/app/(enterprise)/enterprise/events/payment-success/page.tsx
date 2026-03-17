'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, FileText, Building2 } from 'lucide-react';
import { http } from '@/lib/http';
import { downloadEnterpriseStandFeeReceiptPdf } from '@/lib/pdf/receipts';

export default function EnterprisePaymentSuccessPage() {
    const searchParams = useSearchParams();
    const eventId = searchParams.get('event_id');
    const sessionId = searchParams.get('session_id');
    const [event, setEvent] = useState<any>(null);
    const [participant, setParticipant] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!eventId) { setLoading(false); return; }
        (async () => {
            try {
                // Verify payment first to auto-approve
                if (sessionId) {
                    await http.post(`/enterprise/events/${eventId}/verify-payment`, {
                        session_id: sessionId
                    }).catch(() => { /* ignore if already verified or error */ });
                }

                // Fetch the enterprise events list to get the participation info
                const events = await http.get<any[]>('/enterprise/events');
                const ev = events.find((e: any) => (e.id || e._id) === eventId);
                if (ev) {
                    setEvent(ev);
                    setParticipant(ev.participation);
                }
            } catch { /* ignore */ }
            finally { setLoading(false); }
        })();
    }, [eventId, sessionId]);

    const standFee = event?.stand_price ?? event?.stand_fee ?? 0;

    const downloadInvoice = async () => {
        await downloadEnterpriseStandFeeReceiptPdf({
            eventId: eventId || event?.id || event?._id || '',
            eventTitle: event?.title || 'Event',
            organizerName: event?.organizer_name || '',
            buyerName: '',
            buyerEmail: '',
            amount: Number(standFee || 0),
            paidAt: participant?.updated_at,
            paymentReference: participant?.payment_reference || 'N/A',
            paymentMethodLabel: 'Stripe (Online Card Payment)',
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-2">Stand Approved!</h1>
                <p className="text-gray-500 text-sm mb-6">
                    Your stand fee has been paid successfully. Your participation is approved.
                </p>

                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : event ? (
                    <>
                        {/* Event info */}
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 mb-4 text-left">
                            <Building2 className="w-6 h-6 text-indigo-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{event.title}</p>
                                <p className="text-xs text-gray-500">
                                    Stand Fee: {Number(standFee || 0).toFixed(2)} MAD
                                </p>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase">
                                Paid
                            </span>
                        </div>

                        {/* Download PDF */}
                        <button
                            onClick={downloadInvoice}
                            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors mb-4"
                        >
                            <FileText className="w-4 h-4" />
                            Download Invoice (PDF)
                        </button>
                    </>
                ) : null}

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/enterprise/events"
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                    >
                        Back to Events
                    </Link>
                </div>
            </div>
        </div>
    );
}
