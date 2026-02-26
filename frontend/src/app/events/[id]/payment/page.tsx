'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { PaymentStatus } from '@/lib/api/types';
import { Event } from '@/types/event';
import { LoadingState } from '@/components/ui/LoadingState';
import { Container } from '@/components/common/Container';
import { useAuth } from '@/context/AuthContext';
import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/auth';

interface PaymentPageProps {
    params: Promise<{ id?: string }> | { id?: string };
}

export default function PaymentPage({ params }: PaymentPageProps) {
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const id = resolvedParams?.id;
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('none');
    const [adminNote, setAdminNote] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [submitMessage, setSubmitMessage] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const [eventData, statusData] = await Promise.all([
                apiClient.get<Event>(ENDPOINTS.EVENTS.GET(id)),
                apiClient.get<{ status: PaymentStatus; admin_note?: string }>(
                    ENDPOINTS.PAYMENTS.MY_STATUS(id)
                ),
            ]);
            setEvent(eventData);
            setPaymentStatus(statusData.status as PaymentStatus);
            setAdminNote(statusData.admin_note || null);
        } catch (err) {
            console.error('Failed to load payment page data:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/auth/login');
            return;
        }
        if (!authLoading && isAuthenticated) {
            fetchData();
        }
    }, [authLoading, isAuthenticated, fetchData, router]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setSelectedFile(e.target.files[0]);
            setSubmitMessage(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
            setSubmitMessage(null);
        }
    };

    const handleSubmit = async () => {
        if (!id || !selectedFile) return;

        // Validate file
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(selectedFile.type)) {
            setSubmitMessage('Only JPEG, PNG, or PDF files are allowed.');
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
            setSubmitMessage('File size must be under 5 MB.');
            return;
        }

        try {
            setUploading(true);
            setSubmitMessage(null);

            const formData = new FormData();
            formData.append('file', selectedFile);

            const token = getAccessToken();
            const res = await fetch(getApiUrl(ENDPOINTS.PAYMENTS.SUBMIT_PROOF(id)), {
                method: 'POST',
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'Upload failed');
            }

            setSubmitMessage('Payment proof submitted successfully! Awaiting admin review.');
            setPaymentStatus('pending');
            setSelectedFile(null);
        } catch (err: any) {
            setSubmitMessage(err.message || 'Failed to submit payment proof.');
        } finally {
            setUploading(false);
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

    // Free events should not show the payment page
    if (!event.is_paid) {
        return (
            <Container className="py-20 text-center">
                <h2 className="text-2xl font-bold mb-4">This event is free</h2>
                <p className="text-muted-foreground mb-6">No payment is required for this event.</p>
                <button
                    onClick={() => router.push(`/events/${id}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    ← Back to Event
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
                    ← Back to Event
                </button>
                <h1 className="text-3xl font-bold mb-2">Payment Required</h1>
                <p className="text-muted-foreground">
                    Submit proof of payment for <strong>{event.title}</strong>
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

            {/* Organizer Bank Information */}
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6 mb-8 space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    🏦 Payment Instructions
                </h3>
                {event.payment_details ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Please transfer <strong>{event.ticket_price?.toFixed(2) ?? '0.00'} MAD</strong> to the following bank account:
                        </p>

                        <div className="grid gap-3">
                            {event.payment_details.bank_name && (
                                <div className="flex items-start gap-3">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28 shrink-0 pt-0.5">Bank</span>
                                    <span className="text-sm font-medium text-gray-900">{event.payment_details.bank_name}</span>
                                </div>
                            )}
                            {event.payment_details.account_holder && (
                                <div className="flex items-start gap-3">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28 shrink-0 pt-0.5">Holder</span>
                                    <span className="text-sm font-medium text-gray-900">{event.payment_details.account_holder}</span>
                                </div>
                            )}
                            {event.payment_details.iban && (
                                <div className="flex items-start gap-3">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28 shrink-0 pt-0.5">IBAN</span>
                                    <span className="text-sm font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded select-all">
                                        {event.payment_details.iban}
                                    </span>
                                </div>
                            )}
                            {event.payment_details.swift && (
                                <div className="flex items-start gap-3">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-28 shrink-0 pt-0.5">SWIFT / BIC</span>
                                    <span className="text-sm font-mono text-gray-900">{event.payment_details.swift}</span>
                                </div>
                            )}
                            {event.payment_details.reference_note && (
                                <div className="flex items-start gap-3 mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <span className="text-xs font-medium text-amber-700 uppercase tracking-wide w-28 shrink-0 pt-0.5">Reference</span>
                                    <span className="text-sm font-bold text-amber-800">{event.payment_details.reference_note}</span>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                            Please include the reference code in your transfer so the organizer can identify your payment.
                        </p>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-300">
                        Please contact the organizer for payment instructions.
                    </div>
                )}
            </div>

            {/* Payment Status */}
            {paymentStatus !== 'none' && (
                <div
                    className={`rounded-xl p-4 mb-8 text-sm font-medium ${paymentStatus === 'approved'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : paymentStatus === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                >
                    {paymentStatus === 'approved' && (
                        <div>
                            <p className="font-bold">✅ Payment Approved!</p>
                            <p className="mt-1">Your payment has been verified. You can now enter the event.</p>
                            <button
                                onClick={() => router.push(`/events/${id}/live`)}
                                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                                Enter Event →
                            </button>
                        </div>
                    )}
                    {paymentStatus === 'pending' && (
                        <div>
                            <p className="font-bold">⏳ Payment Under Review</p>
                            <p className="mt-1">Your payment proof has been submitted   and is currently being reviewed by our team.</p>
                        </div>
                    )}
                    {paymentStatus === 'rejected' && (
                        <div>
                            <p className="font-bold">❌ Payment Rejected</p>
                            <p className="mt-1">Your payment proof was not accepted. Please re-submit with a valid proof.</p>
                            {adminNote && (
                                <p className="mt-2 p-2 bg-red-100 rounded text-xs">Admin note: {adminNote}</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Upload Section (show when no pending/approved payment) */}
            {(paymentStatus === 'none' || paymentStatus === 'rejected') && (
                <div className="border rounded-xl p-6">
                    <h3 className="font-semibold text-lg mb-4">Upload Payment Proof</h3>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                        <p className="font-medium mb-2">Steps:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Transfer <strong>{event.ticket_price?.toFixed(2) ?? '0.00'} MAD</strong> using the bank details above</li>
                            <li>Include the <strong>reference code</strong> in your transfer</li>
                            <li>Take a screenshot or save the receipt/confirmation</li>
                            <li>Upload the proof below (JPEG, PNG, or PDF)</li>
                        </ol>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver
                                ? 'border-primary bg-primary/5'
                                : 'border-zinc-300 hover:border-primary/50'
                            }`}
                        onClick={() => document.getElementById('proof-file-input')?.click()}
                    >
                        <input
                            id="proof-file-input"
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {selectedFile ? (
                            <div>
                                <div className="text-3xl mb-2">📄</div>
                                <p className="font-medium text-sm">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                                <p className="text-xs text-primary mt-2 hover:underline">Click to change file</p>
                            </div>
                        ) : (
                            <div>
                                <div className="text-3xl mb-2">📤</div>
                                <p className="font-medium text-sm">Drag & drop your payment proof here</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    or click to browse (JPEG, PNG, PDF — max 5 MB)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    {submitMessage && (
                        <p className={`mt-4 text-sm ${submitMessage.includes('success') ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {submitMessage}
                        </p>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={!selectedFile || uploading}
                        className={`mt-6 w-full py-3 rounded-xl font-semibold text-white transition-colors ${!selectedFile || uploading
                                ? 'bg-zinc-300 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                    >
                        {uploading ? 'Uploading...' : 'Submit Payment Proof'}
                    </button>
                </div>
            )}
        </Container>
    );
}
