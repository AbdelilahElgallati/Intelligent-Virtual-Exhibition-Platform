'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, FileText, Building2 } from 'lucide-react';
import { http } from '@/lib/http';
import { downloadEnterpriseStandFeeReceiptPdf } from '@/lib/pdf/receipts';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

function formatEventDateLabel(iso?: string): string | undefined {
  if (!iso) return undefined;
  try {
    return formatInTZ(iso, getUserTimezone(), 'MMM d, yyyy h:mm a');
  } catch {
    return undefined;
  }
}

export default function EnterprisePaymentSuccessPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event_id');
  const sessionId = searchParams.get('session_id');
  const [event, setEvent] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  const [buyer, setBuyer] = useState<{ full_name?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        if (sessionId) {
          await http
            .post(`/enterprise/events/${eventId}/verify-payment`, {
              session_id: sessionId,
            })
            .catch(() => undefined);
        }

        const [me, eventsRes] = await Promise.all([
          http.get<any>('/users/me').catch(() => null),
          http.get<any[]>('/enterprise/events').catch(() => []),
        ]);
        if (me) {
          setBuyer({ full_name: me.full_name || me.name, email: me.email });
        }

        const list = Array.isArray(eventsRes) ? eventsRes : [];
        const ev =
          list.find(
            (e: any) =>
              String(e?.id || e?._id) === String(eventId) || String(e?.slug || '') === String(eventId),
          ) || null;

        if (ev) {
          setEvent(ev);
          setParticipant(ev.participation);
        } else {
          try {
            const pub = await http.get<any>(`/events/${encodeURIComponent(eventId)}`);
            if (pub) setEvent(pub);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, sessionId]);

  const standFee = event?.stand_price ?? event?.stand_fee ?? 0;

  const downloadInvoice = async () => {
    const eid = String(eventId || event?.id || event?._id || '');
    await downloadEnterpriseStandFeeReceiptPdf({
      eventId: eid,
      eventTitle: event?.title || t('enterprise.eventManagement.eventFallback'),
      organizerName: event?.organizer_name || '',
      buyerName: buyer?.full_name || buyer?.email || t('auth.register.roles.enterprise'),
      buyerEmail: buyer?.email || '',
      amount: Number(standFee || 0),
      paidAt: participant?.updated_at,
      paymentReference: participant?.payment_reference || 'N/A',
      paymentMethodLabel: 'Stripe (Online Card Payment)',
      eventLocation: event?.location,
      eventTimezone: event?.event_timezone,
      category: event?.category,
      startDateLabel: formatEventDateLabel(event?.start_date),
      endDateLabel: formatEventDateLabel(event?.end_date),
    });
  };

  const showDownload = Boolean(eventId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('enterprise.paymentSuccess.standApproved')}</h1>
        <p className="text-gray-500 text-sm mb-6">
          {t('enterprise.paymentSuccess.successMessage')}
        </p>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {event ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 mb-4 text-left">
                <Building2 className="w-6 h-6 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{event.title}</p>
                  <p className="text-xs text-gray-500">
                    {t('enterprise.paymentSuccess.amountPaidLabel', { amount: Number(standFee || 0).toFixed(2), currency: 'MAD' })}
                  </p>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold uppercase">
                  {t('enterprise.paymentSuccess.statusPaid')}
                </span>
              </div>
            ) : (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-left">
                {t('enterprise.paymentSuccess.eventLoadingHint')}
              </p>
            )}

            {showDownload && (
              <button
                type="button"
                onClick={downloadInvoice}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors mb-4"
              >
                <FileText className="w-4 h-4" />
                {t('enterprise.paymentSuccess.downloadReceipt')}
              </button>
            )}
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/enterprise/events"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            {t('enterprise.paymentSuccess.backToEvents')}
          </Link>
        </div>
      </div>
    </div>
  );
}
