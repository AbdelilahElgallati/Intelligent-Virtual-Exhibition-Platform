import { useEffect, useState } from 'react';
import { Event } from '@/types/event';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useAuth } from '@/hooks/useAuth';
import { resolveMediaUrl } from '@/lib/media';
import { Briefcase, Building2, ExternalLink, Globe, Mail, MapPin, Search, Target, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    org_logo_url?: string;
    role?: string;
    bio?: string;
    job_title?: string;
    experience_level?: string;
    company?: string;
    industry?: string;
    language?: string;
    timezone?: string;
    preferred_event_types?: string[];
    preferred_languages?: string[];
    preferred_regions?: string[];
    org_name?: string;
    org_type?: string;
    org_website?: string;
    org_contact_email?: string;
    org_contact_phone?: string;
    org_city?: string;
    org_country?: string;
    interests?: string[];
    networking_goals?: string[];
}

function toExternalUrl(raw?: string): string | null {
    const value = (raw || '').trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `https://${value}`;
}

/* ── Main Component ── */

export function NetworkingTab({ eventId }: NetworkingTabProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [loadingAttendees, setLoadingAttendees] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
    const roleStats = attendees.reduce((acc, attendee) => {
        const role = String(attendee.role || 'visitor').toLowerCase();
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

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

    // Filter attendees by search
    const filtered = searchQuery
        ? attendees.filter((a) => {
              const q = searchQuery.toLowerCase();
              return (
                  (a.full_name || '').toLowerCase().includes(q) ||
                  (a.job_title || '').toLowerCase().includes(q) ||
                  (a.experience_level || '').toLowerCase().includes(q) ||
                  (a.company || '').toLowerCase().includes(q) ||
                  (a.org_name || '').toLowerCase().includes(q) ||
                  (a.org_type || '').toLowerCase().includes(q) ||
                  (a.industry || '').toLowerCase().includes(q) ||
                  (a.language || '').toLowerCase().includes(q) ||
                  (a.org_country || '').toLowerCase().includes(q) ||
                  (a.networking_goals || []).some((t) => t.toLowerCase().includes(q)) ||
                  (a.interests || []).some((t) => t.toLowerCase().includes(q))
              );
          })
        : attendees;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 md:px-6 space-y-8">
            {/* Header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                                <Users size={20} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">{t('visitor.networkingTab.title')}</h2>
                        </div>
                        <p className="text-gray-600 max-w-2xl text-sm leading-relaxed">
                            {t('visitor.networkingTab.subtitle')}
                        </p>
                    </div>
                    {!loadingAttendees && (
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                {t('visitor.networkingTab.total', { n: attendees.length })}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {t('visitor.networkingTab.visitors', { n: roleStats.visitor || 0 })}
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {t('visitor.networkingTab.enterprises', { n: roleStats.enterprise || 0 })}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-10">
                {/* Section 1: Attendees List */}
                <section className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-gray-900">{t('visitor.networkingTab.attendees')}</h3>
                            {!loadingAttendees && (
                                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-semibold border border-indigo-200">
                                    {t('visitor.networkingTab.visible', { n: filtered.length })}
                                </span>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative w-full sm:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder={t('visitor.networkingTab.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all text-gray-700"
                            />
                        </div>
                    </div>

                    {loadingAttendees ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse space-y-4">
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
                            {filtered.map((attendee) => (
                                <AttendeeCard
                                    key={attendee.id || attendee.email}
                                    attendee={attendee}
                                    onReachOut={() => setSelectedAttendee(attendee)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="h-7 w-7 text-gray-400" />
                            </div>
                            <h4 className="text-gray-900 font-semibold mb-1">{t('visitor.networkingTab.empty')}</h4>
                            <p className="text-gray-500 text-sm">
                                {searchQuery ? t('visitor.networkingTab.tryAdjustingSearch') : t('visitor.networkingTab.waitMorePeople')}
                            </p>
                        </div>
                    )}
                </section>

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

function attendeeInitials(attendee: Attendee): string {
    return (attendee.full_name || attendee.email)
        .split(/[\s@]+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('');
}

function NetworkingAvatar({
    attendee,
    size,
    className,
}: {
    attendee: Attendee;
    size: 'sm' | 'lg';
    className?: string;
}) {
    const [broken, setBroken] = useState(false);
    const raw = (attendee.avatar_url || attendee.org_logo_url)?.trim();
    const src = raw && !broken ? resolveMediaUrl(raw) : '';
    const initials = attendeeInitials(attendee);
    if (size === 'sm') {
        if (!src) {
            return (
                <div
                    className={`w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg flex-shrink-0 border border-gray-100 shadow-sm ${className || ''}`}
                >
                    {initials}
                </div>
            );
        }
        return (
            <img
                src={src}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={() => setBroken(true)}
                className={`w-14 h-14 rounded-xl object-cover shadow-sm border border-gray-100 flex-shrink-0 ${className || ''}`}
            />
        );
    }
    if (!src) {
        return (
            <div
                className={`w-[72px] h-[72px] rounded-2xl bg-slate-100 border border-gray-200 shadow-sm flex items-center justify-center text-slate-500 font-bold text-2xl ${className || ''}`}
            >
                {initials || '?'}
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={attendee.full_name || ''}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className={`w-[72px] h-[72px] rounded-2xl object-cover border border-gray-200 shadow-sm ${className || ''}`}
        />
    );
}

function AttendeeCard({ attendee, onReachOut }: { attendee: Attendee; onReachOut: () => void }) {
    const { t } = useTranslation();
    const roleBadge: Record<string, { label: string; cls: string }> = {
        visitor: { label: t('visitor.networkingTab.roles.visitor'), cls: 'bg-blue-50 text-blue-600 border-blue-100' },
        enterprise: { label: t('visitor.networkingTab.roles.enterprise'), cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
        organizer: { label: t('visitor.networkingTab.roles.organizer'), cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
        admin: { label: t('visitor.networkingTab.roles.admin'), cls: 'bg-slate-50 text-slate-600 border-slate-100' },
    };
    const badge = roleBadge[attendee.role || 'visitor'] || roleBadge.visitor;

    const companyLabel = attendee.company || attendee.org_name || t('visitor.networkingTab.companyFallback');
    const location = [attendee.org_city, attendee.org_country].filter(Boolean).join(', ');
    const hasEnterpriseDetails = String(attendee.role || '').toLowerCase() === 'enterprise';
    const hasVisitorDetails = String(attendee.role || '').toLowerCase() === 'visitor';
    const profileTag = hasEnterpriseDetails
        ? attendee.org_type
        : hasVisitorDetails
            ? attendee.experience_level
            : null;
    const displayedInterests = (attendee.interests || []).slice(0, 2);
    const hiddenInterestsCount = Math.max((attendee.interests || []).length - displayedInterests.length, 0);
    const displayedGoals = (attendee.networking_goals || []).slice(0, 1);
    const hiddenGoalsCount = Math.max((attendee.networking_goals || []).length - displayedGoals.length, 0);

    return (
        <div className="group relative h-full min-h-[320px] bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center text-indigo-600">
                    <Mail size={14} />
                </div>
            </div>

            <div className="flex items-start gap-5">
                <NetworkingAvatar attendee={attendee} size="sm" />
                
                <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 truncate text-base leading-none">
                            {attendee.full_name || t('visitor.networkingTab.anonymousUser')}
                        </h4>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                        <Briefcase size={12} className="shrink-0" />
                        <span className="truncate">{attendee.job_title || t('visitor.networkingTab.attendeeFallback')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                        <Building2 size={12} className="shrink-0" />
                        <span className="truncate">{companyLabel}</span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.cls}`}>
                        {badge.label}
                    </span>
                </div>
            </div>

            {/* Tags & Bio */}
            <div className="mt-6 space-y-4 flex-1 flex flex-col">
                {attendee.industry && (
                    <div className="text-xs text-gray-600 line-clamp-1">
                        <span className="font-semibold text-gray-700">{t('visitor.networkingTab.labels.industry')}:</span> {attendee.industry}
                    </div>
                )}
                {location && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={12} />
                        <span className="truncate">{location}</span>
                    </div>
                )}

                {(attendee.interests && attendee.interests.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {displayedInterests.map((tag) => (
                            <span key={`${attendee.id}-interest-${tag}`} className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-medium border border-gray-200 truncate max-w-[120px]">
                                {tag}
                            </span>
                        ))}
                        {hiddenInterestsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-semibold border border-gray-200">
                                +{hiddenInterestsCount}...
                            </span>
                        )}
                    </div>
                )}

                {(attendee.networking_goals && attendee.networking_goals.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                        {displayedGoals.map((goal) => (
                            <span key={`${attendee.id}-goal-${goal}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-medium border border-indigo-200 truncate max-w-[170px]">
                                <Target size={10} /> {goal}
                            </span>
                        ))}
                        {hiddenGoalsCount > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-200">
                                +{hiddenGoalsCount}...
                            </span>
                        )}
                    </div>
                )}

                {profileTag && (
                    <div className="text-xs text-gray-500 line-clamp-1">
                        <span className="font-semibold text-gray-700">{hasEnterpriseDetails ? t('visitor.networkingTab.labels.orgType') : t('visitor.networkingTab.labels.experience')}:</span> {profileTag}
                    </div>
                )}

                {hasEnterpriseDetails && attendee.org_website && (
                    <div className="text-xs text-gray-500 truncate">
                        <span className="font-semibold text-gray-700">{t('visitor.networkingTab.labels.website')}:</span> {attendee.org_website}
                    </div>
                )}
                {hasVisitorDetails && attendee.bio && (
                    <p className="text-xs text-gray-500 line-clamp-2">{attendee.bio}</p>
                )}

                <div className="h-px bg-gray-100 w-full mt-auto" />
                
                <button
                    onClick={onReachOut}
                    className="w-full py-2.5 rounded-xl bg-white text-indigo-600 text-xs font-semibold border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                >
                    {t('visitor.networkingTab.viewProfile')}
                </button>
            </div>
        </div>
    );
}

function AttendeeReachOutModal({ attendee, onClose }: { attendee: Attendee; onClose: () => void }) {
    const { t } = useTranslation();
    const identity = attendee.full_name || attendee.company || attendee.email;
    const location = [attendee.org_city, attendee.org_country].filter(Boolean).join(', ');
    const role = String(attendee.role || 'participant').toLowerCase();
    const roleLabel = t(`visitor.networkingTab.roles.${role}`, { defaultValue: role.charAt(0).toUpperCase() + role.slice(1) });
    const companyLabel = attendee.company || attendee.org_name || t('visitor.networkingTab.companyFallback');
    const websiteUrl = toExternalUrl(attendee.org_website);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                <div className="relative h-28 bg-indigo-600 overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-800 opacity-90" />
                    <div className="absolute top-0 right-0 p-6">
                        <button onClick={onClose} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="px-8 pt-6 pb-8 relative overflow-y-auto">
                    <div className="flex items-start gap-5 mb-6">
                        <NetworkingAvatar attendee={attendee} size="lg" />
                        <div className="pt-1 min-w-0">
                            <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{identity}</h4>
                            <p className="text-indigo-600 font-semibold text-xs">
                                {roleLabel}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.currentRole')}</p>
                            <p className="text-sm font-semibold text-slate-700">{attendee.job_title || t('visitor.networkingTab.attendeeFallback')}</p>
                            <p className="text-sm text-slate-500 mt-0.5">{companyLabel}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.contact')}</p>
                            <p className="text-sm text-slate-700 truncate">{attendee.email}</p>
                            {attendee.org_contact_email && attendee.org_contact_email !== attendee.email && (
                                <p className="text-xs text-slate-500 truncate mt-0.5">{t('visitor.networkingTab.modal.business')}: {attendee.org_contact_email}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {attendee.industry && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.labels.industry')}</p>
                                <p className="text-sm text-slate-700">{attendee.industry}</p>
                            </div>
                        )}
                        {attendee.experience_level && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.labels.experience')}</p>
                                <p className="text-sm text-slate-700">{attendee.experience_level}</p>
                            </div>
                        )}
                        {attendee.org_type && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.organizationType')}</p>
                                <p className="text-sm text-slate-700">{attendee.org_type}</p>
                            </div>
                        )}
                        {location && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.location')}</p>
                                <p className="text-sm text-slate-700 inline-flex items-center gap-1.5"><MapPin size={13} /> {location}</p>
                            </div>
                        )}
                        {attendee.language && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.language')}</p>
                                <p className="text-sm text-slate-700">{attendee.language}</p>
                            </div>
                        )}
                        {attendee.timezone && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.timezone')}</p>
                                <p className="text-sm text-slate-700">{attendee.timezone}</p>
                            </div>
                        )}
                        {attendee.org_name && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.modal.organization')}</p>
                                <p className="text-sm text-slate-700 inline-flex items-center gap-1.5"><Building2 size={13} /> {attendee.org_name}</p>
                            </div>
                        )}
                        {attendee.org_website && websiteUrl && (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('visitor.networkingTab.labels.website')}</p>
                                <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1.5 truncate"><Globe size={13} /> {attendee.org_website}</a>
                            </div>
                        )}
                    </div>

                    {attendee.bio && (
                        <div className="mb-6">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('visitor.networkingTab.modal.about')}</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{attendee.bio}</p>
                        </div>
                    )}

                    {(attendee.interests?.length || attendee.networking_goals?.length) ? (
                        <div className="mb-6 space-y-3">
                            {attendee.interests && attendee.interests.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('visitor.networkingTab.modal.interests')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendee.interests.map((tag, i) => (
                                            <span key={`${tag}-${i}`} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs border border-slate-200">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {attendee.networking_goals && attendee.networking_goals.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('visitor.networkingTab.modal.networkingGoals')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendee.networking_goals.map((goal, i) => (
                                            <span key={`${goal}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs border border-indigo-200"><Target size={10} /> {goal}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    {(attendee.preferred_event_types?.length || attendee.preferred_languages?.length || attendee.preferred_regions?.length) ? (
                        <div className="mb-6 space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('visitor.networkingTab.modal.profilePreferences')}</p>
                            {attendee.preferred_event_types && attendee.preferred_event_types.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-1.5">{t('visitor.networkingTab.modal.preferredEventTypes')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendee.preferred_event_types.map((value, i) => (
                                            <span key={`evt-${value}-${i}`} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs border border-slate-200">{value}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {attendee.preferred_languages && attendee.preferred_languages.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-1.5">{t('visitor.networkingTab.modal.preferredLanguages')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendee.preferred_languages.map((value, i) => (
                                            <span key={`lang-${value}-${i}`} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs border border-slate-200">{value}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {attendee.preferred_regions && attendee.preferred_regions.length > 0 && (
                                <div>
                                    <p className="text-xs text-slate-500 mb-1.5">{t('visitor.networkingTab.modal.preferredRegions')}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendee.preferred_regions.map((value, i) => (
                                            <span key={`region-${value}-${i}`} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs border border-slate-200">{value}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div className="flex gap-3">
                        <a
                            href={`mailto:${attendee.email}`}
                            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                        >
                            <Mail size={16} /> {t('visitor.networkingTab.modal.sendEmail')}
                        </a>
                        {attendee.org_website && websiteUrl && (
                            <a
                                href={websiteUrl}
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
