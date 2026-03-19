'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Event } from '@/types/event';
import { Stand, StandsListResponse } from '@/types/stand';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import {
    Users, Calendar, MessageCircle, Search, Briefcase, Target,
    Mail, Sparkles, UserCircle, X, ExternalLink,
} from 'lucide-react';

/* ── Types ── */

interface NetworkingTabProps {
    event: Event | null;
    eventId: string;
}

interface Attendee {
    id: string;
    _id?: string;
    full_name?: string;
    email: string;
    avatar_url?: string;
    role?: string;
    bio?: string;
    job_title?: string;
    company?: string;
    industry?: string;
    org_name?: string;
    org_website?: string;
    org_contact_email?: string;
    org_contact_phone?: string;
    org_city?: string;
    org_country?: string;
    interests?: string[];
    networking_goals?: string[];
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

/* ── Main Component ── */

export function NetworkingTab({ event, eventId }: NetworkingTabProps) {
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [stands, setStands] = useState<Stand[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loadingAttendees, setLoadingAttendees] = useState(true);
    const [loadingMeetings, setLoadingMeetings] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

    // Fetch attendees
    useEffect(() => {
        const fetchAttendees = async () => {
            try {
                const data = await apiClient.get<Attendee[]>(ENDPOINTS.PARTICIPANTS.ATTENDEES(eventId));
                const raw = Array.isArray(data) ? data : [];
                const normalized = raw
                    .map((item, index) => ({
                        ...item,
                        id: String(item?.id || item?._id || item?.email || `attendee-${index}`),
                    }))
                    // Guard against duplicate records for the same user participation.
                    .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index);
                setAttendees(normalized);
            } catch (error) {
                console.error('Failed to fetch attendees:', error);
                setAttendees([]);
            } finally {
                setLoadingAttendees(false);
            }
        };
        fetchAttendees();
    }, [eventId]);

    // Fetch stands (for meeting cards) + my meetings
    useEffect(() => {
        const fetchStands = async () => {
            try {
                const response = await apiClient.get<StandsListResponse>(ENDPOINTS.STANDS.LIST(eventId));
                setStands(response.items || []);
            } catch {
                setStands([]);
            }
        };
        const fetchMeetings = async () => {
            try {
                const response = await apiClient.get<Meeting[]>('/meetings/my-meetings');
                setMeetings(response || []);
            } catch {
                setMeetings([]);
            } finally {
                setLoadingMeetings(false);
            }
        };
        fetchStands();
        fetchMeetings();
    }, [eventId]);

    // Filter attendees by search
    const filtered = searchQuery
        ? attendees.filter((a) => {
              const q = searchQuery.toLowerCase();
              return (
                  (a.full_name || '').toLowerCase().includes(q) ||
                  (a.job_title || '').toLowerCase().includes(q) ||
                  (a.company || '').toLowerCase().includes(q) ||
                  (a.industry || '').toLowerCase().includes(q) ||
                  (a.interests || []).some((t) => t.toLowerCase().includes(q))
              );
          })
        : attendees;

    return (
        <div className="max-w-6xl mx-auto py-8 space-y-10">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <Users className="h-6 w-6 text-indigo-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Networking</h2>
                </div>
                <p className="text-sm text-gray-500">
                    Connect with people attending this event. Explore profiles, discover shared interests, and reach out.
                </p>
            </div>

            {/* Section 1: Attendees */}
            <section>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                    <div className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Attendees</h3>
                        {!loadingAttendees && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                {filtered.length}
                            </span>
                        )}
                    </div>
                    {/* Search */}
                    <div className="relative sm:ml-auto w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, role, company..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                    </div>
                </div>

                {loadingAttendees ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-2/3" />
                                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    </div>
                                </div>
                                <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((attendee, idx) => (
                            <AttendeeCard
                                key={`${attendee.id || attendee.email}-${idx}`}
                                attendee={attendee}
                                onReachOut={() => setSelectedAttendee(attendee)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                        <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">
                            {searchQuery ? 'No attendees match your search.' : 'No attendees have joined this event yet.'}
                        </p>
                    </div>
                )}
            </section>

            {/* Section 2: My Meetings */}
            <section>
                <div className="flex items-center gap-2 mb-5">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">My Meetings</h3>
                </div>

                {loadingMeetings ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse space-y-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : meetings.length > 0 ? (
                    <div className="space-y-3">
                        {meetings.map((meeting, idx) => (
                            <MeetingCard
                                key={`${meeting.id || meeting.start_time}-${idx}`}
                                meeting={meeting}
                                stands={stands}
                                eventId={eventId}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                        <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h4 className="text-base font-medium text-gray-900 mb-1">No meetings yet</h4>
                        <p className="text-sm text-gray-500">
                            Visit stands to request meetings with exhibitors.
                        </p>
                    </div>
                )}
            </section>

            {/* Tips */}
            <section className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    Networking Tips
                </h3>
                <ul className="space-y-1.5 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">•</span>
                        <span>Browse attendee profiles to find people with shared interests or complementary expertise.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">•</span>
                        <span>Use the chat feature on stand pages to connect directly with representatives.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-indigo-500 mt-0.5">•</span>
                        <span>Request meetings for in-depth discussions about potential collaborations.</span>
                    </li>
                </ul>
            </section>

            {selectedAttendee && (
                <AttendeeReachOutModal
                    attendee={selectedAttendee}
                    onClose={() => setSelectedAttendee(null)}
                />
            )}
        </div>
    );
}

/* ── Attendee Card ── */

function AttendeeCard({ attendee, onReachOut }: { attendee: Attendee; onReachOut: () => void }) {
    const initials = (attendee.full_name || attendee.email)
        .split(/[\s@]+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('');

    const roleBadge: Record<string, { label: string; cls: string }> = {
        visitor: { label: 'Visitor', cls: 'bg-blue-100 text-blue-700' },
        enterprise: { label: 'Enterprise', cls: 'bg-emerald-100 text-emerald-700' },
        organizer: { label: 'Organizer', cls: 'bg-purple-100 text-purple-700' },
        admin: { label: 'Admin', cls: 'bg-gray-100 text-gray-700' },
    };
    const badge = roleBadge[attendee.role || 'visitor'] || roleBadge.visitor;

    return (
        <div className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition p-5 flex flex-col">
            {/* Top row: avatar + name */}
            <div className="flex items-center gap-3 mb-3">
                {attendee.avatar_url ? (
                    <img
                        src={attendee.avatar_url}
                        alt={attendee.full_name || ''}
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-100"
                    />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-indigo-100">
                        {initials}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate text-sm">
                        {attendee.full_name || 'Anonymous'}
                    </h4>
                    {attendee.job_title && (
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            <Briefcase className="h-3 w-3 flex-shrink-0" />
                            {attendee.job_title}
                        </p>
                    )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                </span>
            </div>

            {/* Company & industry */}
            {(attendee.company || attendee.industry) && (
                <p className="text-xs text-gray-500 mb-2 truncate">
                    {[attendee.company, attendee.industry].filter(Boolean).join(' · ')}
                </p>
            )}

            {/* Bio */}
            {attendee.bio && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{attendee.bio}</p>
            )}

            {/* Interests */}
            {attendee.interests && attendee.interests.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {attendee.interests.slice(0, 5).map((interest, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {interest}
                        </span>
                    ))}
                    {attendee.interests.length > 5 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
                            +{attendee.interests.length - 5}
                        </span>
                    )}
                </div>
            )}

            {/* Networking goals */}
            {attendee.networking_goals && attendee.networking_goals.length > 0 && (
                <div className="flex items-start gap-1.5 mb-3">
                    <Target className="h-3 w-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-gray-500 line-clamp-1">
                        {attendee.networking_goals.join(', ')}
                    </p>
                </div>
            )}

            {/* Contact action */}
            <div className="mt-auto pt-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onReachOut}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
                >
                    <Mail className="h-3.5 w-3.5" />
                    Reach out
                </button>
            </div>
        </div>
    );
}

function AttendeeReachOutModal({ attendee, onClose }: { attendee: Attendee; onClose: () => void }) {
    const identity = attendee.full_name || attendee.company || attendee.email;
    const location = [attendee.org_city, attendee.org_country].filter(Boolean).join(', ');
    const roleLabel = attendee.role ? `${attendee.role[0].toUpperCase()}${attendee.role.slice(1)}` : 'Attendee';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-indigo-50/60">
                    <div>
                        <h4 className="text-base font-bold text-gray-900">Connect with {identity}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">Networking profile and contact options</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    <div className="flex items-start gap-3">
                        {attendee.avatar_url ? (
                            <img src={attendee.avatar_url} alt={identity} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center">
                                {(identity || 'A').slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{identity}</p>
                            <p className="text-xs text-gray-500">{roleLabel}</p>
                            {(attendee.job_title || attendee.company) && (
                                <p className="text-xs text-gray-600 mt-1 truncate">
                                    {[attendee.job_title, attendee.company || attendee.org_name].filter(Boolean).join(' · ')}
                                </p>
                            )}
                            {attendee.industry && (
                                <p className="text-xs text-gray-500 mt-0.5">Industry: {attendee.industry}</p>
                            )}
                            {location && <p className="text-xs text-gray-500 mt-0.5">Location: {location}</p>}
                        </div>
                    </div>

                    {attendee.bio && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">About</p>
                            <p className="text-sm text-gray-600 leading-relaxed">{attendee.bio}</p>
                        </div>
                    )}

                    {attendee.interests && attendee.interests.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Interests</p>
                            <div className="flex flex-wrap gap-1.5">
                                {attendee.interests.map((item, idx) => (
                                    <span key={`${item}-${idx}`} className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {attendee.networking_goals && attendee.networking_goals.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Networking goals</p>
                            <p className="text-sm text-gray-600">{attendee.networking_goals.join(', ')}</p>
                        </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                        <a
                            href={`mailto:${attendee.email}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                        >
                            <Mail className="h-3.5 w-3.5" /> Email
                        </a>

                        {attendee.org_contact_email && attendee.org_contact_email !== attendee.email && (
                            <a
                                href={`mailto:${attendee.org_contact_email}`}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-50"
                            >
                                <Mail className="h-3.5 w-3.5" /> Org Email
                            </a>
                        )}

                        {attendee.org_website && (
                            <a
                                href={attendee.org_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50"
                            >
                                <ExternalLink className="h-3.5 w-3.5" /> Website
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Meeting Card ── */

function MeetingCard({ meeting, stands, eventId }: { meeting: Meeting; stands: Stand[]; eventId: string }) {
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

        <div className="bg-white rounded-xl shadow p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Stand Logo */}
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: stand?.theme_color || '#f3f4f6' }}
            >
                {stand?.logo_url ? (
                    <img src={stand.logo_url} alt={stand.name} className="w-full h-full object-cover" />
                ) : (
                    <MessageCircle className="h-5 w-5 text-white opacity-80" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate text-sm">{stand?.name || 'Unknown Stand'}</h4>
                <p className="text-xs text-gray-500">{formatDate(meeting.start_time)}</p>
                {meeting.purpose && <p className="text-xs text-gray-400 truncate">{meeting.purpose}</p>}
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 sm:ml-auto">
                <span
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        statusColors[meeting.status] || 'bg-gray-100 text-gray-800'
                    }`}
                >
                    {meeting.status}
                </span>
                {stand && (
                    <Link
                        href={`/events/${eventId}/stands/${stand.id}`}
                        className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        View
                    </Link>
                )}
            </div>

            {meeting.status === 'approved' && (
                <div className="sm:ml-auto flex flex-col sm:items-end gap-2">
                    <span className="text-xs text-gray-400">
                        Waiting for the other side to join.
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            console.info('Meeting join is not implemented yet.');
                        }}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                    >
                        Join now
                    </button>
                </div>
            )}

            {meeting.status === 'pending' && (
                <div className="sm:ml-auto text-xs text-gray-400 font-medium">
                    Waiting for approval...
                </div>
            )}
        </div>
    );
}
