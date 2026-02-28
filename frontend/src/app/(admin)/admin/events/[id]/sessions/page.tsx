'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Play,
    Square,
    RefreshCcw,
    Calendar,
    Clock,
    User,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    ChevronRight,
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import { Session, SessionStatus, CreateSessionPayload } from '@/types/sessions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtDateKey(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(sessions: Session[]): Map<string, Session[]> {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
        const key = fmtDateKey(s.start_time);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(s);
    }
    return map;
}

function ElapsedTimer({ since }: { since: string }) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const base = Date.now() - new Date(since).getTime();
        setElapsed(Math.floor(base / 1000));
        const id = setInterval(() => setElapsed((prev) => prev + 1), 1000);
        return () => clearInterval(id);
    }, [since]);
    const h = Math.floor(elapsed / 3600).toString().padStart(2, '0');
    const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    return <span className="font-mono text-xs text-emerald-600 tabular-nums">{h}:{m}:{s}</span>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<SessionStatus, { label: string; cls: string; dot: string }> = {
    scheduled: { label: 'Scheduled', cls: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
    live: { label: 'LIVE', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    ended: { label: 'Ended', cls: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400' },
};

function StatusBadge({ status }: { status: SessionStatus }) {
    const c = STATUS_CFG[status];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
            {message}
        </div>
    );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel }: {
    title: string; message: string;
    onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-md mx-4 p-6">
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">{title}</h3>
                <p className="text-sm text-zinc-600 mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium text-white transition-colors">Confirm</button>
                </div>
            </div>
        </div>
    );
}

// ─── Timeline view ────────────────────────────────────────────────────────────

/** Return hour window [from, to] that covers all sessions on a day, padded ±1 h */
function getDayHourRange(daySessions: Session[]): [number, number] {
    let minH = 24;
    let maxH = 0;
    for (const s of daySessions) {
        const sh = new Date(s.start_time).getHours() + new Date(s.start_time).getMinutes() / 60;
        const eh = new Date(s.end_time).getHours() + new Date(s.end_time).getMinutes() / 60;
        if (sh < minH) minH = sh;
        if (eh > maxH) maxH = eh;
    }
    const from = Math.max(0, Math.floor(minH) - 1);
    const to = Math.min(24, Math.ceil(maxH) + 1);
    return [from, to];
}

function timePct(t: Date, from: number, to: number): number {
    const h = t.getHours() + t.getMinutes() / 60;
    return ((h - from) / (to - from)) * 100;
}

const BLOCK_STYLE: Record<SessionStatus, { bg: string; text: string; border: string; glow: string }> = {
    scheduled: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', glow: '' },
    live: { bg: 'bg-gradient-to-r from-emerald-500 to-teal-500', text: 'text-white', border: 'border-emerald-400', glow: 'shadow-md shadow-emerald-200' },
    ended: { bg: 'bg-gradient-to-r from-blue-400 to-indigo-400', text: 'text-white', border: 'border-blue-300', glow: '' },
};

function TimelineView({ sessions }: { sessions: Session[] }) {
    if (sessions.length === 0) return null;
    const grouped = groupByDay(sessions);

    return (
        <div className="space-y-8">
            {/* Legend */}
            <div className="flex items-center gap-5 flex-wrap text-xs text-zinc-500">
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded border border-slate-300 bg-slate-100 flex-shrink-0" />
                    Scheduled
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-emerald-500 to-teal-500 flex-shrink-0" />
                    Live
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded bg-gradient-to-r from-blue-400 to-indigo-400 flex-shrink-0" />
                    Ended
                </span>
            </div>

            {[...grouped.entries()].map(([, daySessions]) => {
                const dayLabel = fmtDate(daySessions[0].start_time);
                const [from, to] = getDayHourRange(daySessions);
                const hourCount = to - from;
                const hours = Array.from({ length: hourCount + 1 }, (_, i) => from + i);

                return (
                    <div key={dayLabel} className="space-y-2">
                        {/* Day header */}
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">{dayLabel}</p>
                            <div className="flex-1 h-px bg-zinc-100" />
                        </div>

                        {/* Gantt chart card */}
                        <div className="bg-zinc-50/80 rounded-xl border border-zinc-200 overflow-hidden">

                            {/* Time ruler */}
                            <div className="relative h-7 border-b border-zinc-200 bg-white select-none">
                                {hours.map((h) => {
                                    const leftPct = ((h - from) / hourCount) * 100;
                                    const label = `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? 'am' : 'pm'}`;
                                    return (
                                        <div
                                            key={h}
                                            className="absolute top-0 flex flex-col items-center"
                                            style={{ left: `${leftPct}%` }}
                                        >
                                            <div className="w-px h-2 bg-zinc-300" />
                                            <span className="text-[10px] text-zinc-400 font-mono -translate-x-1/2 whitespace-nowrap mt-0.5">
                                                {label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Session rows */}
                            <div className="relative px-3 py-3 space-y-2">
                                {/* Vertical hour grid */}
                                {hours.map((h) => (
                                    <div
                                        key={`vgrid-${h}`}
                                        className="absolute top-0 bottom-0 w-px bg-zinc-100 pointer-events-none"
                                        style={{ left: `${((h - from) / hourCount) * 100}%` }}
                                    />
                                ))}

                                {daySessions.map((s) => {
                                    const startD = new Date(s.start_time);
                                    const endD = new Date(s.end_time);
                                    const left = timePct(startD, from, to);
                                    const right = timePct(endD, from, to);
                                    const width = Math.max(right - left, 5);
                                    const c = BLOCK_STYLE[s.status];

                                    return (
                                        <div key={s.id} className="relative h-12">
                                            <div
                                                title={`${s.title} · ${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`}
                                                className={`absolute inset-y-1 rounded-lg border px-2.5 flex flex-col justify-center overflow-hidden cursor-default transition-all hover:brightness-95 ${c.bg} ${c.border} ${c.glow}`}
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {s.status === 'live' && (
                                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse flex-shrink-0" />
                                                    )}
                                                    <span className={`text-xs font-semibold truncate ${c.text}`}>
                                                        {s.title}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-mono leading-none opacity-80 ${c.text}`}>
                                                    {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
    session,
    onStart,
    onEnd,
    loading,
}: {
    session: Session;
    onStart: (id: string) => void;
    onEnd: (id: string) => void;
    loading: boolean;
}) {
    return (
        <div className={`rounded-xl border p-4 transition-all ${session.status === 'live'
                ? 'border-emerald-200 bg-emerald-50/50 shadow-sm'
                : session.status === 'ended'
                    ? 'border-blue-100 bg-blue-50/30'
                    : 'border-zinc-200 bg-white'
            }`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={session.status} />
                        {session.status === 'live' && session.started_at && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <Clock className="w-3 h-3" />
                                <ElapsedTimer since={session.started_at} />
                            </span>
                        )}
                        {session.status === 'live' && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Transcript Active
                            </span>
                        )}
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-900 leading-snug">{session.title}</h3>
                    {session.speaker && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <User className="w-3 h-3" /> {session.speaker}
                        </p>
                    )}
                    <p className="text-xs text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtTime(session.start_time)} – {fmtTime(session.end_time)} · {fmtDate(session.start_time)}
                    </p>
                    {session.description && (
                        <p className="text-xs text-zinc-400 mt-1">{session.description}</p>
                    )}
                </div>

                <div className="flex-shrink-0">
                    {session.status === 'scheduled' && (
                        <button
                            disabled={loading}
                            onClick={() => onStart(session.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            Start
                        </button>
                    )}
                    {session.status === 'live' && (
                        <button
                            disabled={loading}
                            onClick={() => onEnd(session.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                            End
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Create form ──────────────────────────────────────────────────────────────

function CreateSessionForm({
    eventId,
    onCreated,
    onSynced,
}: {
    eventId: string;
    onCreated: (s: Session) => void;
    onSynced: (sessions: Session[]) => void;
}) {
    const [open, setOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState<CreateSessionPayload>({
        title: '',
        speaker: '',
        description: '',
        start_time: '',
        end_time: '',
    });

    const handleChange = (key: keyof CreateSessionPayload, value: string) =>
        setForm((f) => ({ ...f, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.title || !form.start_time || !form.end_time) {
            setError('Title, start time, and end time are required.');
            return;
        }
        if (new Date(form.start_time) >= new Date(form.end_time)) {
            setError('Start time must be before end time.');
            return;
        }
        setSubmitting(true);
        try {
            // datetime-local gives "YYYY-MM-DDTHH:mm" without timezone.
            // Appending ":00Z" treats the picked time as UTC — avoids timezone shifts.
            const toISO = (local: string) =>
                local.includes('Z') ? local : local.length === 16 ? `${local}:00Z` : `${local}Z`;

            const created = await adminService.createSession(eventId, {
                ...form,
                start_time: toISO(form.start_time),
                end_time: toISO(form.end_time),
            });
            onCreated(created);
            setForm({ title: '', speaker: '', description: '', start_time: '', end_time: '' });
            setOpen(false);
        } catch (e: unknown) {
            setError((e as { message?: string })?.message ?? 'Failed to create session. Check dates are within event range.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const imported = await adminService.syncSessionsFromSchedule(eventId);
            onSynced(imported);
        } catch {
            /* ignore — parent toast handles it */
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-violet-500" />
                            Session Management
                        </h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Import from your event schedule or create manually → then hit{' '}
                            <span className="text-emerald-600 font-semibold">Start</span> on any scheduled session to go live.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            title="Import conference slots from event schedule"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            Import from Schedule
                        </button>
                        <button
                            onClick={() => setOpen((o) => !o)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-medium transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Session
                        </button>
                    </div>
                </div>
            </div>

            {/* Expandable create form */}
            {open && (
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 border-t border-zinc-100">
                    {error && (
                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-600">Title *</label>
                            <input
                                required
                                value={form.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                placeholder="Opening Keynote"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-600">Speaker</label>
                            <input
                                value={form.speaker}
                                onChange={(e) => handleChange('speaker', e.target.value)}
                                placeholder="Dr. Jane Smith"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-600">Start Time *</label>
                            <input
                                required
                                type="datetime-local"
                                value={form.start_time}
                                onChange={(e) => handleChange('start_time', e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-zinc-600">End Time *</label>
                            <input
                                required
                                type="datetime-local"
                                value={form.end_time}
                                onChange={(e) => handleChange('end_time', e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">Description</label>
                        <textarea
                            rows={2}
                            value={form.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Optional description..."
                            className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Create Session
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSessionsPage() {
    const { id: eventId } = useParams<{ id: string }>();
    const router = useRouter();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [mutatingId, setMutatingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [confirmEnd, setConfirmEnd] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchSessions = useCallback(async () => {
        try {
            const data = await adminService.getSessions(eventId);
            setSessions(data);
        } catch {
            // silent — first load error handled below
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchSessions();
        pollRef.current = setInterval(fetchSessions, 10_000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [fetchSessions]);

    const handleStart = async (sessionId: string) => {
        setMutatingId(sessionId);
        try {
            const updated = await adminService.startSession(sessionId);
            setSessions((prev) => prev.map((s) => s.id === sessionId ? updated : s));
            showToast('Session started', 'success');
        } catch (e: unknown) {
            showToast((e as { message?: string })?.message ?? 'Failed to start session', 'error');
        } finally {
            setMutatingId(null);
        }
    };

    const handleEnd = async (sessionId: string) => {
        setConfirmEnd(null);
        setMutatingId(sessionId);
        try {
            const updated = await adminService.endSession(sessionId);
            setSessions((prev) => prev.map((s) => s.id === sessionId ? updated : s));
            showToast('Session ended', 'success');
        } catch (e: unknown) {
            showToast((e as { message?: string })?.message ?? 'Failed to end session', 'error');
        } finally {
            setMutatingId(null);
        }
    };

    const handleCreated = (s: Session) => {
        setSessions((prev) =>
            [...prev, s].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        );
        showToast(`Session "${s.title}" created`, 'success');
    };

    const handleSynced = (imported: Session[]) => {
        if (imported.length === 0) {
            showToast('No new conference sessions found in schedule', 'success');
        } else {
            setSessions((prev) => {
                const ids = new Set(prev.map((s) => s.id));
                const merged = [...prev, ...imported.filter((s) => !ids.has(s.id))];
                return merged.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            });
            showToast(`Imported ${imported.length} session${imported.length > 1 ? 's' : ''} from schedule`, 'success');
        }
    };

    const liveSessions = sessions.filter((s) => s.status === 'live');
    const scheduledSessions = sessions.filter((s) => s.status === 'scheduled');
    const endedSessions = sessions.filter((s) => s.status === 'ended');

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

            {/* Header nav */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.push(`/admin/events/${eventId}`)}
                    className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 text-sm font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Event Details
                </button>
                <button
                    onClick={fetchSessions}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="Refresh"
                >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* Title bar */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-zinc-900">Conference Sessions</h1>
                    <p className="text-sm text-zinc-500">
                        {sessions.length > 0 ? `${sessions.length} session${sessions.length > 1 ? 's' : ''}` : 'No sessions yet'}
                        {liveSessions.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {liveSessions.length} live
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Session management panel */}
            <CreateSessionForm eventId={eventId} onCreated={handleCreated} onSynced={handleSynced} />

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-16 text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Loading sessions…
                </div>
            )}

            {/* Empty state */}
            {!loading && sessions.length === 0 && (
                <div className="bg-white rounded-2xl border border-dashed border-zinc-300 py-16 text-center">
                    <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                    <p className="text-zinc-500 font-medium text-sm">No sessions yet</p>
                    <p className="text-zinc-400 text-xs mt-1">
                        Create a session manually or use{' '}
                        <span className="font-medium text-violet-500">Import from Schedule</span> to auto-import conference slots.
                    </p>
                </div>
            )}

            {/* Timeline */}
            {!loading && sessions.length > 0 && (
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
                    <div className="px-5 py-4 border-b border-zinc-100">
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                            Timeline
                        </h2>
                    </div>
                    <div className="px-5 py-5">
                        <TimelineView sessions={sessions} />
                    </div>
                </div>
            )}

            {/* Live sessions */}
            {liveSessions.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Now ({liveSessions.length})
                    </h2>
                    {liveSessions.map((s) => (
                        <SessionCard
                            key={s.id}
                            session={s}
                            onStart={handleStart}
                            onEnd={(sid) => setConfirmEnd(sid)}
                            loading={mutatingId === s.id}
                        />
                    ))}
                </div>
            )}

            {/* Scheduled */}
            {scheduledSessions.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-400" />
                        Scheduled ({scheduledSessions.length})
                    </h2>
                    {scheduledSessions.map((s) => (
                        <SessionCard
                            key={s.id}
                            session={s}
                            onStart={handleStart}
                            onEnd={(sid) => setConfirmEnd(sid)}
                            loading={mutatingId === s.id}
                        />
                    ))}
                </div>
            )}

            {/* Ended */}
            {endedSessions.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        Ended ({endedSessions.length})
                    </h2>
                    {endedSessions.map((s) => (
                        <SessionCard
                            key={s.id}
                            session={s}
                            onStart={handleStart}
                            onEnd={(sid) => setConfirmEnd(sid)}
                            loading={mutatingId === s.id}
                        />
                    ))}
                </div>
            )}

            {/* Confirm end modal */}
            {confirmEnd && (
                <ConfirmModal
                    title="End session?"
                    message="This will end the live session and close the transcript WebSocket. This action cannot be undone."
                    onConfirm={() => handleEnd(confirmEnd)}
                    onCancel={() => setConfirmEnd(null)}
                />
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
    );
}
