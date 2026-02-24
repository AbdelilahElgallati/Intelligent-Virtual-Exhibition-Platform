'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { AdminSubscription, SubscriptionPlan } from '@/types/admin';
import {
    CreditCard, RefreshCw, CheckCircle2, AlertCircle, X, ArrowUpDown,
} from 'lucide-react';

const PLAN_BADGE: Record<string, string> = {
    pro: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    free: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
};

function PlanBadge({ plan }: { plan: string }) {
    const cls = PLAN_BADGE[plan.toLowerCase()] ?? 'bg-zinc-100 text-zinc-600 border border-zinc-200';
    return (
        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${cls}`}>
            {plan}
        </span>
    );
}

export default function AdminSubscriptionsPage() {
    const [subs, setSubs] = useState<AdminSubscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchSubs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminService.getSubscriptions();
            setSubs(data);
        } catch (e: any) {
            setError(e.message ?? 'Failed to load subscriptions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSubs(); }, [fetchSubs]);

    const showSuccess = (msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(null), 3000);
    };

    const handleOverride = async (orgId: string, currentPlan: string, orgName: string) => {
        const newPlan: SubscriptionPlan = currentPlan.toLowerCase() === 'pro' ? 'free' : 'pro';
        setActionId(orgId);
        try {
            await adminService.overrideSubscription(orgId, newPlan);
            showSuccess(`${orgName} switched to ${newPlan.toUpperCase()}.`);
            fetchSubs();
        } catch (e: any) {
            setError(e.message ?? 'Action failed');
        } finally {
            setActionId(null);
        }
    };

    const handleCancel = async (orgId: string, orgName: string) => {
        setActionId(orgId);
        try {
            await adminService.cancelSubscription(orgId);
            showSuccess(`${orgName} subscription cancelled.`);
            fetchSubs();
        } catch (e: any) {
            setError(e.message ?? 'Action failed');
        } finally {
            setActionId(null);
        }
    };

    const total = subs.length;
    const proCount = subs.filter(s => s.plan.toLowerCase() === 'pro').length;
    const freeCount = total - proCount;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Subscriptions</h1>
                        <p className="text-xs text-zinc-500">View and override billing plans for any organization</p>
                    </div>
                </div>
                <button onClick={fetchSubs} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Stats */}
            {!loading && total > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Total Organizations', value: total, cls: 'text-zinc-900' },
                        { label: 'PRO Plans', value: proCount, cls: 'text-indigo-600' },
                        { label: 'FREE Plans', value: freeCount, cls: 'text-zinc-500' },
                    ].map(({ label, value, cls }) => (
                        <div key={label} className="bg-white border border-zinc-200 rounded-xl px-5 py-4">
                            <p className="text-xs text-zinc-500 mb-1">{label}</p>
                            <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Alerts */}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-zinc-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-emerald-400" />
                        Loading subscriptions…
                    </div>
                ) : subs.length === 0 ? (
                    <div className="p-12 text-center">
                        <CreditCard className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">No subscriptions found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Organization</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Plan</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                                <th className="px-6 py-3.5 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {subs.map((sub) => {
                                const busy = actionId === sub.organization_id;
                                const isFree = sub.plan.toLowerCase() === 'free';
                                return (
                                    <tr key={sub.organization_id} className="hover:bg-zinc-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-zinc-900">{sub.organization_name || sub.organization_id}</div>
                                            <div className="text-xs text-zinc-400 font-mono mt-0.5">{sub.organization_id.slice(0, 12)}…</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <PlanBadge plan={sub.plan} />
                                        </td>
                                        <td className="px-4 py-4 hidden md:table-cell">
                                            <span className={`inline-flex items-center gap-1 text-xs capitalize ${sub.status === 'active' ? 'text-emerald-600' : 'text-zinc-400'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${sub.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'
                                                    }`} />
                                                {sub.status ?? 'active'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOverride(sub.organization_id, sub.plan, sub.organization_name ?? '')}
                                                    disabled={busy}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors"
                                                >
                                                    <ArrowUpDown className="w-3 h-3" />
                                                    {isFree ? 'Upgrade' : 'Downgrade'}
                                                </button>
                                                <button
                                                    onClick={() => handleCancel(sub.organization_id, sub.organization_name ?? '')}
                                                    disabled={busy || isFree}
                                                    title={isFree ? 'Already on FREE plan' : 'Cancel to FREE'}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                {!loading && subs.length > 0 && (
                    <div className="px-6 py-3 border-t border-zinc-100 text-xs text-zinc-400">
                        {subs.length} organization{subs.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}
