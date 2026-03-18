'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { LoadingState } from '@/components/ui/LoadingState';
import { adminService } from '@/services/admin.service';
import {
    FinancialTransaction,
    PayoutRecord,
    PayoutRecordStatus,
    PayoutStatus,
    ReceiverType,
    SourceType,
} from '@/types/finance';

type SelectValue<T extends string> = 'all' | T;
type ToastType = 'success' | 'error';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

let toastSequence = 0;

function formatDate(value: string | null): string { 
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
}

function formatAmount(amount: number, currency: string): string {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

function sourceLabel(source: SourceType): string {
    if (source === 'event_ticket') return 'Event Ticket';
    if (source === 'marketplace') return 'Marketplace';
    return 'Stand Fee';
}

function badgeClass(value: string): string {
    const v = value.toLowerCase();
    if (v === 'paid' || v === 'completed') return 'bg-green-100 text-green-800';
    if (v === 'pending' || v === 'processing') return 'bg-yellow-100 text-yellow-800';
    if (v === 'unpaid') return 'bg-gray-100 text-gray-700';
    if (v === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-zinc-100 text-zinc-700';
}

function getMetaString(tx: FinancialTransaction, key: string): string {
    const value = tx.metadata?.[key];
    return typeof value === 'string' ? value : '';
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error) {
        const msg = (error as { message?: unknown }).message;
        if (typeof msg === 'string' && msg.trim()) {
            return msg;
        }
    }
    return fallback;
}

function getPayoutId(payout: PayoutRecord): string {
    return payout.id || payout._id || '';
}

export default function AdminFinancePage() {
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    const [sourceType, setSourceType] = useState<SelectValue<SourceType>>('all');
    const [payoutStatus, setPayoutStatus] = useState<SelectValue<PayoutStatus>>('all');
    const [receiverType, setReceiverType] = useState<SelectValue<ReceiverType>>('all');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [editingPayout, setEditingPayout] = useState<PayoutRecord | null>(null);
    const [editNote, setEditNote] = useState('');
    const [editStatus, setEditStatus] = useState<PayoutRecordStatus>('completed');
    const [payoutActionLoadingId, setPayoutActionLoadingId] = useState<string | null>(null);
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = ++toastSequence;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3200);
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const txRes = await adminService.getFinanceTransactions({
                source_type: sourceType === 'all' ? undefined : sourceType,
                payout_status: payoutStatus === 'all' ? undefined : payoutStatus,
                receiver_type: receiverType === 'all' ? undefined : receiverType,
            });
            const payoutRes = await adminService.getFinancePayouts();
            setTransactions(txRes.items || []);
            setPayouts((payoutRes.items || []).map((item, index) => ({
                ...item,
                id: item.id || item._id || `${item.transaction_id}-${index}`,
            })));
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load finance data'));
        } finally {
            setLoading(false);
        }
    }, [sourceType, payoutStatus, receiverType]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const summary = useMemo(() => {
        return transactions.reduce(
            (acc, tx) => {
                acc.total += tx.amount || 0;
                if (tx.payout_status === 'paid') acc.settled += tx.amount || 0;
                if (tx.payout_status === 'unpaid') acc.unpaid += tx.amount || 0;
                return acc;
            },
            { total: 0, settled: 0, unpaid: 0 }
        );
    }, [transactions]);

    function openPayoutModal(tx: FinancialTransaction) {
        setSelectedTx(tx);
        setNote('');
        setIsModalOpen(true);
    }

    function closeModal() {
        setIsModalOpen(false);
        setSelectedTx(null);
        setNote('');
    }

    async function confirmPayout() {
        if (!selectedTx) return;
        try {
            setSubmittingId(selectedTx.id);
            await adminService.markFinancePayout(selectedTx.id, note.trim() || undefined);
            closeModal();
            await fetchAll();
        } catch (err: unknown) {
            alert(getErrorMessage(err, 'Failed to mark payout'));
        } finally {
            setSubmittingId(null);
        }
    }

    function openEditPayoutModal(payout: PayoutRecord) {
        setEditingPayout(payout);
        setEditNote(payout.note || '');
        setEditStatus(payout.status || 'completed');
    }

    function closeEditPayoutModal() {
        setEditingPayout(null);
        setEditNote('');
        setEditStatus('completed');
    }

    async function savePayoutEdits() {
        if (!editingPayout) return;
        const payoutId = getPayoutId(editingPayout);
        if (!payoutId) {
            addToast('Invalid payout id', 'error');
            return;
        }

        try {
            setPayoutActionLoadingId(payoutId);
            await adminService.updateFinancePayout(payoutId, {
                note: editNote,
                status: editStatus,
            });
            closeEditPayoutModal();
            await fetchAll();
            addToast('Payout history updated successfully', 'success');
        } catch (err: unknown) {
            addToast(getErrorMessage(err, 'Failed to update payout history'), 'error');
        } finally {
            setPayoutActionLoadingId(null);
        }
    }

    async function handleDeletePayout(payout: PayoutRecord) {
        const payoutId = getPayoutId(payout);
        if (!payoutId) {
            addToast('Invalid payout id', 'error');
            return;
        }

        const ok = window.confirm('Delete this payout history record? This action cannot be undone.');
        if (!ok) return;

        try {
            setPayoutActionLoadingId(payoutId);
            await adminService.deleteFinancePayout(payoutId);
            await fetchAll();
            addToast('Payout history deleted successfully', 'success');
        } catch (err: unknown) {
            addToast(getErrorMessage(err, 'Failed to delete payout history'), 'error');
        } finally {
            setPayoutActionLoadingId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Financial Dashboard</h1>
                    <p className="text-sm text-zinc-500">Unified transactions, payout settlement, and payout audit history.</p>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Total Volume</p>
                    <p className="mt-2 text-xl font-semibold text-zinc-900">{formatAmount(summary.total, 'MAD')}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Settled</p>
                    <p className="mt-2 text-xl font-semibold text-green-700">{formatAmount(summary.settled, 'MAD')}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Unpaid</p>
                    <p className="mt-2 text-xl font-semibold text-zinc-700">{formatAmount(summary.unpaid, 'MAD')}</p>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-3">
                    <label className="space-y-1 text-sm text-zinc-700">
                        <span className="text-xs uppercase tracking-wide text-zinc-500">Source Type</span>
                        <select
                            value={sourceType}
                            onChange={(e) => setSourceType(e.target.value as SelectValue<SourceType>)}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                        >
                            <option value="all">All</option>
                            <option value="event_ticket">Event Ticket</option>
                            <option value="marketplace">Marketplace</option>
                            <option value="stand_fee">Stand Fee</option>
                        </select>
                    </label>

                    <label className="space-y-1 text-sm text-zinc-700">
                        <span className="text-xs uppercase tracking-wide text-zinc-500">Payout Status</span>
                        <select
                            value={payoutStatus}
                            onChange={(e) => setPayoutStatus(e.target.value as SelectValue<PayoutStatus>)}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                        >
                            <option value="all">All</option>
                            <option value="unpaid">Unpaid</option>
                            <option value="processing">Processing</option>
                            <option value="paid">Paid</option>
                        </select>
                    </label>

                    <label className="space-y-1 text-sm text-zinc-700">
                        <span className="text-xs uppercase tracking-wide text-zinc-500">Receiver Type</span>
                        <select
                            value={receiverType}
                            onChange={(e) => setReceiverType(e.target.value as SelectValue<ReceiverType>)}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2"
                        >
                            <option value="all">All</option>
                            <option value="organizer">Organizer</option>
                            <option value="enterprise">Enterprise</option>
                            <option value="platform">Platform</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                {loading ? (
                    <div className="p-6">
                        <LoadingState message="Loading financial transactions..." />
                    </div>
                ) : error ? (
                    <div className="p-6 text-sm text-red-600">{error}</div>
                ) : transactions.length === 0 ? (
                    <div className="p-6 text-sm text-zinc-500">No transactions found for the selected filters.</div>
                ) : (
                    <div className="max-h-[30rem] overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                                    <th className="px-4 py-3 text-left font-semibold">Payer</th>
                                    <th className="px-4 py-3 text-left font-semibold">Receiver</th>
                                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                                    <th className="px-4 py-3 text-left font-semibold">Payout Status</th>
                                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="border-t border-zinc-100 hover:bg-zinc-50/70">
                                        <td className="px-4 py-3">{sourceLabel(tx.source_type)}</td>
                                        <td className="px-4 py-3 font-medium">{formatAmount(tx.amount, tx.currency)}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-xs">{tx.payer_id || '-'}</div>
                                            <div className="text-xs text-zinc-500">{getMetaString(tx, 'payer_name') || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-xs text-zinc-500">{tx.receiver_type}</div>
                                            <div className="font-mono text-xs">{tx.receiver_id || '-'}</div>
                                            <div className="text-xs text-zinc-500">{getMetaString(tx, 'receiver_name') || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(tx.status)}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeClass(tx.payout_status)}`}>
                                                {tx.payout_status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-600">{formatDate(tx.paid_at || tx.created_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            {tx.payout_status === 'unpaid' ? (
                                                <button
                                                    onClick={() => openPayoutModal(tx)}
                                                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700"
                                                >
                                                    Mark as Paid
                                                </button>
                                            ) : (
                                                <span className="text-xs text-zinc-500">No action</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-zinc-900">Payout History</h2>
                </div>
                {payouts.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-zinc-500">No payout records yet.</div>
                ) : (
                    <div className="max-h-[22rem] overflow-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-zinc-50 text-zinc-600">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Receiver</th>
                                    <th className="px-4 py-3 text-left font-semibold">Amount</th>
                                    <th className="px-4 py-3 text-left font-semibold">Admin</th>
                                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                                    <th className="px-4 py-3 text-left font-semibold">Note</th>
                                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.map((p, index) => (
                                    <tr key={`${p.id || p._id || p.transaction_id}-${index}`} className="border-t border-zinc-100">
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-xs">{p.receiver_id}</div>
                                            <div className="text-xs text-zinc-500">{p.receiver_name || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">{formatAmount(p.amount, 'MAD')}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-xs">{p.processed_by}</div>
                                            <div className="text-xs text-zinc-500">{p.processed_by_name || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-zinc-600">{formatDate(p.processed_at)}</td>
                                        <td className="px-4 py-3 text-xs text-zinc-700">{p.note || '-'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openEditPayoutModal(p)}
                                                    disabled={payoutActionLoadingId === getPayoutId(p)}
                                                    className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePayout(p)}
                                                    disabled={payoutActionLoadingId === getPayoutId(p)}
                                                    className="rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-900">Confirm Payout Settlement</h3>
                        <p className="mt-2 text-sm text-zinc-600">
                            You are settling {sourceLabel(selectedTx.source_type)} for {formatAmount(selectedTx.amount, selectedTx.currency)}.
                        </p>
                        <label className="mt-4 block text-sm text-zinc-700">
                            Optional note
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="mt-1 h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                                placeholder="Settlement note (optional)"
                            />
                        </label>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={closeModal}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmPayout}
                                disabled={submittingId === selectedTx.id}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                            >
                                {submittingId === selectedTx.id ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingPayout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-900">Edit Payout History</h3>
                        <p className="mt-1 text-xs text-zinc-500 font-mono">{getPayoutId(editingPayout)}</p>

                        <label className="mt-4 block text-sm text-zinc-700">
                            Status
                            <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as PayoutRecordStatus)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                            >
                                <option value="completed">Completed</option>
                                <option value="pending">Pending</option>
                            </select>
                        </label>

                        <label className="mt-3 block text-sm text-zinc-700">
                            Note
                            <textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="mt-1 h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                                placeholder="Edit note"
                            />
                        </label>

                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={closeEditPayoutModal}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={savePayoutEdits}
                                disabled={payoutActionLoadingId === getPayoutId(editingPayout)}
                                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
                            >
                                {payoutActionLoadingId === getPayoutId(editingPayout) ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed right-4 top-4 z-[60] space-y-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`min-w-[240px] max-w-[360px] rounded-lg border px-3 py-2 text-sm shadow-lg ${
                            toast.type === 'success'
                                ? 'border-green-300 bg-green-50 text-green-800'
                                : 'border-red-300 bg-red-50 text-red-800'
                        }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
