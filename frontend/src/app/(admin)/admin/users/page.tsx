'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '@/services/admin.service';
import { User } from '@/types/user';
import {
    Users, RefreshCw, CheckCircle2, AlertCircle, X, Search, ChevronRight,
    Mail, Calendar, Briefcase, Tag, Globe, Bell, ShieldCheck, Ban,
} from 'lucide-react';

const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-rose-50   text-rose-700   border border-rose-200',
    organizer: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    visitor: 'bg-zinc-100  text-zinc-600   border border-zinc-200',
    enterprise: 'bg-amber-50  text-amber-700  border border-amber-200',
};

function RoleBadge({ role }: { role: string }) {
    const cls = ROLE_BADGE[role] ?? 'bg-zinc-100 text-zinc-600 border border-zinc-200';
    return <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${cls}`}>{role}</span>;
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
    return <span className="text-xs px-2.5 py-1 bg-zinc-100 text-zinc-600 rounded-full border border-zinc-200">{label}</span>;
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
    const initials = (user.full_name || user.email || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <>
            <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
            <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-zinc-200 flex flex-col shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 flex-shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                                {initials}
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-zinc-900">{user.full_name || '—'}</h2>
                                <p className="text-sm text-zinc-500">{user.email}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <RoleBadge role={user.role} />
                                    {user.is_active ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />Suspended
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
                    {/* Account */}
                    <Section icon={Mail} title="Account">
                        <div className="space-y-2.5 text-sm">
                            <div className="flex items-start gap-3">
                                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Username</span>
                                <span className="text-zinc-800 font-medium">@{user.username}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Joined</span>
                                <span className="text-zinc-800 font-medium">{fmt(user.created_at)}</span>
                            </div>
                            {user.language && (
                                <div className="flex items-start gap-3">
                                    <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Language</span>
                                    <span className="text-zinc-800 font-medium uppercase">{user.language}</span>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* Bio */}
                    {user.bio && (
                        <Section icon={Tag} title="Bio">
                            <p className="text-sm text-zinc-700 leading-relaxed">{user.bio}</p>
                        </Section>
                    )}

                    {/* Professional */}
                    {user.professional_info && Object.values(user.professional_info).some(Boolean) && (
                        <Section icon={Briefcase} title="Professional Info">
                            <div className="space-y-2.5 text-sm">
                                {user.professional_info.job_title && (
                                    <div className="flex items-start gap-3">
                                        <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Job title</span>
                                        <span className="text-zinc-800 font-medium">{user.professional_info.job_title}</span>
                                    </div>
                                )}
                                {user.professional_info.company && (
                                    <div className="flex items-start gap-3">
                                        <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Company</span>
                                        <span className="text-zinc-800 font-medium">{user.professional_info.company}</span>
                                    </div>
                                )}
                                {user.professional_info.industry && (
                                    <div className="flex items-start gap-3">
                                        <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Industry</span>
                                        <span className="text-zinc-800 font-medium">{user.professional_info.industry}</span>
                                    </div>
                                )}
                                {user.professional_info.experience_level && (
                                    <div className="flex items-start gap-3">
                                        <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">Experience</span>
                                        <span className="text-zinc-800 font-medium">{user.professional_info.experience_level}</span>
                                    </div>
                                )}
                            </div>
                        </Section>
                    )}

                    {/* Interests */}
                    {user.interests && user.interests.length > 0 && (
                        <Section icon={Tag} title="Interests">
                            <div className="flex flex-wrap gap-1.5">
                                {user.interests.map(i => <Chip key={i} label={i} />)}
                            </div>
                        </Section>
                    )}

                    {/* Event preferences */}
                    {user.event_preferences && (
                        <Section icon={Calendar} title="Event Preferences">
                            <div className="space-y-2.5">
                                {user.event_preferences.types?.length ? (
                                    <div>
                                        <p className="text-xs text-zinc-400 mb-1.5">Types</p>
                                        <div className="flex flex-wrap gap-1.5">{user.event_preferences.types.map(t => <Chip key={t} label={t} />)}</div>
                                    </div>
                                ) : null}
                                {user.event_preferences.languages?.length ? (
                                    <div>
                                        <p className="text-xs text-zinc-400 mb-1.5">Languages</p>
                                        <div className="flex flex-wrap gap-1.5">{user.event_preferences.languages.map(l => <Chip key={l} label={l} />)}</div>
                                    </div>
                                ) : null}
                                {user.event_preferences.regions?.length ? (
                                    <div>
                                        <p className="text-xs text-zinc-400 mb-1.5">Regions</p>
                                        <div className="flex flex-wrap gap-1.5">{user.event_preferences.regions.map(r => <Chip key={r} label={r} />)}</div>
                                    </div>
                                ) : null}
                            </div>
                        </Section>
                    )}

                    {/* Networking goals */}
                    {user.networking_goals && user.networking_goals.length > 0 && (
                        <Section icon={Globe} title="Networking Goals">
                            <div className="flex flex-wrap gap-1.5">
                                {user.networking_goals.map(g => <Chip key={g} label={g} />)}
                            </div>
                        </Section>
                    )}

                    {/* Engagement settings */}
                    {user.engagement_settings && (
                        <Section icon={Bell} title="Engagement Settings">
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600">Recommendations</span>
                                    <span className={`text-xs font-semibold ${user.engagement_settings.recommendations_enabled ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                        {user.engagement_settings.recommendations_enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600">Email notifications</span>
                                    <span className={`text-xs font-semibold ${user.engagement_settings.email_notifications ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                        {user.engagement_settings.email_notifications ? 'Enabled' : 'Disabled'}
                                    </span>
                                </div>
                            </div>
                        </Section>
                    )}
                </div>

                {/* Footer actions */}
                <div className="border-t border-zinc-100 px-6 py-4 flex-shrink-0 bg-zinc-50">
                    {user.is_active ? (
                        <button
                            onClick={() => onSuspend(user._id)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                            <Ban className="w-4 h-4" /> Suspend User
                        </button>
                    ) : (
                        <button
                            onClick={() => onActivate(user._id)}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <ShieldCheck className="w-4 h-4" /> Activate User
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

    const fetchUsers = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const data = await adminService.getUsers({ role: roleFilter || undefined, search: search || undefined });
            setUsers(data);
        } catch (e: any) { setError(e.message ?? 'Failed to load users'); }
        finally { setLoading(false); }
    }, [search, roleFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

    const handleSuspend = async (id: string) => {
        setActionId(id);
        try {
            await adminService.suspendUser(id);
            showSuccess('User suspended.');
            setSelected(null);
            fetchUsers();
        } catch (e: any) { setError(e.message ?? 'Action failed'); }
        finally { setActionId(null); }
    };

    const handleActivate = async (id: string) => {
        setActionId(id);
        try {
            await adminService.activateUser(id);
            showSuccess('User activated.');
            setSelected(null);
            fetchUsers();
        } catch (e: any) { setError(e.message ?? 'Action failed'); }
        finally { setActionId(null); }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900">User Management</h1>
                        <p className="text-xs text-zinc-500">Click any row to see full profile and take action</p>
                    </div>
                </div>
                <button onClick={fetchUsers} className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text" placeholder="Search by name or email…"
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                    className="text-sm border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All roles</option>
                    <option value="admin">Admin</option>
                    <option value="organizer">Organizer</option>
                    <option value="visitor">Visitor</option>
                    <option value="enterprise">Enterprise</option>
                </select>
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
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-violet-400" /> Loading users…
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                        <p className="text-zinc-500 font-medium">No users found</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-100">
                                <th className="text-left px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">User</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Role</th>
                                <th className="text-left px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                                <th className="px-6 py-3.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                            {users.map((u) => (
                                <tr key={u._id} onClick={() => setSelected(u)} className="hover:bg-zinc-50 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                {(u.full_name || u.email || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">{u.full_name || '—'}</div>
                                                <div className="text-xs text-zinc-400">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell"><RoleBadge role={u.role} /></td>
                                    <td className="px-4 py-4">
                                        {u.is_active ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />Suspended</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4">
                                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-indigo-400 transition-colors" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && users.length > 0 && (
                    <div className="px-6 py-3 border-t border-zinc-100 text-xs text-zinc-400">
                        {users.length} user{users.length !== 1 ? 's' : ''}
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
        </div>
    );
}
