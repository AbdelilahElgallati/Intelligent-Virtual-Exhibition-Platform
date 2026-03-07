'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { User } from '@/types/user';
import {
    Users, RefreshCw, CheckCircle2, AlertCircle, X, Search, ChevronRight,
    Mail, Calendar, Briefcase, Tag, Globe, Bell, ShieldCheck, Ban, UserPlus, Key, User as UserIcon,
    Hash
} from 'lucide-react';
import { Card } from '@/components/ui/Card';

const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-rose-50   text-rose-700   border border-rose-200',
    organizer: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    visitor: 'bg-slate-100  text-slate-600   border border-slate-200',
    enterprise: 'bg-amber-50  text-amber-700  border border-amber-200',
};

function RoleBadge({ role }: { role: string }) {
    const cls = ROLE_BADGE[role] ?? 'bg-slate-100 text-slate-600 border border-slate-200';
    return <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${cls}`}>{role}</span>;
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

function Chip({ label }: { label: string }) {
    return <span className="text-[10px] px-2 py-0.5 bg-zinc-50 text-zinc-500 rounded border border-zinc-100 font-medium uppercase tracking-wide">{label}</span>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3">
            <span className="text-xs text-zinc-400 w-32 flex-shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-zinc-800 font-medium break-words">{value}</span>
        </div>
    );
}

// ── Admin Creation Modal ──────────────────────────────────────────────────
function CreateAdminModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: '',
        email: '',
        username: '',
        password: '',
        role: 'admin'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            await adminService.createAdminAccount(form);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create administrator account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-[60]" onClick={onClose} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-zinc-900">New Administrator</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 uppercase px-1">Full Name</label>
                            <input
                                required
                                type="text" placeholder="John Doe"
                                value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-zinc-500 uppercase px-1">Email Address</label>
                            <input
                                required
                                type="email" placeholder="admin@ivep.platform"
                                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-zinc-500 uppercase px-1">Username</label>
                                <input
                                    required
                                    type="text" placeholder="jdoe_admin"
                                    value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-zinc-500 uppercase px-1">Password</label>
                                <input
                                    required
                                    type="password" placeholder="••••••••"
                                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-zinc-200 text-sm font-semibold text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center">
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

// ── User detail slide-over ──────────────────────────────────────────────────
function UserPanel({
    user,
    onClose,
    onSuspend,
    onActivate,
    busy,
}: {
    user: User;
    onClose: () => void;
    onSuspend: (id: string) => Promise<void>;
    onActivate: (id: string) => Promise<void>;
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
                            <h2 className="text-lg font-bold text-zinc-900 leading-tight">{user.full_name || 'Anonymous User'}</h2>
                            <div className="flex items-center flex-wrap gap-2">
                                <RoleBadge role={user.role} />
                                {user.is_active ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Account
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Suspended
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
                    {/* Account */}
                    <Section icon={UserIcon} title="Identity & Governance">
                        <div className="grid grid-cols-1 gap-y-3">
                            <InfoRow label="Email Address" value={user.email} />
                            <InfoRow label="Username handle" value={`@${user.username}`} />
                            <InfoRow label="Affiliation Date" value={fmt(user.created_at)} />
                        </div>
                    </Section>

                    {/* Bio */}
                    {user.bio && (
                        <Section icon={Hash} title="Professional Profile">
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">{user.bio}</p>
                        </Section>
                    )}

                    {/* Professional */}
                    {user.professional_info && Object.values(user.professional_info).some(Boolean) && (
                        <Section icon={Briefcase} title="Corporate Credentials">
                            <div className="grid grid-cols-1 gap-y-3">
                                <InfoRow label="Job Title" value={user.professional_info.job_title} />
                                <InfoRow label="Organization" value={user.professional_info.company} />
                                <InfoRow label="Industry" value={user.professional_info.industry} />
                                <InfoRow label="Experience" value={user.professional_info.experience_level} />
                            </div>
                        </Section>
                    )}

                    {/* Interests */}
                    {(((user.interests && user.interests.length > 0) || (user.networking_goals && user.networking_goals.length > 0))) && (
                        <Section icon={Tag} title="Ecosystem Engagement">
                            <div className="space-y-4">
                                {user.interests && user.interests.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {user.interests.map((i: string) => <Chip key={i} label={i} />)}
                                    </div>
                                )}
                                {user.networking_goals && user.networking_goals.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest px-0.5">Networking Objectives</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {user.networking_goals.map((g: string) => (
                                                <span key={g} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 font-semibold uppercase tracking-wide">{g}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}
                </div>

                {/* Footer actions */}
                <div className="border-t border-zinc-100 px-6 py-5 flex-shrink-0 bg-zinc-50">
                    {user.is_active ? (
                        <button
                            onClick={() => onSuspend(user._id)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                        >
                            <Ban className="w-4 h-4" /> Revoke Permissions
                        </button>
                    ) : (
                        <button
                            onClick={() => onActivate(user._id)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <ShieldCheck className="w-4 h-4" /> Restore Access
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [selected, setSelected] = useState<User | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    // Pagination
    const ITEMS_PER_PAGE = 15;
    const [currentPage, setCurrentPage] = useState(1);

    const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);

    const fetchUsers = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await adminService.getUsers({ role: roleFilter || undefined, search: search || undefined });
            setUsers(data);
        } catch (e: any) { setError(e.message ?? 'Failed to load user registry'); }
        finally { setLoading(false); }
    }, [search, roleFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Reset page on filter or search
    useEffect(() => { setCurrentPage(1); }, [search, roleFilter]);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    const handleSuspend = async (id: string) => {
        setActionId(id);
        try { await adminService.suspendUser(id); showSuccess('User privileges revoked.'); setSelected(null); fetchUsers(); }
        catch (e: any) { setError(e.message ?? 'Action failed'); }
        finally { setActionId(null); }
    };

    const handleActivate = async (id: string) => {
        setActionId(id);
        try { await adminService.activateUser(id); showSuccess('User privileges restored.'); setSelected(null); fetchUsers(); }
        catch (e: any) { setError(e.message ?? 'Action failed'); }
        finally { setActionId(null); }
    };

    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">User Governance</h1>
                        <p className="text-xs text-zinc-500">Access control and global registry</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                    >
                        <UserPlus size={14} /> Add Administrator
                    </button>
                    <button onClick={fetchUsers} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <input
                        type="text" placeholder="Search by name or email…"
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm placeholder:text-zinc-300 font-medium"
                    />
                </div>
                <select
                    value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                    className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-semibold uppercase text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm"
                >
                    <option value="">All Roles</option>
                    <option value="admin">Administrators</option>
                    <option value="organizer">Organizers</option>
                    <option value="visitor">Visitors</option>
                    <option value="enterprise">Enterprise</option>
                </select>
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
                {loading && users.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-indigo-400" /> Loading registry…
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">No accounts matched your search</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Identity</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Role</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                <th className="px-4 py-3.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {paginatedUsers.map((u: User) => (
                                <tr key={u._id} onClick={() => setSelected(u)} className="hover:bg-zinc-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 transition-colors">
                                                {(u.full_name || u.email || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 1)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">{u.full_name || 'Anonymous User'}</div>
                                                <div className="text-xs text-zinc-400 truncate max-w-[180px]">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell"><RoleBadge role={u.role} /></td>
                                    <td className="px-4 py-4">
                                        {u.is_active ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded border border-emerald-100">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500 bg-rose-50/50 px-2 py-0.5 rounded border border-rose-100">
                                                Blocked
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors ml-auto" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && users.length > 0 && (
                    <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-zinc-500">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, users.length)} of {users.length} account{users.length !== 1 ? 's' : ''} in registry
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
                <UserPanel
                    user={selected}
                    onClose={() => setSelected(null)}
                    onSuspend={handleSuspend}
                    onActivate={handleActivate}
                    busy={!!actionId}
                />
            )}

            {showCreate && <CreateAdminModal onClose={() => setShowCreate(false)} onSuccess={() => { fetchUsers(); showSuccess('New administrator account created.'); }} />}
        </div>
    );
}
