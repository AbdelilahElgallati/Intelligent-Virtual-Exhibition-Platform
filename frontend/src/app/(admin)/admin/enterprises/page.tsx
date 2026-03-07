'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { PartnerDashboardRead, AdminOrganization } from '@/types/admin';
import {
    Briefcase, RefreshCw, CheckCircle2, AlertCircle, X, ChevronRight,
    ShieldCheck, Flag, Ban, Calendar, User, Hash,
    TrendingUp, MousePointer2, MessageSquare, Mail, Globe,
    Building2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';

function StatusBadges({ org }: { org: AdminOrganization | PartnerDashboardRead }) {
    const badges = [];
    if (org.is_verified) badges.push(<span key="v" className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Verified</span>);
    if (org.is_flagged) badges.push(<span key="f" className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Flagged</span>);
    if (org.is_suspended) badges.push(<span key="s" className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Suspended</span>);
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

function InfoRow({ label, value, href }: { label: string; value?: string | null; href?: string }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3">
            <span className="text-xs text-zinc-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 font-medium hover:underline break-all">
                    {value}
                </a>
            ) : (
                <span className="text-sm text-zinc-800 font-medium break-words">{value}</span>
            )}
        </div>
    );
}

// ── Enterprise detail slide-over ──────────────────────────────────────────
function EnterprisePanel({
    org,
    onClose,
    onVerify,
    onFlag,
    onSuspend,
    busy,
}: {
    org: PartnerDashboardRead;
    onClose: () => void;
    onVerify: (id: string) => Promise<void>;
    onFlag: (id: string) => Promise<void>;
    onSuspend: (id: string) => Promise<void>;
    busy: boolean;
}) {
    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />
            <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white border-l border-zinc-200 flex flex-col shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 flex-shrink-0 bg-white">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold text-zinc-900 leading-tight">{org.name}</h2>
                            <div className="flex items-center flex-wrap gap-2">
                                <StatusBadges org={org} />
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-50 text-amber-700">
                                    Enterprise Partner
                                </span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
                    {/* Performance Stats */}
                    <Section icon={TrendingUp} title="Engagement Overview">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                                <Building2 className="w-4 h-4 text-zinc-400 mx-auto mb-1.5" />
                                <div className="text-lg font-bold text-zinc-900">{org.stats?.total_stands || 0}</div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Stands</div>
                            </div>
                            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                                <MousePointer2 className="w-4 h-4 text-zinc-400 mx-auto mb-1.5" />
                                <div className="text-lg font-bold text-zinc-900">{org.stats?.total_leads || 0}</div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Leads</div>
                            </div>
                            <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 text-center">
                                <MessageSquare className="w-4 h-4 text-zinc-400 mx-auto mb-1.5" />
                                <div className="text-lg font-bold text-zinc-900">{org.stats?.total_meetings || 0}</div>
                                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">Meetings</div>
                            </div>
                        </div>
                    </Section>

                    <Section icon={Briefcase} title="Exhibitor Profile">
                        <div className="grid grid-cols-1 gap-y-3">
                            <InfoRow label="Company Name" value={org.name} />
                            <InfoRow label="Join Date" value={fmt(org.created_at)} />
                            <InfoRow label="Industry" value={org.industry} />
                            <InfoRow label="Brand Website" value={org.website} href={org.website && !org.website.startsWith('http') ? `https://${org.website}` : org.website} />
                            <InfoRow label="Business Email" value={org.contact_email} href={org.contact_email ? `mailto:${org.contact_email}` : undefined} />
                        </div>
                    </Section>

                    <Section icon={User} title="Authorized Representative">
                        <div className="grid grid-cols-1 gap-y-3">
                            <InfoRow label="Full Name" value={org.owner_name} />
                            <InfoRow label="Direct Email" value={org.owner_email} href={org.owner_email ? `mailto:${org.owner_email}` : undefined} />
                        </div>
                    </Section>

                    {org.description && (
                        <Section icon={Hash} title="About Enterprise">
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{org.description}</p>
                        </Section>
                    )}

                    {/* Moderation status */}
                    <Section icon={ShieldCheck} title="Administrative Governance">
                        <div className="bg-zinc-50 rounded-xl overflow-hidden border border-zinc-100">
                            {[
                                { label: 'Verification Status', value: org.is_verified, on: 'Verified partner', off: 'Pending Review', onCls: 'text-emerald-600', offCls: 'text-zinc-500' },
                                { label: 'Flagged Content', value: org.is_flagged, on: 'Restricted', off: 'Clear', onCls: 'text-amber-600', offCls: 'text-emerald-600' },
                                { label: 'Operational Status', value: org.is_suspended, on: 'Suspended', off: 'Active', onCls: 'text-rose-600', offCls: 'text-emerald-600' },
                            ].map(({ label, value, on, off, onCls, offCls }) => (
                                <div key={label} className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100 last:border-0 bg-white">
                                    <span className="text-xs font-medium text-zinc-500">{label}</span>
                                    <span className={`text-xs font-semibold uppercase tracking-wide ${value ? onCls : offCls}`}>{value ? on : off}</span>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>

                {/* Footer actions */}
                <div className="border-t border-zinc-100 px-6 py-5 flex-shrink-0 bg-zinc-50 space-y-4">
                    {!org.is_verified && (
                        <button
                            onClick={() => onVerify(org._id || org.owner_id)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <ShieldCheck className="w-4 h-4" /> Verify Enterprise Account
                        </button>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={() => onFlag(org._id || org.owner_id)}
                            disabled={busy}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all disabled:opacity-50 ${org.is_flagged
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                                }`}
                        >
                            <Flag className="w-4 h-4" /> {org.is_flagged ? 'Unflag' : 'Flag'}
                        </button>
                        <button
                            onClick={() => onSuspend(org._id || org.owner_id)}
                            disabled={busy}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border transition-all disabled:opacity-50 ${org.is_suspended
                                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
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
export default function AdminEnterprisesPage() {
    const [enterprises, setEnterprises] = useState<PartnerDashboardRead[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [selected, setSelected] = useState<PartnerDashboardRead | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Pagination
    const ITEMS_PER_PAGE = 15;
    const [currentPage, setCurrentPage] = useState(1);

    const paginatedEnterprises = enterprises.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(enterprises.length / ITEMS_PER_PAGE);

    const fetchEnterprises = useCallback(async () => {
        setLoading(true); setError(null);
        try { setEnterprises(await adminService.getDetailedEnterprises()); }
        catch (e: any) { setError(e.message ?? 'Failed to load enterprises'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchEnterprises(); }, [fetchEnterprises]);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    const act = async (id: string, fn: () => Promise<any>, label: string) => {
        setActionId(id);
        try { await fn(); showSuccess(label); setSelected(null); fetchEnterprises(); }
        catch (e: any) { setError(e.message ?? 'Action failed'); }
        finally { setActionId(null); }
    };

    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                        <Briefcase className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">Enterprise Registry</h1>
                        <p className="text-xs text-zinc-500">Exhibitors and corporate participants</p>
                    </div>
                </div>
                <button
                    onClick={fetchEnterprises}
                    className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Alerts */}
            {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 animate-in fade-in slide-in-from-top-4">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 animate-in fade-in slide-in-from-top-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Registry Card */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-zinc-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-indigo-400" /> Loading registry…
                    </div>
                ) : enterprises.length === 0 ? (
                    <div className="p-12 text-center">
                        <Briefcase className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">No enterprises found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Company</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Industry</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {paginatedEnterprises.map((ent) => (
                                <tr key={ent._id || ent.owner_id} onClick={() => setSelected(ent)} className="hover:bg-zinc-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600 transition-colors">
                                                {(ent.name || 'E').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 1)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-zinc-900 group-hover:text-amber-600 transition-colors">{ent.name}</div>
                                                <div className="text-xs text-zinc-400 truncate max-w-[200px]">{ent.owner_email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 hidden lg:table-cell text-xs text-zinc-500">
                                        {ent.industry || 'Exhibition'}
                                    </td>
                                    <td className="px-4 py-4"><StatusBadges org={ent} /></td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-amber-400 transition-colors ml-auto" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && enterprises.length > 0 && (
                    <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-zinc-500">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, enterprises.length)} of {enterprises.length} enterprise{enterprises.length !== 1 ? 's' : ''}
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-medium text-zinc-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selected && (
                <EnterprisePanel
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
