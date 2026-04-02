'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Conference } from '@/types/conference';
import { OrganizerEvent, EventScheduleDay, EventScheduleSlot } from '@/types/event';
import { Card } from '@/components/ui/Card';
import { Video, Mic, UserCheck, X } from 'lucide-react';
import { http } from '@/lib/http';
import { formatInTZ, getUserTimezone } from '@/lib/timezone';
import { formatSlotRangeLabel } from '@/lib/schedule';

interface Props {
    eventId: string;
    event: OrganizerEvent;
    onEventUpdated?: () => void;
}

interface EnterpriseOption {
    id?: string;
    _id?: string;
    user_id: string;
    organization_name?: string;
    full_name?: string;
}

export default function OrganizerEventConferences({ eventId, event, onEventUpdated }: Props) {
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [enterprises, setEnterprises] = useState<EnterpriseOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSlot, setEditingSlot] = useState<{ dayIdx: number; slotIdx: number } | null>(null);
    const [assignForm, setAssignForm] = useState({ assigned_enterprise_id: '', speaker_name: '', title: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const viewerTimeZone = getUserTimezone();

    const formatDayLabel = (dayNumber: number, dayIndex: number): string => {
        const dayOffset = Math.max(0, Number(dayNumber || (dayIndex + 1)) - 1);
        const tz = viewerTimeZone;
        const start = new Date(event.start_date || new Date().toISOString());
        if (Number.isNaN(start.getTime())) return 'Invalid date';

        // Build the base calendar day in the event timezone, then offset by day index.
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(start);

        const year = Number(parts.find((p) => p.type === 'year')?.value);
        const month = Number(parts.find((p) => p.type === 'month')?.value);
        const day = Number(parts.find((p) => p.type === 'day')?.value);
        if (!year || !month || !day) return 'Invalid date';

        const anchorUtcNoon = new Date(Date.UTC(year, month - 1, day + dayOffset, 12, 0, 0));
        return new Intl.DateTimeFormat('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            timeZone: tz,
        }).format(anchorUtcNoon);
    };

    const loadConferences = useCallback(async () => {
        try {
            const data = await http.get<Conference[]>(`/organizer/events/${eventId}/conferences`);
            setConferences(data);
        } catch {
            // conferences may not exist yet
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => { loadConferences(); }, [loadConferences]);

    // Load approved enterprise participants for this event
    useEffect(() => {
        async function loadEnterprises() {
            try {
                const data = await http.get<EnterpriseOption[]>(`/participants/event/${eventId}/enterprises`);
                setEnterprises(data);
            } catch (err) {
                console.error('Error loading enterprises:', err);
            }
        }
        loadEnterprises();
    }, [eventId]);

    // Parse schedule days from event
    let days: EventScheduleDay[] | null = event.schedule_days ?? null;
    if (!days && event.event_timeline) {
        try {
            const parsed = JSON.parse(event.event_timeline);
            if (Array.isArray(parsed)) days = parsed as EventScheduleDay[];
        } catch { /* legacy text */ }
    }

    const startEdit = (dayIdx: number, slotIdx: number, slot: EventScheduleSlot) => {
        setEditingSlot({ dayIdx, slotIdx });
        setAssignForm({
            assigned_enterprise_id: slot.assigned_enterprise_id || '',
            speaker_name: slot.speaker_name || '',
            title: slot.label || '',
        });
        setError(null);
    };

    const cancelEdit = () => {
        setEditingSlot(null);
        setError(null);
    };

    const saveAssignment = async (dayIdx: number, slotIdx: number) => {
        setSaving(true);
        setError(null);
        try {
            await http.patch(`/events/${eventId}/schedule/assign-conference`, {
                day_index: dayIdx,
                slot_index: slotIdx,
                is_conference: true,
                assigned_enterprise_id: assignForm.assigned_enterprise_id,
                speaker_name: assignForm.speaker_name || undefined,
                title: assignForm.title || undefined,
            });
            setEditingSlot(null);
            onEventUpdated?.();
            loadConferences();
        } catch (e: any) {
            setError(e.message || 'Failed to assign conference');
        } finally {
            setSaving(false);
        }
    };

    const removeAssignment = async (dayIdx: number, slotIdx: number) => {
        if (!confirm('Remove conference assignment from this slot?')) return;
        setSaving(true);
        try {
            await http.patch(`/events/${eventId}/schedule/assign-conference`, {
                day_index: dayIdx,
                slot_index: slotIdx,
                is_conference: false,
            });
            onEventUpdated?.();
            loadConferences();
        } catch (e: any) {
            setError(e.message || 'Failed to remove assignment');
        } finally {
            setSaving(false);
        }
    };

    const cancelConference = async (confId: string) => {
        if (!confirm('Cancel this conference?')) return;
        try {
            await http.delete(`/organizer/events/${eventId}/conferences/${confId}`);
            loadConferences();
        } catch { /* ignore */ }
    };

    return (
        <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2 mb-4">
                <Video className="w-4 h-4 text-violet-600" /> Conference Assignments
            </h2>

            {error && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {/* Schedule-based assignment UI */}
            {days && days.length > 0 ? (
                <div className="space-y-4 mb-6">
                    <p className="text-xs text-gray-500">
                        Click &quot;Assign Speaker&quot; on any slot to turn it into a live conference with an enterprise speaker.
                    </p>
                    {days.map((day, dayIdx) => (
                        <div key={day.day_number} className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                    {day.day_number}
                                </span>
                                <span className="text-sm font-semibold text-zinc-800">Day {day.day_number}</span>
                                <span className="text-xs text-zinc-500 ml-1">— {formatDayLabel(day.day_number, dayIdx)}</span>
                            </div>
                            <div className="p-3 space-y-2">
                                {day.slots.map((slot, slotIdx) => {
                                    const isEditing = editingSlot?.dayIdx === dayIdx && editingSlot?.slotIdx === slotIdx;
                                    return (
                                        <div key={slotIdx} className={`rounded-lg border p-3 ${slot.is_conference ? 'border-violet-200 bg-violet-50/60' : 'border-gray-200 bg-gray-50/50'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="shrink-0 text-xs font-semibold text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-md px-2 py-0.5 whitespace-nowrap tabular-nums">
                                                            {formatSlotRangeLabel(slot.start_time, slot.end_time)}
                                                        </span>
                                                        {slot.is_conference && (
                                                            <span className="text-xs font-bold text-violet-700 bg-violet-100 border border-violet-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                                                                <Mic className="w-3 h-3" /> Conference
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-zinc-700 font-medium">{slot.label || <em className="text-zinc-400">No description</em>}</p>
                                                    {slot.is_conference && slot.assigned_enterprise_name && (
                                                        <p className="text-xs text-violet-600 mt-1 flex items-center gap-1">
                                                            <UserCheck className="w-3 h-3" />
                                                            Speaker: {slot.speaker_name || slot.assigned_enterprise_name}
                                                            <span className="text-zinc-400 ml-1">({slot.assigned_enterprise_name})</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="shrink-0 flex items-center gap-1.5">
                                                    {slot.is_conference ? (
                                                        <>
                                                            <button onClick={() => startEdit(dayIdx, slotIdx, slot)} className="text-xs text-violet-600 hover:text-violet-800 font-medium px-2 py-1 rounded hover:bg-violet-100 transition-colors">
                                                                Edit
                                                            </button>
                                                            <button onClick={() => removeAssignment(dayIdx, slotIdx)} disabled={saving} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => startEdit(dayIdx, slotIdx, slot)} className="text-xs text-violet-600 hover:text-violet-800 font-semibold px-3 py-1.5 rounded-lg border border-violet-200 bg-white hover:bg-violet-50 transition-colors">
                                                            Assign Speaker
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Inline edit form */}
                                            {isEditing && (
                                                <div className="mt-3 pt-3 border-t border-violet-200 space-y-2">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Enterprise Speaker *</label>
                                                            <select
                                                                required
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                                value={assignForm.assigned_enterprise_id}
                                                                onChange={e => setAssignForm(f => ({ ...f, assigned_enterprise_id: e.target.value }))}
                                                            >
                                                                <option value="">— Select enterprise —</option>
                                                                {enterprises.map(ent => (
                                                                    <option key={ent.id || ent._id} value={ent.user_id}>
                                                                        {ent.organization_name || ent.full_name || ent.user_id}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-semibold text-gray-500 mb-1">Speaker Display Name</label>
                                                            <input
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                                value={assignForm.speaker_name}
                                                                onChange={e => setAssignForm(f => ({ ...f, speaker_name: e.target.value }))}
                                                                placeholder="Optional — defaults to enterprise name"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-1">
                                                        <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => saveAssignment(dayIdx, slotIdx)}
                                                            disabled={saving || !assignForm.assigned_enterprise_id}
                                                            className="px-4 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
                                                        >
                                                            {saving ? 'Saving…' : 'Save Assignment'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {day.slots.length === 0 && (
                                    <p className="text-xs text-zinc-400 italic px-1">No slots defined</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-4">No schedule defined for this event.</p>
            )}

            {/* Existing conferences list */}
            <div className="border-t border-gray-200 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">All Conferences</h3>
                {loading ? (
                    <div className="text-center py-6"><div className="animate-spin w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full mx-auto" /></div>
                ) : conferences.length === 0 ? (
                    <p className="text-sm text-gray-400 italic py-4 text-center">
                        No conferences yet. Assign an enterprise speaker to a schedule slot above.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {conferences.map(conf => {
                            const statusColors: Record<string, string> = {
                                scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                                live: 'bg-green-50 text-green-700 border-green-200',
                                ended: 'bg-gray-50 text-gray-500 border-gray-200',
                                canceled: 'bg-red-50 text-red-500 border-red-200',
                            };
                            return (
                                <div key={conf._id} className="flex items-start justify-between gap-3 p-3 border border-gray-100 rounded-xl bg-white">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColors[conf.status] || statusColors.scheduled}`}>
                                                {conf.status === 'live' ? '🔴 Live' : conf.status}
                                            </span>
                                            {conf.qa_enabled && <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">Q&A</span>}
                                        </div>
                                        <p className="font-semibold text-gray-900 text-sm truncate">{conf.title}</p>
                                        {conf.speaker_name && <p className="text-xs text-gray-500">🎙️ {conf.speaker_name}</p>}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {formatInTZ(conf.start_time, viewerTimeZone, 'dd MMM yyyy HH:mm')}
                                            {' → '}{formatInTZ(conf.end_time, viewerTimeZone, 'HH:mm')}
                                        </p>
                                        <p className="text-xs text-violet-600 mt-0.5">👥 {conf.attendee_count} registered</p>
                                    </div>
                                    {conf.status === 'scheduled' && (
                                        <button onClick={() => cancelConference(conf.id)} className="text-red-400 hover:text-red-600 text-xs font-medium shrink-0 mt-1">Cancel</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Card>
    );
}
