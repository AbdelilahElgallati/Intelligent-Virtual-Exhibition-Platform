'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { Incident, IncidentCreate, IncidentUpdate, IncidentSeverity, IncidentStatus } from '@/types/incident';
import { formatInUserTZ } from '@/lib/timezone';

// ── Helpers ────────────────────────────────────────────────────────────────────
const SEVERITY_BADGE: Record<string, string> = {
    low: 'bg-zinc-50 text-zinc-600 border border-zinc-200',
    medium: 'bg-amber-50 text-amber-700 border border-amber-200',
    high: 'bg-orange-50 text-orange-700 border border-orange-200',
    critical: 'bg-red-50 text-red-700 border border-red-200',
};
const STATUS_BADGE: Record<string, string> = {
    open: 'bg-red-50 text-red-700 border border-red-200',
    investigating: 'bg-amber-50 text-amber-700 border border-amber-200',
    mitigating: 'bg-orange-50 text-orange-700 border border-orange-200',
    resolved: 'bg-green-50 text-green-700 border border-green-200',
};
const NEXT_STATUS: Record<IncidentStatus, IncidentStatus | null> = {
    open: 'investigating',
    investigating: 'mitigating',
    mitigating: 'resolved',
    resolved: null,
};

// ── Create modal ───────────────────────────────────────────────────────────────
function CreateModal({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (d: IncidentCreate) => Promise<void>;
}) {
    const { t } = useTranslation();
    const [form, setForm] = useState<IncidentCreate>({ title: '', description: '', severity: 'medium' });
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!form.title.trim()) { setErr(t('admin.monitoring.errors.titleRequired')); return; }
        setLoading(true);
        setErr('');
        try { await onCreate(form); onClose(); }
        catch (e: unknown) { setErr(e instanceof Error ? e.message : t('common.errors.actionFailed')); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h2 className="text-base font-semibold text-zinc-900">{t('admin.monitoring.actions.newIncident')}</h2>
                {err && <p className="text-sm text-red-600">{err}</p>}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">{t('admin.monitoring.field.title')} *</label>
                        <input className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            placeholder={t('admin.monitoring.field.titlePlaceholder')}
                            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">{t('admin.monitoring.field.description')}</label>
                        <textarea className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                            rows={3} placeholder={t('admin.monitoring.field.descriptionPlaceholder')}
                            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">{t('admin.monitoring.field.severity')}</label>
                        <select className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as IncidentSeverity }))}>
                            <option value="low">{t('admin.monitoring.severity.low')}</option>
                            <option value="medium">{t('admin.monitoring.severity.medium')}</option>
                            <option value="high">{t('admin.monitoring.severity.high')}</option>
                            <option value="critical">{t('admin.monitoring.severity.critical')}</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 pt-1">
                    <button onClick={onClose} className="flex-1 px-4 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50">{t('common.actions.cancel')}</button>
                    <button onClick={submit} disabled={loading} className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {loading ? t('admin.monitoring.actions.creating') : t('common.actions.create')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function IncidentPanel({ incident, onUpdate, onClose }: {
    incident: Incident;
    onUpdate: (id: string, data: IncidentUpdate) => Promise<void>;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const [notes, setNotes] = useState(incident.notes ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const advance = async () => {
        const next = NEXT_STATUS[incident.status];
        if (!next) return;
        setSaving(true);
        setErr('');
        try { await onUpdate(incident.id, { status: next, notes: notes || undefined }); }
        catch (e: unknown) { setErr(e instanceof Error ? e.message : t('common.errors.actionFailed')); }
        finally { setSaving(false); }
    };

    const saveNotes = async () => {
        setSaving(true);
        setErr('');
        try { await onUpdate(incident.id, { notes }); }
        catch (e: unknown) { setErr(e instanceof Error ? e.message : t('common.errors.actionFailed')); }
        finally { setSaving(false); }
    };

    const nextStatus = NEXT_STATUS[incident.status];

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-5">
                {/* Header */}
                <div>
                    <div className="flex items-start justify-between mb-1">
                        <h2 className="text-base font-semibold text-zinc-900 pr-4">{incident.title}</h2>
                        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">×</button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[incident.severity]}`}>{t(`admin.monitoring.severity.${incident.severity}`, { defaultValue: incident.severity })}</span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[incident.status]}`}>{t(`admin.monitoring.incidents.status.${incident.status}`, { defaultValue: incident.status })}</span>
                        <span className="text-[11px] text-zinc-400">{formatInUserTZ(incident.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    {incident.description && <p className="text-sm text-zinc-600 mt-2">{incident.description}</p>}
                </div>

                {err && <p className="text-sm text-red-600">{err}</p>}

                {/* Notes */}
                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">{t('admin.monitoring.field.adminNotes')}</label>
                    <textarea
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                        rows={4}
                        placeholder={t('admin.monitoring.field.adminNotesPlaceholder')}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button onClick={saveNotes} disabled={saving} className="flex-1 px-4 py-2 text-sm border border-zinc-200 rounded-lg text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
                        {t('admin.monitoring.actions.saveNotes')}
                    </button>
                    {nextStatus && (
                        <button onClick={advance} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {saving ? '…' : t(`admin.monitoring.actions.${nextStatus}`)}
                        </button>
                    )}
                    {!nextStatus && (
                        <div className="flex-1 px-4 py-2 text-sm text-center bg-green-50 text-green-700 border border-green-200 rounded-lg">
                            {t('admin.monitoring.status.resolvedCheck')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IncidentsPage() {
    const { t } = useTranslation();
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [selected, setSelected] = useState<Incident | null>(null);
    const [filterStatus, setFilterStatus] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminService.getIncidents({ status: filterStatus || undefined, limit: 50 });
            setIncidents(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : t('admin.incidents.errors.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [filterStatus, t]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async (data: IncidentCreate) => {
        const newInc = await adminService.createIncident(data);
        setIncidents(prev => [newInc, ...prev]);
    };

    const handleUpdate = async (id: string, data: IncidentUpdate) => {
        const updated = await adminService.updateIncident(id, data);
        setIncidents(prev => prev.map(i => i.id === id ? updated : i));
        setSelected(updated);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
            {selected && (
                <IncidentPanel
                    incident={selected}
                    onUpdate={handleUpdate}
                    onClose={() => setSelected(null)}
                />
            )}

            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900">{t('admin.incidents.title')}</h1>
                        <p className="text-zinc-500 text-sm mt-0.5">{t('admin.incidents.description')}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50">
                        <RefreshCw className="w-3.5 h-3.5" /> {t('common.actions.refresh')}
                    </button>
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <Plus className="w-3.5 h-3.5" /> {t('admin.monitoring.actions.newIncident')}
                    </button>
                </div>
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl self-start w-fit">
                {['', 'open', 'investigating', 'mitigating', 'resolved'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                        {s === '' ? t('admin.incidents.filters.all') : t(`admin.incidents.filters.${s}`)}
                    </button>
                ))}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

            {/* Incidents list */}
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-700">{t('admin.incidents.table.title')}</h2>
                    <span className="text-xs text-zinc-400">{t('admin.incidents.table.total', { count: incidents.length })}</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                    </div>
                ) : incidents.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-12">{t('admin.incidents.table.noIncidents')}</p>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {incidents.map(inc => (
                            <button
                                key={inc.id}
                                onClick={() => setSelected(inc)}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors text-left group"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 group-hover:text-indigo-600 transition-colors">{inc.title}</p>
                                    {inc.description && <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{inc.description}</p>}
                                    <p className="text-xs text-zinc-300 mt-0.5">{formatInUserTZ(inc.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[inc.severity] ?? ''}`}>
                                        {t(`admin.monitoring.severity.${inc.severity}`, { defaultValue: inc.severity })}
                                    </span>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[inc.status] ?? ''}`}>
                                        {t(`admin.monitoring.incidents.status.${inc.status}`, { defaultValue: inc.status })}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
