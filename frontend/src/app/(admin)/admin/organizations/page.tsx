'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { AdminOrganization } from '@/types/admin';
import {
    Building2, RefreshCw, CheckCircle2, AlertCircle, X, ChevronRight,
    ShieldCheck, Flag, Ban, Calendar, User, Hash,
} from 'lucide-react';

function StatusBadges({ org }: { org: AdminOrganization }) {
    const badges = [];
    if (org.is_verified) badges.push(<span key="v" className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Verified</span>);
    if (org.is_flagged) badges.push(<span key="f" className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Flagged</span>);
    if (org.is_suspended) badges.push(<span key="s" className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Suspended</span>);
    return badges.length ? <div className="flex flex-wrap gap-1.5">{badges}</div> : <span className="text-xs text-zinc-400">—</span>;
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-100">
                <Icon className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</h3>
            </div>
            {children}
        </div>
    );
}

// ── Organization detail slide-over ──────────────────────────────────────────
function OrgPanel({
    org,
    onClose,
    onVerify,
    onFlag,
    onSuspend,
    busy,
}: {
    org: AdminOrganization;
    onClose: () => void;
    onVerify: (id: string) => Promise<void>;
    onFlag: (id: string) => Promise<void>;
    onSuspend: (id: string) => Promise<void>;
    busy: boolean;
}) {
    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const initials = (org.name || 'O').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
            <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-zinc-200 flex flex-col shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 text-sm font-bold flex-shrink-0">
                                {initials}
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-zinc-900">{org.name}</h2>
                                <div className="mt-1.5"><StatusBadges org={org} /></div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
                    <Section icon={Building2} title="Organization Info">
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Name</span>
                                <span className="text-zinc-800 font-medium">{org.name}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Created</span>
                                <span className="text-zinc-800 font-medium">{fmt(org.created_at)}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Owner ID</span>
                                <span className="text-zinc-800 font-mono text-xs break-all">{org.owner_id}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Org ID</span>
                                <span className="text-zinc-800 font-mono text-xs break-all">{org._id}</span>
                            </div>
                        </div>
                    </Section>

                    {org.description && (
                        <Section icon={Building2} title="Description">
                            <p className="text-sm text-zinc-700 leading-relaxed">{org.description}</p>
                        </Section>
                    )}

                    {/* Moderation status */}
                    <Section icon={ShieldCheck} title="Moderation Status">
                        <div className="space-y-2">
                            {[
                                { label: 'Verification', value: org.is_verified, on: 'Verified', off: 'Not verified', onCls: 'text-green-600', offCls: 'text-zinc-400' },
                                { label: 'Flag', value: org.is_flagged, on: 'Flagged', off: 'Not flagged', onCls: 'text-amber-600', offCls: 'text-zinc-400' },
                                { label: 'Suspension', value: org.is_suspended, on: 'Suspended', off: 'Active', onCls: 'text-red-600', offCls: 'text-emerald-600' },
                            ].map(({ label, value, on, off, onCls, offCls }) => (
                                <div key={label} className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0">
                                    <span className="text-sm text-zinc-600">{label}</span>
                                    <span className={`text-xs font-semibold ${value ? onCls : offCls}`}>{value ? on : off}</span>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>

                {/* Footer actions */}
                <div className="border-t border-zinc-100 px-6 py-4 flex-shrink-0 bg-zinc-50 space-y-2">
                    {!org.is_verified && (
                        <button
                            onClick={() => onVerify(org._id)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <ShieldCheck className="w-4 h-4" /> Verify Organization
                        </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onFlag(org._id)}
                            disabled={busy}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${org.is_flagged
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                }`}
                        >
                            <Flag className="w-4 h-4" /> {org.is_flagged ? 'Unflag' : 'Flag'}
                        </button>
                        <button
                            onClick={() => onSuspend(org._id)}
                            disabled={busy}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${org.is_suspended
                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                }`}
                        >
                            <Ban className="w-4 h-4" /> {org.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminOrganizationsPage() {
    const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [selected, setSelected] = useState<AdminOrganization | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchOrgs = useCallback(async () => {
        setLoading(true); setError(null);
        try { setOrgs(await adminService.getOrganizations()); }
        catch (e: any) { setError(e.message ?? 'Failed to load organizations'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    const act = async (id: string, fn: () => Promise<any>, label: string) => {
        setActionId(id);
        try { await fn(); showSuccess(label); setSelected(null); fetchOrgs(); }
        catch (e: any) { setError(e.message ?? 'Action failed'); }
        finally { setActionId(null); }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-sky-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Organization Management</h1>
                        <p className="text-xs text-zinc-500">Click any row to view details and take action</p>
                    </div>
                </div>
                <button onClick={fetchOrgs} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

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
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-sky-400" /> Loading organizations…
                    </div>
                ) : orgs.length === 0 ? (
                    <div className="p-12 text-center">
                        <Building2 className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">No organizations found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Organization</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Owner ID</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                <th className="px-6 py-3.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {orgs.map((org) => (
                                <tr key={org._id} onClick={() => setSelected(org)} className="hover:bg-zinc-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">{org.name}</div>
                                        {org.description && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{org.description}</div>}
                                    </td>
                                    <td className="px-4 py-4 hidden lg:table-cell">
                                        <span className="text-xs text-zinc-400 font-mono">{org.owner_id.slice(0, 12)}…</span>
                                    </td>
                                    <td className="px-4 py-4"><StatusBadges org={org} /></td>
                                    <td className="px-4 py-4">
                                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && orgs.length > 0 && (
                    <div className="px-6 py-3 border-t border-zinc-100 text-xs text-zinc-400">
                        {orgs.length} organization{orgs.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {selected && (
                <OrgPanel
                    org={selected}
                    onClose={() => setSelected(null)}
                    onVerify={id => act(id, () => adminService.verifyOrganization(id), `${selected.name} verified.`)}
                    onFlag={id => act(id, () => adminService.flagOrganization(id), `${selected.name} flag toggled.`)}
                    onSuspend={id => act(id, () => adminService.suspendOrganization(id), `${selected.name} suspension toggled.`)}
                    busy={!!actionId}
                />
            )}
        </div>
    );
}
