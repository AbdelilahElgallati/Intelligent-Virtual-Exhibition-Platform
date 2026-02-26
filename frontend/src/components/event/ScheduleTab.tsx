'use client';

import { Event, EventScheduleDay, EventScheduleSlot } from '@/types/event';
import { Calendar, Clock } from 'lucide-react';

interface ScheduleTabProps {
    event: Event | null;
}

/**
 * Attempts to parse event_timeline as JSON into EventScheduleDay[] format
 */
function parseEventTimeline(timeline: string | undefined): EventScheduleDay[] | null {
    if (!timeline) return null;
    try {
        const parsed = JSON.parse(timeline);
        if (Array.isArray(parsed)) {
            return parsed as EventScheduleDay[];
        }
        return null;
    } catch {
        // Not valid JSON, return null to display as free-text
        return null;
    }
}

/**
 * Formats time string from "HH:MM" to a more readable format
 */
function formatTime(time: string): string {
    if (!time) return '';
    // Already in HH:MM format, return as is
    return time;
}

export function ScheduleTab({ event }: ScheduleTabProps) {
    if (!event) {
        return (
            <div className="bg-white rounded-xl shadow p-12 text-center">
                <p className="text-gray-500">Loading event details...</p>
            </div>
        );
    }

    // Try to get structured schedule_days first
    let days: EventScheduleDay[] | null = event.schedule_days ?? null;

    // Fallback: try parsing event_timeline if it's JSON
    if (!days && event.event_timeline) {
        days = parseEventTimeline(event.event_timeline);
    }

    // If we have structured schedule data
    if (days && days.length > 0) {
        return (
            <div className="max-w-6xl mx-auto py-8 space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Event Schedule</h2>
                </div>

                {days.map((day, dayIndex) => (
                    <div
                        key={day.day_number || dayIndex}
                        className="bg-white rounded-xl shadow p-6"
                    >
                        {/* Day Header */}
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg">
                                <span className="text-indigo-700 font-bold text-lg">
                                    {day.day_number || dayIndex + 1}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Day {day.day_number || dayIndex + 1}
                                </h3>
                                {day.date_label && (
                                    <p className="text-sm text-gray-500">{day.date_label}</p>
                                )}
                            </div>
                        </div>

                        {/* Sessions */}
                        {(!day.slots || day.slots.length === 0) ? (
                            <p className="text-gray-500 italic text-center py-4">
                                No sessions scheduled for this day yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {day.slots.map((slot, slotIndex) => (
                                    <SessionSlot key={slotIndex} slot={slot} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // Fallback: display event_timeline as free-text if available
    if (event.event_timeline && typeof event.event_timeline === 'string') {
        return (
            <div className="max-w-6xl mx-auto py-8 space-y-8">
                <div className="flex items-center gap-3 mb-6">
                    <Calendar className="h-6 w-6 text-indigo-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Event Schedule</h2>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                    <div className="prose prose-gray max-w-none">
                        <pre className="whitespace-pre-wrap text-gray-700 font-sans text-base leading-relaxed">
                            {event.event_timeline}
                        </pre>
                    </div>
                </div>
            </div>
        );
    }

    // No schedule data available
    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="bg-white rounded-xl shadow p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No schedule available
                </h3>
                <p className="text-gray-500">
                    The event schedule has not been published yet. Check back later for updates.
                </p>
            </div>
        </div>
    );
}

/**
 * Individual session slot component
 */
function SessionSlot({ slot }: { slot: EventScheduleSlot }) {
    return (
        <div className="flex gap-4">
            {/* Time Column */}
            <div className="flex-shrink-0 w-24 text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-medium text-indigo-600">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(slot.start_time)}</span>
                </div>
                {slot.end_time && (
                    <div className="text-xs text-gray-400 mt-1">
                        to {formatTime(slot.end_time)}
                    </div>
                )}
            </div>

            {/* Timeline Connector */}
            <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-indigo-500 rounded-full border-2 border-white shadow"></div>
                <div className="w-0.5 flex-1 bg-indigo-200"></div>
            </div>

            {/* Session Card */}
            <div className="flex-1 pb-6">
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-indigo-500 hover:shadow-md transition-shadow">
                    <h4 className="font-medium text-gray-900">
                        {slot.label || 'Untitled Session'}
                    </h4>
                </div>
            </div>
        </div>
    );
}
