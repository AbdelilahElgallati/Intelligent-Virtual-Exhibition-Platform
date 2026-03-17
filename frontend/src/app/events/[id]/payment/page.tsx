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

interface PaymentPageProps {
    params: Promise<{ id?: string }> | { id?: string };
}

export default function PaymentPage({ params }: PaymentPageProps) {
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
                    setError('Payment verification failed. Please contact support.');
                })
                .finally(() => setVerifying(false));
        }
    }, [isSuccess, paymentId, id, verifying, paymentStatus]);

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
            setError(err.message || 'Failed to start checkout. Please try again.');
            setCheckoutLoading(false);
        }
    };

    if (loading || authLoading) {
        return <LoadingState message="Loading payment details..." />;
    }

    if (!event) {
        return (
            <Container className="py-20 text-center">
                <h2 className="text-2xl font-bold mb-4">Event not found</h2>
            </Container>
        );
    }

    if (!event.is_paid) {
        return (
            <Container className="py-20 text-center">
                <h2 className="text-2xl font-bold mb-4">This event is free</h2>
                <p className="text-muted-foreground mb-6">No payment is required for this event.</p>
                <button
                    onClick={() => router.push(`/events/${id}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    &larr; Back to Event
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
                    &larr; Back to Event
                </button>
                <h1 className="text-3xl font-bold mb-2">Event Payment</h1>
                <p className="text-muted-foreground">
                    Secure payment for <strong>{event.title}</strong>
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
                        <p className="text-xs text-muted-foreground">Ticket Price</p>
                    </div>
                </div>
            </div>

            {/* Cancelled */}
            {isCancelled && paymentStatus !== 'paid' && (
                <div className="rounded-xl p-4 mb-8 text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    <p className="font-bold">Payment Cancelled</p>
                    <p className="mt-1">Your payment was cancelled. You can try again below.</p>
                </div>
            )}

            {/* Verifying */}
            {verifying && (
                <div className="rounded-xl p-4 mb-8 text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <p className="font-bold">Verifying Payment...</p>
                    <p className="mt-1">Please wait while we confirm your payment.</p>
                </div>
            )}

            {/* Payment Confirmed */}
            {paymentStatus === 'paid' && (
                <div className="rounded-xl p-6 mb-8 bg-green-50 text-green-700 border border-green-200">
                    <p className="font-bold text-lg">Payment Confirmed!</p>
                    <p className="mt-2">Your payment has been verified. You now have full access to this event.</p>

                    <div className="flex flex-wrap gap-3 mt-4">
                        <button
                            onClick={() => router.push(`/events/${id}/live`)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                        >
                            Enter Event &rarr;
                        </button>
                        {receiptData && (
                            <button
                                onClick={async () => {
                                    if (!id) return;
                                    await downloadEventTicketReceiptPdf({
                                        eventId: id,
                                        eventTitle: receiptData.event_title || event?.title || 'Event',
                                        payerName: receiptData.payer_name || 'Visitor',
                                        payerEmail: receiptData.payer_email || '',
                                        amount: Number(receiptData.amount || 0),
                                        currency: receiptData.currency || 'MAD',
                                        paidAt: receiptData.paid_at,
                                        reference: receiptData.stripe_payment_intent_id || receiptData.receipt_id || 'N/A',
                                    });
                                }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white border border-indigo-300 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                Download Invoice (PDF)
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
                    <h3 className="font-semibold text-lg mb-4">Secure Payment</h3>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                        <p>
                            Click the button below to securely pay <strong>{event.ticket_price?.toFixed(2) ?? '0.00'} MAD</strong> via Stripe.
                            You will be redirected to Stripe&apos;s secure checkout page.
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
                        {checkoutLoading ? 'Redirecting to Stripe...' : 'Pay Now'}
                    </button>

                    <p className="text-xs text-muted-foreground mt-3 text-center">
                        Powered by Stripe. Your payment information is handled securely.
                    </p>
                </div>
            )}
        </Container>
    );
}
