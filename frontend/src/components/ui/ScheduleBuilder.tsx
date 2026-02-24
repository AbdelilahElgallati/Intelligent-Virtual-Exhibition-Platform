'use client';

import { useEffect } from 'react';
import { EventScheduleDay, EventScheduleSlot } from '@/types/event';
import { Plus, Trash2, Clock, GripVertical, CalendarDays } from 'lucide-react';

// ── Default slot ─────────────────────────────────────────────────────────────
const emptySlot = (): EventScheduleSlot => ({ start_time: '09:00', end_time: '17:00', label: '' });

// ── Date helpers ──────────────────────────────────────────────────────────────
/** "2026-02-24" → "Mon 24 Feb" */
function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00'); // force local time, no UTC shift
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Build array of YYYY-MM-DD strings between start and end (inclusive) */
function buildDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const cur = new Date(start + 'T00:00:00');
    const last = new Date(end + 'T00:00:00');
    while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

// ── Single slot row ───────────────────────────────────────────────────────────
function SlotRow({
    slot,
    onChange,
    onRemove,
    canRemove,
}: {
    slot: EventScheduleSlot;
    onChange: (updated: EventScheduleSlot) => void;
    onRemove: () => void;
    canRemove: boolean;
}) {
    const set = (patch: Partial<EventScheduleSlot>) => onChange({ ...slot, ...patch });

    return (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 bg-zinc-50 group hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
            {/* Drag handle (visual only) */}
            <GripVertical className="w-4 h-4 text-zinc-300 flex-shrink-0" />

            {/* Time range */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <input
                        type="time"
                        value={slot.start_time}
                        onChange={e => set({ start_time: e.target.value })}
                        className="text-sm font-medium text-zinc-700 focus:outline-none w-[80px] bg-transparent"
                    />
                </div>
                <span className="text-xs text-zinc-400 font-medium">→</span>
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg px-2 py-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <input
                        type="time"
                        value={slot.end_time}
                        onChange={e => set({ end_time: e.target.value })}
                        className="text-sm font-medium text-zinc-700 focus:outline-none w-[80px] bg-transparent"
                    />
                </div>
            </div>

            {/* Activity label */}
            <input
                type="text"
                placeholder="Activity / description…"
                value={slot.label}
                onChange={e => set({ label: e.target.value })}
                className="flex-1 min-w-0 text-sm bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400"
            />

            {/* Remove */}
            {canRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Remove slot"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

// ── Day card ──────────────────────────────────────────────────────────────────
function DayCard({
    day,
    onUpdate,
}: {
    day: EventScheduleDay;
    onUpdate: (updated: EventScheduleDay) => void;
}) {
    const addSlot = () => {
        const last = day.slots[day.slots.length - 1];
        const start = last?.end_time ?? '09:00';
        const [h, m] = start.split(':').map(Number);
        const endH = Math.min(h + 1, 23);
        const end = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onUpdate({ ...day, slots: [...day.slots, { start_time: start, end_time: end, label: '' }] });
    };

    const updateSlot = (idx: number, updated: EventScheduleSlot) => {
        const slots = [...day.slots];
        slots[idx] = updated;
        onUpdate({ ...day, slots });
    };

    const removeSlot = (idx: number) => {
        onUpdate({ ...day, slots: day.slots.filter((_, i) => i !== idx) });
    };

    const summary =
        day.slots.length > 0
            ? `${day.slots[0].start_time} → ${day.slots[day.slots.length - 1].end_time} · ${day.slots.length} slot${day.slots.length !== 1 ? 's' : ''}`
            : null;

    return (
        <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-white border-b border-zinc-100">
                <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                        {day.day_number}
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-800">Day {day.day_number}</span>
                            {day.date_label && (
                                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-0.5">
                                    {day.date_label}
                                </span>
                            )}
                        </div>
                        {summary && (
                            <p className="text-[11px] text-zinc-400 mt-0.5">{summary}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Slots */}
            <div className="p-4 space-y-2">
                {day.slots.length === 0 && (
                    <p className="text-xs text-zinc-400 text-center py-1.5">
                        No time slots yet — click <strong>+ Add Slot</strong> below
                    </p>
                )}
                {day.slots.map((slot, idx) => (
                    <SlotRow
                        key={idx}
                        slot={slot}
                        onChange={updated => updateSlot(idx, updated)}
                        onRemove={() => removeSlot(idx)}
                        canRemove={day.slots.length > 1}
                    />
                ))}

                {/* Add slot */}
                <button
                    type="button"
                    onClick={addSlot}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Time Slot
                </button>
            </div>
        </div>
    );
}

// ── Main ScheduleBuilder ──────────────────────────────────────────────────────
interface ScheduleBuilderProps {
    days: EventScheduleDay[];
    onChange: (days: EventScheduleDay[]) => void;
    /** YYYY-MM-DD — when provided together, auto-generates one day per calendar date */
    startDate?: string;
    endDate?: string;
}

export function ScheduleBuilder({ days, onChange, startDate, endDate }: ScheduleBuilderProps) {
    // Auto-regenerate day cards whenever the date range changes
    useEffect(() => {
        if (!startDate || !endDate || startDate > endDate) return;

        const dateList = buildDateRange(startDate, endDate);

        // Build new day array, preserving existing slots for matching day indices
        const newDays: EventScheduleDay[] = dateList.map((dateStr, i) => {
            const existing = days[i];
            return {
                day_number: i + 1,
                date_label: formatDateLabel(dateStr),
                slots: existing?.slots?.length ? existing.slots : [emptySlot()],
            };
        });

        onChange(newDays);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    const updateDay = (idx: number, updated: EventScheduleDay) => {
        const next = [...days];
        next[idx] = updated;
        onChange(next);
    };

    const datesSelected = Boolean(startDate && endDate && startDate <= endDate);

    if (!datesSelected) {
        return (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 py-10 flex flex-col items-center gap-2 text-zinc-400">
                <CalendarDays className="w-8 h-8 opacity-40" />
                <p className="text-sm font-medium">Select a start &amp; end date above</p>
                <p className="text-xs">Schedule days will be generated automatically from the date range.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {days.map((day, idx) => (
                <DayCard
                    key={idx}
                    day={day}
                    onUpdate={updated => updateDay(idx, updated)}
                />
            ))}
        </div>
    );
}
