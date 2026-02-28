'use client';

import { useEffect, useState, useCallback } from 'react';
import { ScrollText, RefreshCw, Search, Filter } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { AuditLog } from '@/types/audit';

const ACTION_ICONS: Record<string, string> = {
    'event.approve': '✅',
    'event.reject': '❌',
    'event.start': '🚀',
    'event.close': '🔒',
    'user.suspend': '🚫',
    'user.activate': '✔️',
    'organization.verify': '🏢',
    'organization.flag': '🚩',
    'organization.suspend': '🚫',
    'subscription.override': '💳',
    'incident.create': '⚠️',
    'incident.update': '📝',
};

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [actions, setActions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filters
    const [filterAction, setFilterAction] = useState('');
    const [filterEntity, setFilterEntity] = useState('');
    const [filterActorId, setFilterActorId] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [logsData, actionsData] = await Promise.all([
                adminService.getAuditLogs({
                    action: filterAction || undefined,
                    entity: filterEntity || undefined,
                    actor_id: filterActorId || undefined,
                    from_date: filterFromDate ? `${filterFromDate}T00:00:00` : undefined,
                    to_date: filterToDate ? `${filterToDate}T23:59:59` : undefined,
                    limit: 100,
                }),
                actions.length === 0 ? adminService.getAuditActions() : Promise.resolve(actions),
            ]);
            setLogs(logsData);
            if (actions.length === 0) setActions(actionsData);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    }, [filterAction, filterEntity, filterActorId, filterFromDate, filterToDate]);

    useEffect(() => { load(); }, []);

    const applyFilters = (e: React.FormEvent) => { e.preventDefault(); load(); };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                    <ScrollText className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Audit Logs</h1>
                    <p className="text-zinc-500 text-sm mt-0.5">Full governance trail — every admin action, timestamped.</p>
                </div>
            </div>

            {/* Filters */}
            <form onSubmit={applyFilters} className="bg-white border border-zinc-200 rounded-2xl p-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-40">
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Action</label>
                        <select
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={filterAction}
                            onChange={e => setFilterAction(e.target.value)}
                        >
                            <option value="">All actions</option>
                            {actions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 min-w-32">
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Entity type</label>
                        <select
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={filterEntity}
                            onChange={e => setFilterEntity(e.target.value)}
                        >
                            <option value="">All entities</option>
                            <option value="event">Event</option>
                            <option value="user">User</option>
                            <option value="organization">Organization</option>
                            <option value="subscription">Subscription</option>
                            <option value="incident">Incident</option>
                        </select>
                    </div>
                    <div className="flex-1 min-w-44">
                        <label className="block text-xs font-medium text-zinc-500 mb-1">
                            <Filter className="inline w-3 h-3 mr-1" />Actor ID
                        </label>
                        <input
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="User ID…"
                            value={filterActorId}
                            onChange={e => setFilterActorId(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">From</label>
                        <input type="date" className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">To</label>
                        <input type="date" className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={filterToDate} onChange={e => setFilterToDate(e.target.value)} />
                    </div>
                    <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
                        <Search className="w-3.5 h-3.5" /> Apply
                    </button>
                    <button
                        type="button"
                        onClick={load}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 text-sm rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </form>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            {/* Logs table */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700">Log Entries</h2>
                    <span className="text-xs text-zinc-400">{logs.length} entries</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    </div>
                ) : logs.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-12">No audit log entries found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-100 text-left">
                                    <th className="py-3 px-5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Timestamp</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Action</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Entity</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actor ID</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                                        <td className="py-3 px-5 text-zinc-500 text-xs whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span>{ACTION_ICONS[log.action] ?? '•'}</span>
                                                <span className="font-mono text-xs text-zinc-700">{log.action}</span>
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="flex flex-col gap-0.5">
                                                <span className="text-xs text-zinc-700 font-medium capitalize">{log.entity}</span>
                                                {log.entity_id && (
                                                    <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[100px]">{log.entity_id}</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-400 truncate max-w-[120px]">
                                            {log.actor_id}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-zinc-500">
                                            {log.metadata && Object.keys(log.metadata).length > 0
                                                ? Object.entries(log.metadata)
                                                    .filter(([, v]) => v != null)
                                                    .map(([k, v]) => `${k}: ${v}`)
                                                    .join(' · ')
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
