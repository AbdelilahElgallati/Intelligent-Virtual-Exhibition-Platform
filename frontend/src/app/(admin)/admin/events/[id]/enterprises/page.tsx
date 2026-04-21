'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminService } from '@/services/admin.service';
import {
    EnterpriseRequestItem,
    EnterpriseRequestsResponse,
} from '@/types/participant';
import {
    Building2,
    CheckCircle2,
    XCircle,
    Search,
    ChevronLeft,
    RefreshCw,
    AlertCircle,
    X,
    CreditCard,
    History,
    User2,
    CheckCircle,
} from 'lucide-react';
import { formatInUserTZ } from '@/lib/timezone';
import { useTranslation } from 'react-i18next';

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { labelKey: string; cls: string }> = {
    pending_payment: { labelKey: 'admin.enterpriseJoinRequests.statusBadges.pendingPayment', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
    pending_admin_approval: { labelKey: 'admin.enterpriseJoinRequests.statusBadges.pendingAdminApproval', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    requested: { labelKey: 'admin.enterpriseJoinRequests.statusBadges.requested', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
    approved: { labelKey: 'admin.enterpriseJoinRequests.statusBadges.approved', cls: 'bg-green-50 text-green-700 border border-green-200' },
    rejected: { labelKey: 'admin.enterpriseJoinRequests.statusBadges.rejected', cls: 'bg-red-50 text-red-700 border border-red-200' },
};

function StatusBadge({ status }: { status: string }) {
    const { t } = useTranslation();
    const meta = STATUS_META[status] ?? { labelKey: '', cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200' };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
            {meta.labelKey ? t(meta.labelKey) : status}
        </span>
    );
}

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan?: string | null }) {
    const { t } = useTranslation();
    if (!plan) return <span className="text-zinc-400 text-sm">{t('admin.common.ui.emptyValue')}</span>;
    const cls =
        plan === 'enterprise' ? 'bg-violet-50 text-violet-700 border border-violet-200' :
            plan === 'pro' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                'bg-zinc-100 text-zinc-600 border border-zinc-200';
    return (
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
            {plan}
        </span>
    );
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({
    item,
    onConfirm,
    onCancel,
    isLoading,
}: {
    item: EnterpriseRequestItem;
    onConfirm: (reason: string) => void;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 w-full max-w-md shadow-xl mx-4">
                <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-red-50 border border-red-200">
                        <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-zinc-900">{t('admin.enterpriseJoinRequests.rejectModal.title')}</h3>
                        <p className="text-sm text-zinc-500 mt-0.5">
                            {t('admin.enterpriseJoinRequests.rejectModal.description', { name: item.organization?.name ?? item.user.email })}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="ml-auto p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                    {t('admin.enterpriseJoinRequests.rejectModal.reasonLabel')} <span className="font-normal text-zinc-400">{t('admin.enterpriseJoinRequests.rejectModal.reasonOptional')}</span>
                </label>
                <textarea
                    className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    rows={3}
                    placeholder={t('admin.enterpriseJoinRequests.rejectModal.reasonPlaceholder')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                    >
                        {t('common.actions.cancel')}
                    </button>
                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={isLoading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {t('admin.enterpriseJoinRequests.rejectModal.reject')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'error' }

let _toastId = 0;

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <tr className="border-b border-zinc-100">
            {[160, 120, 80, 80, 70, 80, 100].map((w, i) => (
                <td key={i} className="px-5 py-4">
                    <div className={`h-4 bg-zinc-100 rounded animate-pulse`} style={{ width: w }} />
                </td>
            ))}
        </tr>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
    { key: 'pending_admin_approval', labelKey: 'admin.enterpriseJoinRequests.tabs.awaitingApproval' },
    { key: 'pending_payment', labelKey: 'admin.enterpriseJoinRequests.tabs.pendingPayment' },
    { key: 'approved', labelKey: 'admin.enterpriseJoinRequests.tabs.approved' },
    { key: 'rejected', labelKey: 'admin.enterpriseJoinRequests.tabs.rejected' },
];

export default function EnterpriseRequestsPage() {
    const { t } = useTranslation();
    const { id: eventId } = useParams<{ id: string }>();
    const router = useRouter();

    const [data, setData] = useState<EnterpriseRequestsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeStatus, setActiveStatus] = useState('pending_admin_approval');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [eventName, setEventName] = useState<string | null>(null);

    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<EnterpriseRequestItem | null>(null);

    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (message: string, type: Toast['type']) => {
        const id = ++_toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    };

    const fetchData = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await adminService.getEnterpriseRequests(eventId, {
                status: activeStatus,
                search: search || undefined,
            });
            setData(result);
        } catch (e: unknown) {
            setError((e as Error)?.message ?? t('admin.enterpriseJoinRequests.failedToLoad'));
        } finally {
            setLoading(false);
        }
    }, [eventId, activeStatus, search, t]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Fetch event name
    useEffect(() => {
        if (!eventId) return;
        (async () => {
            try {
                const event = await adminService.getEventById(eventId);
                setEventName(event?.title || null);
            } catch { /* ignore */ }
        })();
    }, [eventId]);
    const handleSearch = () => setSearch(searchInput.trim());

    const handleApprove = async (item: EnterpriseRequestItem) => {
        const pid = item.participant.id;
        setActionLoading(pid);
        try {
            await adminService.approveEnterpriseRequest(eventId, pid);
            addToast(t('admin.enterpriseJoinRequests.approvedToast', { name: item.organization?.name ?? item.user.email }), 'success');
            await fetchData();
        } catch (e: unknown) {
            addToast((e as Error)?.message ?? t('admin.enterpriseJoinRequests.approveFailed'), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectConfirm = async (reason: string) => {
        if (!rejectTarget) return;
        const pid = rejectTarget.participant.id;
        setActionLoading(pid);
        try {
            await adminService.rejectEnterpriseRequest(eventId, pid, { reason: reason || undefined });
            addToast(t('admin.enterpriseJoinRequests.rejectedToast', { name: rejectTarget.organization?.name ?? rejectTarget.user.email }), 'success');
            setRejectTarget(null);
            await fetchData();
        } catch (e: unknown) {
            addToast((e as Error)?.message ?? t('admin.enterpriseJoinRequests.rejectFailed'), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const fmt = (d?: string) =>
        d ? formatInUserTZ(d, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-GB') : t('admin.common.ui.emptyValue');

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Toasts */}
            <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg border pointer-events-auto ${t.type === 'success'
                            ? 'bg-white border-green-200 text-green-700'
                            : 'bg-white border-red-200 text-red-700'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            {t.type === 'success'
                                ? <CheckCircle className="w-4 h-4 text-green-500" />
                                : <AlertCircle className="w-4 h-4 text-red-500" />}
                            {t.message}
                        </span>
                    </div>
                ))}
            </div>

            {/* Reject modal */}
            {rejectTarget && (
                <RejectModal
                    item={rejectTarget}
                    onConfirm={handleRejectConfirm}
                    onCancel={() => setRejectTarget(null)}
                    isLoading={actionLoading === rejectTarget.participant.id}
                />
            )}

            {/* Page header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.push('/admin/events')}
                    className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-zinc-900">{t('admin.enterpriseJoinRequests.title')}</h1>
                    <p className="text-xs text-zinc-400">{eventName || t('admin.enterpriseJoinRequests.eventPlaceholder', { id: eventId })}</p>
                </div>
                <button
                    onClick={() => fetchData()}
                    className="ml-auto p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors"
                    title={t('common.actions.refresh')}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Status tabs */}
                <div className="flex gap-1 bg-zinc-100 border border-zinc-200 rounded-xl p-1">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveStatus(tab.key)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === tab.key
                                ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                                : 'text-zinc-500 hover:text-zinc-700'
                                }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="flex flex-1 gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder={t('admin.enterpriseJoinRequests.searchPlaceholder')}
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        {t('common.actions.search')}
                    </button>
                    {search && (
                        <button
                            onClick={() => { setSearch(''); setSearchInput(''); }}
                            className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 border border-zinc-200 rounded-xl bg-white transition-colors"
                        >
                            {t('common.actions.clear')}
                        </button>
                    )}
                </div>
            </div>

            {/* Count */}
            {!loading && data && (
                <p className="text-sm text-zinc-500">
                    {t('admin.enterpriseJoinRequests.requestsFound', { total: data.total })}
                </p>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                    <button onClick={fetchData} className="ml-auto text-xs font-medium hover:underline">
                        {t('common.actions.retry')}
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-zinc-100">
                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{t('admin.enterpriseJoinRequests.table.enterprise')}</span>
                            </th>
                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                                <span className="flex items-center gap-1.5"><User2 className="w-3.5 h-3.5" />{t('admin.enterpriseJoinRequests.table.contact')}</span>
                            </th>
                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">
                                {t('admin.enterpriseJoinRequests.table.industry')}
                            </th>
                            {/* <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">
                                <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" />Plan</span>
                            </th> */}
                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">
                                <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{t('admin.enterpriseJoinRequests.table.history')}</span>
                            </th>
                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t('admin.enterpriseJoinRequests.table.status')}</th>
                            <th className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">{t('admin.enterpriseJoinRequests.table.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {loading && [1, 2, 3, 4, 5].map(n => <SkeletonRow key={n} />)}

                        {!loading && (!data || data.items.length === 0) && (
                            <tr>
                                <td colSpan={7} className="px-5 py-14 text-center">
                                    <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                                    <p className="text-zinc-500 font-medium">
                                        {t('admin.enterpriseJoinRequests.noRequests', { status: t(STATUS_TABS.find(t => t.key === activeStatus)?.labelKey || '') })}
                                    </p>
                                </td>
                            </tr>
                        )}

                        {!loading && data?.items.map(item => (
                            <tr key={item.participant.id} className="hover:bg-zinc-50/50 transition-colors">
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 font-bold border border-zinc-200">
                                            {item.organization?.name?.charAt(0) ?? item.user.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-zinc-900 truncate">{item.organization?.name ?? t('admin.common.ui.unnamedOrg')}</p>
                                            <p className="text-[11px] text-zinc-400 truncate">{item.organization?.country || t('admin.common.ui.emptyValue')}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <div className="min-w-0">
                                        <p className="text-zinc-900 font-medium truncate">{item.user.full_name}</p>
                                        <p className="text-[11px] text-zinc-400 truncate">{item.user.email}</p>
                                    </div>
                                </td>
                                <td className="px-5 py-4 hidden md:table-cell">
                                    <span className="text-zinc-600 truncate max-w-[120px] block">
                                        {item.organization?.industry || t('admin.common.ui.emptyValue')}
                                    </span>
                                </td>
                                {/* <td className="px-5 py-4 hidden lg:table-cell">
                                    <PlanBadge plan={item.subscription?.plan} />
                                </td> */}
                                <td className="px-5 py-4 hidden lg:table-cell">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-zinc-300" />
                                            {t('admin.enterpriseJoinRequests.table.joined')}: {fmt(item.participant.created_at)}
                                        </div>
                                        {item.participant.status === 'suspended' && (
                                            <div className="text-[10px] text-red-500 font-medium">
                                                {t('admin.enterpriseJoinRequests.table.suspended')}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-4">
                                    <StatusBadge status={item.participant.status} />
                                </td>
                                <td className="px-5 py-4">
                                    <div className="flex items-center gap-2">
                                        {item.participant.status === 'pending_admin_approval' || item.participant.status === 'requested' ? (
                                            <>
                                                <button
                                                    onClick={() => handleApprove(item)}
                                                    disabled={!!actionLoading}
                                                    className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                                    title={t('admin.enterpriseJoinRequests.approve')}
                                                >
                                                    {actionLoading === item.participant.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => setRejectTarget(item)}
                                                    disabled={!!actionLoading}
                                                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                                    title={t('admin.enterpriseJoinRequests.reject')}
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-xs text-zinc-400 font-medium">—</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && data && data.total > 0 && (
                    <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-100 text-xs text-zinc-400 font-medium">
                        {t('admin.enterpriseJoinRequests.pagination.showingResults', { shown: data.items.length, total: data.total })}
                    </div>
                )}
            </div>
        </div>
    );
}
