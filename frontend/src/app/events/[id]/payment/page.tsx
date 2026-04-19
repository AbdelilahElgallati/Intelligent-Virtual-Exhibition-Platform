'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Event } from '@/types/event';
import { LoadingState } from '@/components/ui/LoadingState';
import { Container } from '@/components/common/Container';
import { useAuth } from '@/context/AuthContext';
import { downloadEventTicketReceiptPdf } from '@/lib/pdf/receipts';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

interface PaymentPageProps {
    params: Promise<{ id?: string }> | { id?: string };
}

export default function PaymentPage({ params }: PaymentPageProps) {
    const { t } = useTranslation();
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const id = resolvedParams?.id;
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [paymentStatus, setPaymentStatus] = useState<string>('none');
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [receiptData, setReceiptData] = useState<Record<string, any> | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isSuccess = searchParams.get('success') === 'true';
    const paymentId = searchParams.get('payment_id');
    const isCancelled = searchParams.get('cancelled') === 'true';

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const [eventData, statusData] = await Promise.all([
                apiClient.get<Event>(ENDPOINTS.EVENTS.GET(id)),
                apiClient.get<{ status: string }>(ENDPOINTS.PAYMENTS.MY_STATUS(id)),
            ]);
            setEvent(eventData);
            setPaymentStatus(statusData.status);
        } catch (err) {
            console.error('Failed to load payment page data:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Verify payment after Stripe redirect
    useEffect(() => {
        if (isSuccess && paymentId && id && !verifying && paymentStatus !== 'paid') {
            setVerifying(true);
            apiClient
                .post<{ status: string }>(ENDPOINTS.PAYMENTS.VERIFY(id), { payment_id: paymentId })
                .then((res) => {
                    if (res.status === 'paid' || res.status === 'already_paid') {
                        setPaymentStatus('paid');
                    }
                })
                .catch((err) => {
                    console.error('Payment verification failed:', err);
                    setError(t('events.payment.verifying.error'));
                })
                .finally(() => setVerifying(false));
        }
    }, [isSuccess, paymentId, id, verifying, paymentStatus, t]);

    // Fetch receipt data when payment is confirmed
    useEffect(() => {
        if (paymentStatus === 'paid' && id && !receiptData) {
            apiClient
                .get<Record<string, any>>(ENDPOINTS.PAYMENTS.RECEIPT(id))
                .then((res) => setReceiptData(res))
                .catch(() => { /* receipt may not be ready yet */ });
        }
    }, [paymentStatus, id, receiptData]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/auth/login');
            return;
        }
        if (!authLoading && isAuthenticated) {
            fetchData();
        }
    }, [authLoading, isAuthenticated, fetchData, router]);

    const handleCheckout = async () => {
        if (!id) return;
        try {
            setCheckoutLoading(true);
            setError(null);
            const res = await apiClient.post<{ payment_url: string }>(
                ENDPOINTS.PAYMENTS.CHECKOUT(id)
            );
            // Redirect to Stripe Checkout
            window.location.href = res.payment_url;
        } catch (err: any) {
            console.error('Checkout failed:', err);
            setError(err.message || t('events.payment.checkout.startError'));
            setCheckoutLoading(false);
        }
    };

    if (loading || authLoading) {
        return <LoadingState message={t('events.payment.loading')} />;
    }

    if (!event) {
        return (
            <Container className="py-20 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('events.detail.notFound')}</h2>
            </Container>
        );
    }

    if (!event.is_paid) {
        return (
            <Container className="py-20 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('events.payment.freeEvent.title')}</h2>
                <p className="text-muted-foreground mb-6">{t('events.payment.freeEvent.message')}</p>
                <button
                    onClick={() => router.push(`/events/${id}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    {t('events.payment.actions.backToEvent')}
                </button>
            </Container>
        );
    }

    return (
        <Container className="py-12 max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.push(`/events/${id}`)}
                    className="text-sm text-muted-foreground hover:text-primary mb-4 inline-flex items-center gap-1"
                >
                    {t('events.payment.actions.backToEvent')}
                </button>
                <h1 className="text-3xl font-bold mb-2">{t('events.payment.title')}</h1>
                <p className="text-muted-foreground">
                    {t('events.payment.subtitle', { title: event.title })}
                </p>
            </div>

            {/* Event Info Card */}
            <div className="border rounded-xl p-6 mb-8 bg-gradient-to-br from-indigo-50 to-purple-50">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{event.category}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600">
                            {event.ticket_price?.toFixed(2) ?? '0.00'} MAD
                        </div>
                        <p className="text-xs text-muted-foreground">{t('events.payment.ticketPrice')}</p>
                    </div>
                </div>
            </div>

            {/* Cancelled */}
            {isCancelled && paymentStatus !== 'paid' && (
                <div className="rounded-xl p-4 mb-8 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <p className="font-bold">{t('events.payment.cancelled.title')}</p>
                    <p className="mt-1">{t('events.payment.cancelled.message')}</p>
                </div>
            )}

            {/* Verifying */}
            {verifying && (
                <div className="rounded-xl p-4 mb-8 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <p className="font-bold">{t('events.payment.verifying.title')}</p>
                    <p className="mt-1">{t('events.payment.verifying.message')}</p>
                </div>
            )}

            {/* Payment Confirmed */}
            {paymentStatus === 'paid' && (
                <div className="rounded-xl p-6 mb-8 bg-green-50 text-green-700 border border-green-200">
                    <p className="font-bold text-lg">{t('events.payment.confirmed.title')}</p>
                    <p className="mt-2">{t('events.payment.confirmed.message')}</p>

                    <div className="flex flex-wrap gap-3 mt-4">
                        <button
                            onClick={() => router.push(`/events/${id}/live`)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                        >
                            {t('events.payment.actions.enterEvent')}
                        </button>
                        {receiptData && (
                            <button
                                onClick={async () => {
                                    if (!id) return;
                                    await downloadEventTicketReceiptPdf({
                                        eventId: id,
                                        eventTitle: receiptData.event_title || event?.title || t('events.detail.exhibitionFallback'),
                                        payerName: receiptData.payer_name || t('events.detail.receiptDownload.payerDefault'),
                                        payerEmail: receiptData.payer_email || '',
                                        amount: Number(receiptData.amount || 0),
                                        currency: receiptData.currency || 'MAD',
                                        paidAt: receiptData.paid_at,
                                        reference: receiptData.stripe_payment_intent_id || receiptData.receipt_id || 'N/A',
                                        organizerName: (event as any)?.organizer_name,
                                        eventLocation: event?.location,
                                        eventTimezone: event?.event_timezone,
                                        category: (event as any)?.category,
                                        startDateLabel: event?.start_date
                                            ? formatInTZ(event.start_date, event.event_timezone || getUserTimezone(), 'MMM d, yyyy h:mm a')
                                            : undefined,
                                        endDateLabel: event?.end_date
                                            ? formatInTZ(event.end_date, event.event_timezone || getUserTimezone(), 'MMM d, yyyy h:mm a')
                                            : undefined,
                                        paymentMethodLabel:
                                            String(receiptData.payment_method || '').toLowerCase() === 'cash_on_delivery'
                                                ? t('events.payment.receipt.paymentMethod.cod')
                                                : t('events.payment.receipt.paymentMethod.stripe'),
                                    });
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white border border-indigo-300 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                {t('events.payment.actions.downloadInvoice')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-xl p-4 mb-8 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                    <p>{error}</p>
                </div>
            )}

            {/* Pay with Stripe (show when not yet paid and not verifying) */}
            {paymentStatus !== 'paid' && !verifying && (
                <div className="border rounded-xl p-6">
                    <h3 className="font-semibold text-lg mb-4">{t('events.payment.checkout.title')}</h3>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                        <p>
                            {t('events.payment.checkout.description', { amount: event.ticket_price?.toFixed(2) ?? '0.00' })}
                        </p>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={checkoutLoading}
                        className={`w-full py-3 rounded-xl font-semibold text-white transition-colors ${
                            checkoutLoading
                                ? 'bg-zinc-300 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {checkoutLoading ? t('events.payment.checkout.redirecting') : t('events.payment.checkout.payNow')}
                    </button>

                    <p className="text-xs text-muted-foreground mt-3 text-center">
                        {t('events.payment.checkout.poweredBy')}
                    </p>
                </div>
            )}
        </Container>
    );
}
