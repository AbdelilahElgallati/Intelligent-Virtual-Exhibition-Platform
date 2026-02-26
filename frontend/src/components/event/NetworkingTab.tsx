'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Event } from '@/types/event';
import { Stand, StandsListResponse } from '@/types/stand';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Building2, Users, Calendar, ExternalLink, MessageCircle } from 'lucide-react';

interface NetworkingTabProps {
    event: Event | null;
    eventId: string;
}

interface Meeting {
    id: string;
    visitor_id: string;
    stand_id: string;
    start_time: string;
    end_time: string;
    purpose?: string;
    status: 'pending' | 'approved' | 'rejected' | 'canceled' | 'completed';
    created_at: string;
}

export function NetworkingTab({ event, eventId }: NetworkingTabProps) {
    const [stands, setStands] = useState<Stand[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loadingStands, setLoadingStands] = useState(true);
    const [loadingMeetings, setLoadingMeetings] = useState(true);

    // Fetch exhibitors (stands) for this event
    useEffect(() => {
        const fetchStands = async () => {
            try {
                const response = await apiClient.get<StandsListResponse>(ENDPOINTS.STANDS.LIST(eventId));
                setStands(response.items || []);
            } catch (error) {
                console.error('Failed to fetch stands:', error);
                setStands([]);
            } finally {
                setLoadingStands(false);
            }
        };
        fetchStands();
    }, [eventId]);

    // Fetch user's meetings
    useEffect(() => {
        const fetchMeetings = async () => {
            try {
                const response = await apiClient.get<Meeting[]>('/meetings/my-meetings');
                // Filter to only show meetings for stands in this event
                setMeetings(response || []);
            } catch (error) {
                // User may not have any meetings or endpoint may not be available
                console.error('Failed to fetch meetings:', error);
                setMeetings([]);
            } finally {
                setLoadingMeetings(false);
            }
        };
        fetchMeetings();
    }, []);

    return (
        <div className="max-w-6xl mx-auto py-8 space-y-12">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-indigo-600" />
                <h2 className="text-2xl font-bold text-gray-900">Networking</h2>
            </div>

            {/* Section 1: Participating Enterprises */}
            <section>
                <div className="flex items-center gap-2 mb-6">
                    <Building2 className="h-5 w-5 text-gray-600" />
                    <h3 className="text-xl font-semibold text-gray-900">Participating Enterprises</h3>
                    {!loadingStands && (
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded-full">
                            {stands.length}
                        </span>
                    )}
                </div>

                {loadingStands ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : stands.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stands.map((stand) => (
                            <EnterpriseCard key={stand.id} stand={stand} eventId={eventId} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow p-8 text-center">
                        <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No enterprises have joined this event yet.</p>
                    </div>
                )}
            </section>

            {/* Section 2: My Meetings */}
            <section>
                <div className="flex items-center gap-2 mb-6">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <h3 className="text-xl font-semibold text-gray-900">My Meetings</h3>
                </div>

                {loadingMeetings ? (
                    <div className="bg-white rounded-xl shadow p-6 animate-pulse">
                        <div className="space-y-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                                        <div className="h-3 bg-gray-200 rounded w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : meetings.length > 0 ? (
                    <div className="space-y-4">
                        {meetings.map((meeting) => (
                            <MeetingCard key={meeting.id} meeting={meeting} stands={stands} eventId={eventId} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow p-8 text-center">
                        <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No meetings scheduled</h4>
                        <p className="text-gray-500">
                            Visit enterprise stands to request meetings with exhibitors.
                        </p>
                    </div>
                )}
            </section>

            {/* Section 3: Quick Tips */}
            <section className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💡 Networking Tips</h3>
                <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-1">•</span>
                        <span>Visit exhibition stands to learn about participating companies and their offerings.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-1">•</span>
                        <span>Use the chat feature on stand pages to connect directly with representatives.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-1">•</span>
                        <span>Request meetings for in-depth discussions about potential collaborations.</span>
                    </li>
                </ul>
            </section>
        </div>
    );
}

/**
 * Enterprise card component showing stand/company info
 */
function EnterpriseCard({ stand, eventId }: { stand: Stand; eventId: string }) {
    return (
        <div className="bg-white rounded-xl shadow hover:shadow-lg transition-shadow p-6">
            <div className="flex items-start gap-4">
                {/* Logo */}
                <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: stand.theme_color || '#f3f4f6' }}
                >
                    {stand.logo_url ? (
                        <img
                            src={stand.logo_url}
                            alt={stand.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Building2 className="h-8 w-8 text-white opacity-80" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{stand.name}</h4>
                    {stand.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                            {stand.category}
                        </span>
                    )}
                    {stand.description && (
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                            {stand.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
                <Link
                    href={`/events/${eventId}/stands/${stand.id}`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <ExternalLink className="h-4 w-4" />
                    Visit Stand
                </Link>
                {stand.website_url && (
                    <a
                        href={stand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                        title="Visit Website"
                    >
                        🌐
                    </a>
                )}
            </div>
        </div>
    );
}

/**
 * Meeting card component
 */
function MeetingCard({ meeting, stands, eventId }: { meeting: Meeting; stands: Stand[]; eventId: string }) {
    // Find the stand associated with this meeting
    const stand = stands.find((s) => s.id === meeting.stand_id);

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        canceled: 'bg-gray-100 text-gray-800',
        completed: 'bg-blue-100 text-blue-800',
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(dateStr));
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            {/* Stand Logo */}
            <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: stand?.theme_color || '#f3f4f6' }}
            >
                {stand?.logo_url ? (
                    <img
                        src={stand.logo_url}
                        alt={stand.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <MessageCircle className="h-6 w-6 text-white opacity-80" />
                )}
            </div>

            {/* Meeting Info */}
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                    {stand?.name || 'Unknown Stand'}
                </h4>
                <p className="text-sm text-gray-500">
                    {formatDate(meeting.start_time)}
                </p>
                {meeting.purpose && (
                    <p className="text-sm text-gray-400 truncate">{meeting.purpose}</p>
                )}
            </div>

            {/* Status Badge */}
            <span
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                    statusColors[meeting.status] || 'bg-gray-100 text-gray-800'
                }`}
            >
                {meeting.status}
            </span>

            {/* Action */}
            {stand && (
                <Link
                    href={`/events/${eventId}/stands/${stand.id}`}
                    className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    View
                </Link>
            )}
        </div>
    );
}
