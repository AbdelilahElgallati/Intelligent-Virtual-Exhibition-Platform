'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { EventPayment } from '@/lib/api/types';
import { LoadingState } from '@/components/ui/LoadingState';
import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/auth';

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminPaymentsPage() {
    const [payments, setPayments] = useState<EventPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterStatus>('pending');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            const url =
                filter === 'all'
                    ? ENDPOINTS.ADMIN.PAYMENTS
                    : `${ENDPOINTS.ADMIN.PAYMENTS}?payment_status=${filter}`;
            const data = await apiClient.get<EventPayment[]>(url);
            setPayments(data);
        } catch (err) {
            console.error('Failed to fetch payments:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    const handleApprove = async (paymentId: string) => {
        try {
            setActionLoading(paymentId);
            await apiClient.patch(ENDPOINTS.ADMIN.APPROVE_PAYMENT(paymentId));
            await fetchPayments();
        } catch (err) {
            console.error('Failed to approve payment:', err);
            alert('Failed to approve payment.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (paymentId: string) => {
        try {
            setActionLoading(paymentId);
            await apiClient.patch(ENDPOINTS.ADMIN.REJECT_PAYMENT(paymentId), {
                admin_note: rejectNote || undefined,
            });
            setRejectingId(null);
            setRejectNote('');
            await fetchPayments();
        } catch (err) {
            console.error('Failed to reject payment:', err);
            alert('Failed to reject payment.');
        } finally {
            setActionLoading(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const statusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-amber-100 text-amber-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
        };
        return (
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-zinc-100 text-zinc-600'}`}>
                {status.toUpperCase()}
            </span>
        );
    };

    const handleViewProof = (paymentId: string) => {
        const token = getAccessToken();
        const url = getApiUrl(ENDPOINTS.ADMIN.VIEW_PAYMENT_PROOF(paymentId));
        // Open in new tab with auth - for images/PDFs we need to fetch and display
        // since the endpoint requires auth header
        fetchAndOpenProof(url, token);
    };

    const fetchAndOpenProof = async (url: string, token: string | null) => {
        try {
            const res = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) throw new Error('Failed to fetch proof');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch (err) {
            console.error('Failed to view proof:', err);
            alert('Failed to load payment proof.');
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Payment Reviews</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Review and manage visitor payment proof submissions.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-6">
                {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f
                                ? 'bg-indigo-600 text-white'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {loading ? (
                <LoadingState message="Loading payments..." />
            ) : payments.length === 0 ? (
                <div className="text-center py-16 text-zinc-400">
                    <div className="text-4xl mb-4">📋</div>
                    <p className="text-lg font-medium">No payments found</p>
                    <p className="text-sm">
                        {filter === 'pending'
                            ? 'No pending payments to review.'
                            : `No ${filter === 'all' ? '' : filter + ' '}payments found.`}
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-zinc-50 border-b border-zinc-200">
                                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">User</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Event</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Submitted</th>
                                <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {payments.map((p) => (
                                <tr key={p.id || p._id} className="hover:bg-zinc-50 transition-colors">
                                    <td className="px-5 py-4 text-sm text-zinc-700 font-mono">{p.user_id.slice(0, 12)}…</td>
                                    <td className="px-5 py-4 text-sm text-zinc-700 font-mono">{p.event_id.slice(0, 12)}…</td>
                                    <td className="px-5 py-4 text-sm font-semibold text-zinc-900">{p.amount.toFixed(2)} MAD</td>
                                    <td className="px-5 py-4">{statusBadge(p.status)}</td>
                                    <td className="px-5 py-4 text-sm text-zinc-500">{formatDate(p.created_at)}</td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex gap-2 justify-end items-center">
                                            {/* View Proof button - always visible */}
                                            <button
                                                onClick={() => handleViewProof(p.id || p._id)}
                                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
                                            >
                                                View
                                            </button>
                                            {p.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(p.id || p._id)}
                                                        disabled={actionLoading === (p.id || p._id)}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {actionLoading === (p.id || p._id) ? '…' : 'Approve'}
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectingId(p.id || p._id)}
                                                        disabled={actionLoading === (p.id || p._id)}
                                                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            {p.status === 'approved' && (
                                                <span className="text-xs text-green-600 font-medium">✓ Done</span>
                                            )}
                                            {p.status === 'rejected' && (
                                                <span className="text-xs text-red-500 font-medium" title={p.admin_note || ''}>
                                                    ✗ Rejected
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Reject Dialog */}
            {rejectingId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-zinc-900 mb-2">Reject Payment</h3>
                        <p className="text-sm text-zinc-500 mb-4">
                            Optionally provide a reason for rejection. The user will be notified.
                        </p>
                        <textarea
                            value={rejectNote}
                            onChange={(e) => setRejectNote(e.target.value)}
                            placeholder="Reason for rejection (optional)"
                            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-red-500/40 mb-4"
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setRejectingId(null); setRejectNote(''); }}
                                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(rejectingId)}
                                disabled={actionLoading === rejectingId}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                                {actionLoading === rejectingId ? 'Rejecting…' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
