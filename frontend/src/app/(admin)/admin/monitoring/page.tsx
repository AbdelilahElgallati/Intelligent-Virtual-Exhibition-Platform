'use client';

import { useEffect, useState, useCallback } from 'react';
import { Activity, Database, Server, Clock, RefreshCw, Plus, AlertTriangle, CheckCircle, XCircle, Minus } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { PlatformHealth, Incident, IncidentCreate } from '@/types/incident';

// ── Status helpers ─────────────────────────────────────────────────────────────
const statusIcon = (s: string) => {
    if (s === 'ok' || s === 'healthy') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (s === 'not_configured') return <Minus className="w-4 h-4 text-zinc-400" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
};
const statusBadge = (s: string) => {
    if (s === 'ok' || s === 'healthy') return 'bg-green-50 text-green-700 border border-green-200';
    if (s === 'not_configured') return 'bg-zinc-50 text-zinc-400 border border-zinc-200';
    return 'bg-red-50 text-red-700 border border-red-200';
};
const severityBadge: Record<string, string> = {
    low: 'bg-zinc-50 text-zinc-600 border border-zinc-200',
    medium: 'bg-amber-50 text-amber-700 border border-amber-200',
    high: 'bg-orange-50 text-orange-700 border border-orange-200',
    critical: 'bg-red-50 text-red-700 border border-red-200',
};
const incidentStatusBadge: Record<string, string> = {
    open: 'bg-red-50 text-red-700 border border-red-200',
    investigating: 'bg-amber-50 text-amber-700 border border-amber-200',
    mitigating: 'bg-orange-50 text-orange-700 border border-orange-200',
    resolved: 'bg-green-50 text-green-700 border border-green-200',
};

// ── Create Incident Modal ──────────────────────────────────────────────────────
function CreateIncidentModal({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (data: IncidentCreate) => Promise<void>;
}) {
    const [form, setForm] = useState<IncidentCreate>({ title: '', description: '', severity: 'medium' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const submit = async () => {
        if (!form.title.trim()) { setError('Title is required'); return; }
        setLoading(true);
        setError('');
        try {
            await onCreate(form);
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to create incident');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h2 className="text-base font-semibold text-zinc-900">Create Incident</h2>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">Title *</label>
                        <input
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder="Brief incident title"
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">Description</label>
                        <textarea
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                            rows={3}
                            placeholder="What happened?"
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-600 mb-1">Severity</label>
                        <select
                            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.severity}
                            onChange={e => setForm(f => ({ ...f, severity: e.target.value as IncidentCreate['severity'] }))}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">
                        Cancel
                    </button>
                    <button
                        onClick={submit}
                        disabled={loading}
                        className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? 'Creating…' : 'Create Incident'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MonitoringPage() {
    const [health, setHealth] = useState<PlatformHealth | null>(null);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [lastRefresh, setLastRefresh] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [h, inc] = await Promise.all([
                adminService.getHealth(),
                adminService.getIncidents({ limit: 20 }),
            ]);
            setHealth(h);
            setIncidents(inc);
            setLastRefresh(new Date().toLocaleTimeString());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load monitoring data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async (data: IncidentCreate) => {
        const newIncident = await adminService.createIncident(data);
        setIncidents(prev => [newIncident, ...prev]);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    const isDegraded = health?.status === 'degraded';

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {showCreate && (
                <CreateIncidentModal
                    onClose={() => setShowCreate(false)}
                    onCreate={handleCreate}
                />
            )}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">Platform Monitoring</h1>
                        <p className="text-zinc-500 text-sm mt-0.5">
                            Server health, database status, and incidents.
                            {lastRefresh && <span className="ml-2 text-zinc-400">Last refresh: {lastRefresh}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={load}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" /> Create Incident
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            {/* Degraded alert */}
            {isDegraded && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Platform degraded</strong> — one or more services are reporting issues. Consider creating an incident.</span>
                </div>
            )}

            {/* Health cards */}
            {health && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Overall */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Server className="w-4 h-4 text-zinc-400" />
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Overall</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusIcon(health.status)}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(health.status)}`}>
                                {health.status}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Uptime: {health.uptime}
                        </p>
                    </div>
                    {/* MongoDB */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-zinc-400" />
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">MongoDB</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusIcon(health.services.mongodb.status)}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(health.services.mongodb.status)}`}>
                                {health.services.mongodb.status}
                            </span>
                        </div>
                        {health.services.mongodb.latency_ms !== null && (
                            <p className="text-xs text-zinc-400 mt-2">Latency: {health.services.mongodb.latency_ms} ms</p>
                        )}
                    </div>
                    {/* Redis */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Database className="w-4 h-4 text-zinc-400" />
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Redis</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusIcon(health.services.redis.status)}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(health.services.redis.status)}`}>
                                {health.services.redis.status.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>
                    {/* API */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <Server className="w-4 h-4 text-zinc-400" />
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">API Process</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {statusIcon(health.services.api.status)}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(health.services.api.status)}`}>
                                {health.services.api.status}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">PID: {health.services.api.pid}</p>
                    </div>
                </div>
            )}

            {/* Incidents table */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700">Recent Incidents</h2>
                    <span className="text-xs text-zinc-400">{incidents.length} incidents</span>
                </div>
                {incidents.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-10">No incidents recorded.</p>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {incidents.map(inc => (
                            <div key={inc.id} className="px-5 py-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">{inc.title}</p>
                                    {inc.description && (
                                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{inc.description}</p>
                                    )}
                                    <p className="text-xs text-zinc-300 mt-0.5">{new Date(inc.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${severityBadge[inc.severity] ?? ''}`}>
                                        {inc.severity}
                                    </span>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${incidentStatusBadge[inc.status] ?? ''}`}>
                                        {inc.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
