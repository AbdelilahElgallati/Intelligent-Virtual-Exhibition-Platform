import { formatInTZ } from '@/lib/timezone';

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
    _id?: string;
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
    const { user } = useAuth();
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [stands, setStands] = useState<Stand[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loadingAttendees, setLoadingAttendees] = useState(true);
    const [loadingMeetings, setLoadingMeetings] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);

    const eventTimeZone = event?.event_timezone || 'UTC';

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
                    .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
                    // Exclude the current user from the networking list.
                    .filter((item) => {
                        const currentUserId = user?.id || user?._id;
                        return item.id !== currentUserId && item.email !== user?.email;
                    });
                setAttendees(normalized);
            } catch (error) {
                console.error('Failed to fetch attendees:', error);
                setAttendees([]);
            } finally {
                setLoadingAttendees(false);
            }
        };
        fetchAttendees();
    }, [eventId, user?.id, user?._id, user?.email]);

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
        <div className="max-w-7xl mx-auto py-10 px-4 md:px-6 space-y-12">
            {/* Header */}
            <div className="relative overflow-hidden rounded-3xl bg-white/40 backdrop-blur-xl border border-white/40 p-8 shadow-2xl shadow-indigo-500/5">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                                <Users size={24} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Networking</h2>
                        </div>
                        <p className="text-slate-500 max-w-xl font-medium leading-relaxed">
                            Connect with fellow attendees, discover shared interests, and build professional relationships in real-time.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Section 1: Attendees List */}
                <section className="lg:col-span-2 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">Attendees</h3>
                            {!loadingAttendees && (
                                <span className="px-3 py-1 bg-white/60 backdrop-blur-md text-indigo-700 text-[10px] rounded-full font-black border border-indigo-100 uppercase tracking-wider">
                                    {filtered.length} Active
                                </span>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative w-full sm:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search industry, name, role..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-2xl border-none bg-white/60 backdrop-blur-md text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 shadow-sm"
                            />
                        </div>
                    </div>

                    {loadingAttendees ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white/40 backdrop-blur-xl rounded-3xl border border-white/60 p-6 animate-pulse space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-200 rounded-2xl" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-slate-200 rounded w-2/3" />
                                            <div className="h-3 bg-slate-100 rounded w-1/2" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-slate-100 rounded w-full" />
                                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filtered.map((attendee, idx) => (
                                <AttendeeCard
                                    key={`${attendee.id || attendee.email}-${idx}`}
                                    attendee={attendee}
                                    onReachOut={() => setSelectedAttendee(attendee)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white/40 backdrop-blur-xl rounded-3xl border border-white/60 p-16 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <Users className="h-8 w-8 text-slate-400" />
                            </div>
                            <h4 className="text-slate-900 font-bold mb-1">No attendees found</h4>
                            <p className="text-slate-500 text-sm">
                                {searchQuery ? 'Try adjusting your search terms.' : 'Wait for more people to join the event!'}
                            </p>
                        </div>
                    )}
                </section>

                {/* Section 2: Sidebar (Meetings + Tips) */}
                <div className="space-y-8">
                    {/* My Meetings Container */}
                    <section className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-xl shadow-indigo-500/5 p-8 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-16 -mt-16" />
                        <div className="flex items-center gap-3 mb-6 relative">
                            <div className="p-2 rounded-xl bg-slate-900 text-white shadow-lg">
                                <Calendar size={18} />
                            </div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">My Meetings</h3>
                        </div>

                        {loadingMeetings ? (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2].map((i) => (
                                    <div key={i} className="h-20 bg-slate-100 rounded-3xl" />
                                ))}
                            </div>
                        ) : meetings.length > 0 ? (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {meetings.map((meeting, idx) => (
                                    <MeetingCard
                                        key={`${meeting.id || meeting.start_time}-${idx}`}
                                        meeting={meeting}
                                        stands={stands}
                                        eventId={eventId}
                                        eventTimeZone={eventTimeZone}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-50/50 rounded-3xl p-8 text-center border border-dashed border-slate-200">
                                <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-1">No meetings</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                    Browse the stands to schedule professional meetings with exhibitors.
                                </p>
                            </div>
                        )}
                    </section>

                    {/* Pro Tips */}
                    <section className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
                        <div className="flex items-center gap-2 mb-4 relative">
                            <Sparkles size={16} className="text-indigo-200" />
                            <h3 className="text-[10px] font-black uppercase tracking-[3px] text-indigo-100">Networking Tips</h3>
                        </div>
                        <div className="space-y-4 relative">
                            <div className="flex gap-3">
                                <div className="mt-1.5 w-1 h-1 rounded-full bg-indigo-300 shrink-0" />
                                <p className="text-xs font-medium text-indigo-50 leading-relaxed">
                                    Target profiles with shared interests for more productive conversations.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <div className="mt-1.5 w-1 h-1 rounded-full bg-indigo-300 shrink-0" />
                                <p className="text-xs font-medium text-indigo-50 leading-relaxed">
                                    Reach out early to schedule meetings during peak event hours.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

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
        visitor: { label: 'Visitor', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
        enterprise: { label: 'Enterprise', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        organizer: { label: 'Organizer', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
        admin: { label: 'Admin', cls: 'bg-slate-50 text-slate-600 border-slate-100' },
    };
    const badge = roleBadge[attendee.role || 'visitor'] || roleBadge.visitor;

    return (
        <div className="group relative bg-white/60 backdrop-blur-xl rounded-[28px] border border-white/60 p-6 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-600">
                    <Mail size={14} />
                </div>
            </div>

            <div className="flex items-start gap-5">
                {attendee.avatar_url ? (
                    <img
                        src={attendee.avatar_url}
                        alt={attendee.full_name || ''}
                        className="w-16 h-16 rounded-[20px] object-cover shadow-lg shadow-black/5 flex-shrink-0"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-[20px] bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xl flex-shrink-0">
                        {initials}
                    </div>
                )}
                
                <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-900 truncate text-base leading-none">
                            {attendee.full_name || 'Anonymous User'}
                        </h4>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        <Briefcase size={12} className="shrink-0" />
                        <span className="truncate">{attendee.job_title || 'Attendee'}</span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${badge.cls}`}>
                        {badge.label}
                    </span>
                </div>
            </div>

            {/* Tags & Bio */}
            <div className="mt-6 space-y-4">
                {(attendee.interests && attendee.interests.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {attendee.interests.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-bold border border-slate-100">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                <div className="h-px bg-slate-100/50 w-full" />
                
                <button
                    onClick={onReachOut}
                    className="w-full py-3 rounded-2xl bg-white text-indigo-600 text-xs font-black uppercase tracking-widest border border-indigo-50 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                >
                    View Connection
                </button>
            </div>
        </div>
    );
}

function AttendeeReachOutModal({ attendee, onClose }: { attendee: Attendee; onClose: () => void }) {
    const identity = attendee.full_name || attendee.company || attendee.email;
    const location = [attendee.org_city, attendee.org_country].filter(Boolean).join(', ');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="relative h-32 bg-indigo-600 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-800 opacity-90" />
                    <div className="absolute top-0 right-0 p-6">
                        <button onClick={onClose} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-10 pb-10 relative">
                    <div className="flex items-end gap-6 -mt-12 mb-6">
                        {attendee.avatar_url ? (
                            <img src={attendee.avatar_url} alt={identity} className="w-24 h-24 rounded-[32px] object-cover border-4 border-white shadow-xl" />
                        ) : (
                            <div className="w-24 h-24 rounded-[32px] bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center text-slate-400 font-bold text-3xl">
                                {(identity || 'A').slice(0, 1).toUpperCase()}
                            </div>
                        )}
                        <div className="pb-2">
                            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{identity}</h4>
                            <p className="text-indigo-600 font-black uppercase tracking-[3px] text-[10px]">
                                {attendee.role || 'Participant'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Current Role</p>
                            <p className="text-sm font-bold text-slate-700">{attendee.job_title || 'Attendee'}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{attendee.company || attendee.org_name || 'Professional'}</p>
                        </div>
                        {location && (
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Location</p>
                                <p className="text-sm font-bold text-slate-700">{location}</p>
                            </div>
                        )}
                    </div>

                    {attendee.bio && (
                        <div className="mb-8">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">About</p>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{attendee.bio}</p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <a
                            href={`mailto:${attendee.email}`}
                            className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all"
                        >
                            <Mail size={16} /> Send Email
                        </a>
                        {attendee.org_website && (
                            <a
                                href={attendee.org_website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 transition-all"
                            >
                                <ExternalLink size={20} />
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Meeting Card ── */

function MeetingCard({ 
    meeting, 
    stands, 
    eventId,
    eventTimeZone 
}: { 
    meeting: Meeting; 
    stands: Stand[]; 
    eventId: string;
    eventTimeZone: string;
}) {
    const stand = stands.find((s) => (s as any).id === meeting.stand_id || (s as any)._id === meeting.stand_id);
    const router = useRouter();

    const statusConfig: Record<string, { label: string; cls: string }> = {
        pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
        approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-600 border-red-100' },
        canceled: { label: 'Canceled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
        completed: { label: 'Completed', cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    };

    const status = statusConfig[meeting.status] || statusConfig.pending;

    return (
        <div className="group bg-white rounded-3xl border border-slate-100 p-4 hover:border-indigo-100 transition-all">
            <div className="flex items-center gap-4 mb-3">
                <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm border border-slate-100/50"
                    style={{ backgroundColor: stand?.theme_color || '#F1F5F9' }}
                >
                    {stand?.logo_url ? (
                        <img src={stand.logo_url} alt={stand.name} className="w-8 h-8 object-contain brightness-0 invert opacity-90" />
                    ) : (
                        <Briefcase className="h-5 w-5 text-white/50" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate text-xs">{stand?.name || 'Exhibitor Stand'}</h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} className="text-slate-400" />
                        <p className="text-[10px] font-black text-slate-500 uppercase">
                            {formatInTZ(meeting.start_time, eventTimeZone, 'MMM d • h:mm a')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${status.cls}`}>
                    {status.label}
                </span>

                {(meeting.status === 'approved' || (meeting as any).session_status === 'live') ? (
                    <button
                        onClick={() => router.push(`/meetings/${meeting.id || (meeting as any)._id}/room`)}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        Join Room
                    </button>
                ) : (
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-2">
                        Details
                    </span>
                )}
            </div>
        </div>
    );
}
