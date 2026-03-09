import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { X, Calendar, Clock, CheckCircle, Info } from 'lucide-react';
import { EventScheduleDay } from '@/types/event';

interface MeetingRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    standId: string;
    standName: string;
    /** Optional event boundaries — when provided the pickers are constrained */
    eventStartDate?: string;
    eventEndDate?: string;
    scheduleDays?: EventScheduleDay[];
}

export function MeetingRequestModal({
    isOpen,
    onClose,
    standId,
    standName,
    eventStartDate,
    eventEndDate,
    scheduleDays,
}: MeetingRequestModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [loading, setLoading] = useState(false);

    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [message, setMessage] = useState('');

    /* ── Compute allowed dates ── */
    const allowedDates = useMemo(() => {
        if (!eventStartDate || !eventEndDate) return null;
        const dates: string[] = [];
        const start = new Date(eventStartDate);
        const end = new Date(eventEndDate);
        const cursor = new Date(start);
        while (cursor <= end) {
            dates.push(cursor.toISOString().split('T')[0]);
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }, [eventStartDate, eventEndDate]);

    const minDate = allowedDates?.[0] ?? new Date().toISOString().split('T')[0];
    const maxDate = allowedDates?.[allowedDates.length - 1] ?? undefined;

    /* ── Compute time slots for selected date ── */
    const timeSlots = useMemo(() => {
        if (!scheduleDays || scheduleDays.length === 0 || !date) return null;

        // Match by day index: first allowed date → day 1, etc.
        const dayIndex = allowedDates
            ? allowedDates.indexOf(date) + 1
            : undefined;

        const day = scheduleDays.find((d) => d.day_number === dayIndex);
        if (!day || day.slots.length === 0) return null;

        // Build 30-min slots within each schedule slot
        const slots: { value: string; label: string }[] = [];
        for (const slot of day.slots) {
            const [sh, sm] = slot.start_time.split(':').map(Number);
            const [eh, em] = slot.end_time.split(':').map(Number);
            const startMin = sh * 60 + sm;
            const endMin = eh * 60 + em;
            for (let m = startMin; m + 30 <= endMin; m += 30) {
                const hh = String(Math.floor(m / 60)).padStart(2, '0');
                const mm = String(m % 60).padStart(2, '0');
                slots.push({ value: `${hh}:${mm}`, label: `${hh}:${mm}` });
            }
        }
        return slots.length > 0 ? slots : null;
    }, [scheduleDays, date, allowedDates]);

    // Reset time when date changes (slot list may differ)
    const handleDateChange = (newDate: string) => {
        setDate(newDate);
        setTime('');
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const startTime = new Date(`${date}T${time}`);
            const endTime = new Date(startTime.getTime() + 30 * 60000);

            await apiClient.post(ENDPOINTS.MEETINGS.REQUEST, {
                visitor_id: user?._id || (user as any)?.id,
                stand_id: standId,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                purpose: message || 'General Inquiry',
            });
            setStep('success');
        } catch (error) {
            console.error('Failed to request meeting', error);
            alert('Failed to send request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {step === 'form' ? (
                    <>
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">Request Meeting</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Hint about schedule constraint */}
                            {allowedDates && (
                                <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        Meetings are limited to the event schedule
                                        ({allowedDates[0]} – {allowedDates[allowedDates.length - 1]}).
                                    </span>
                                </div>
                            )}

                            {/* Date picker */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                                {allowedDates ? (
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <select
                                            required
                                            value={date}
                                            onChange={(e) => handleDateChange(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
                                        >
                                            <option value="">Choose a date…</option>
                                            {allowedDates.map((d) => {
                                                const dayMatch = scheduleDays?.find(
                                                    (sd) => sd.day_number === allowedDates.indexOf(d) + 1,
                                                );
                                                const label = dayMatch?.date_label
                                                    ? `${d} — ${dayMatch.date_label}`
                                                    : d;
                                                return (
                                                    <option key={d} value={d}>
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                                            type="date"
                                            required
                                            min={minDate}
                                            max={maxDate}
                                            value={date}
                                            onChange={(e) => handleDateChange(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Time picker */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Time</label>
                                {timeSlots ? (
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <select
                                            required
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
                                        >
                                            <option value="">Choose a time slot…</option>
                                            {timeSlots.map((s) => (
                                                <option key={s.value} value={s.value}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                                            type="time"
                                            required
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                        {date && scheduleDays && scheduleDays.length > 0 && (
                                            <p className="mt-1 text-xs text-amber-600">
                                                No scheduled slots found for this date. You may pick any time.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                                <textarea
                                    rows={3}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Briefly describe what you'd like to discuss..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                />
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    disabled={loading}
                                >
                                    {loading ? 'Sending Request...' : 'Send Request'}
                                </Button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Request Sent!</h3>
                        <p className="text-gray-500 mb-6">
                            Your meeting request has been sent to <strong>{standName}</strong>. You will be notified when
                            they respond.
                        </p>
                        <Button onClick={onClose} variant="outline" className="w-full">
                            Close
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
