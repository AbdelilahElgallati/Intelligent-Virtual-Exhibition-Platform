'use client';

import { useState, useEffect, use } from 'react';
import { Stand } from '@/lib/api/types';
import { Event } from '@/types/event';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { LoadingState } from '@/components/ui/LoadingState';
import { StandResources } from '@/components/stand/StandResources';
import { VirtualStandLayout } from '@/components/stand/VirtualStandLayout';
import { ChatPanel } from '@/components/stand/ChatPanel';
import { MeetingRequestModal } from '@/components/stand/MeetingRequestModal';
import { ProductsPanel } from '@/components/stand/ProductsPanel';
import { ChatShell } from '@/components/assistant/ChatShell';
import { favoritesService } from '@/services/favorites.service';
import { useAuth } from '@/hooks/useAuth';
import { ParticipantStatus } from '@/lib/api/types';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';

type StandWithAliases = Stand & {
    _id?: string;
    event_id?: string;
};

type EventWithAliases = Event & {
    _id?: string;
};

type FavoriteDoc = {
    id?: string;
    _id?: string;
    target_type?: string;
    target_id?: string;
};

const resolveFavoriteDocId = (fav?: FavoriteDoc | null): string => String(fav?.id || fav?._id || '');

export default function StandPage({ params }: { params: Promise<{ id: string; standId: string }> }) {
    const { id, standId } = use(params);
    const [stand, setStand] = useState<StandWithAliases | null>(null);
    const [eventData, setEventData] = useState<EventWithAliases | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resources' | 'about'>('resources');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [hasProducts, setHasProducts] = useState(false);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('NOT_JOINED');
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        const fetchStand = async () => {
            try {
                const [data, evt, statusData] = await Promise.all([
                    apiClient.get<StandWithAliases>(ENDPOINTS.STANDS.GET(id, standId)),
                    apiClient.get<EventWithAliases>(ENDPOINTS.EVENTS.GET(id)).catch(() => null),
                    apiClient
                        .get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(id))
                        .catch(() => ({ status: 'NOT_JOINED' as ParticipantStatus })),
                ]);

                setStand(data);
                setEventData(evt);
                setParticipantStatus(statusData.status || 'NOT_JOINED');
                const resolvedStandId = data.id || data._id || standId;

                // Fetch favorites state
                if (isAuthenticated) {
                    try {
                        const favs = await favoritesService.list() as FavoriteDoc[];
                        const match = favs.find((f) => f.target_type === 'stand' && (f.target_id === data.id || f.target_id === data._id));
                        const favoriteDocId = match ? resolveFavoriteDocId(match) : '';
                        setFavoriteId(favoriteDocId || null);
                    } catch {
                        /* ignore favorites fetch error */
                    }
                }

                // Check if stand has marketplace products
                try {
                    const products = await apiClient.get<unknown[]>(ENDPOINTS.MARKETPLACE.PRODUCTS(resolvedStandId));
                    setHasProducts(Array.isArray(products) && products.length > 0);
                } catch {
                    /* marketplace check is non-critical */
                }

                // Track visit
                try {
                    await apiClient.post('/metrics/log', {
                        type: 'stand_visit',
                        event_id: id,
                        stand_id: resolvedStandId,
                    });
                } catch {
                    // ignore
                }
            } catch (error) {
                console.error('Failed to fetch stand', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStand();
    }, [id, standId, isAuthenticated]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    const toggleFavorite = async () => {
        if (!stand) return;
        if (!isAuthenticated) {
            localStorage.setItem('redirectAfterLogin', `/events/${id}/stands/${standId}`);
            // No router here; use location
            window.location.href = '/auth/login';
            return;
        }
        try {
            if (favoriteId) {
                await favoritesService.remove(favoriteId);
                setFavoriteId(null);
            } else {
                const fav = await favoritesService.add('stand', stand.id || stand._id || '');
                const favoriteDocId = resolveFavoriteDocId(fav);
                setFavoriteId(favoriteDocId || null);
            }
        } catch (error) {
            console.error('Failed to toggle favorite', error);
        }
    };

    const lifecycle = eventData ? getEventLifecycle(eventData, new Date(timelineNow)) : null;
    const isApproved = participantStatus === 'APPROVED' || participantStatus === 'GUEST_APPROVED';
    const canAccessLive = isApproved && lifecycle?.hasScheduleSlots && lifecycle.status === 'live';
    const isBetweenSlots = Boolean(
        lifecycle && lifecycle.hasScheduleSlots && lifecycle.status === 'upcoming' && lifecycle.withinScheduleWindow
    );

    useEffect(() => {
        if (lifecycle?.status !== 'ended') return;
        const timer = window.setTimeout(() => {
            window.location.replace(`/events/${id}?event_ended=true`);
        }, 2500);
        return () => window.clearTimeout(timer);
    }, [id, lifecycle?.status]);

    if (loading) return <LoadingState message="Loading stand..." />;
    if (!stand) return <div className="text-center py-20 text-gray-500">Stand not found</div>;

    if (!isApproved) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="max-w-2xl w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <h3 className="text-xl font-semibold text-amber-900">Registration Required</h3>
                    <p className="mt-2 text-amber-800">
                        You need approved participation to access stands during live event slots.
                    </p>
                    <a
                        href={`/events/${id}`}
                        className="inline-flex mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
                    >
                        Go to Event Registration
                    </a>
                </div>
            </div>
        );
    }

    if (!lifecycle?.hasScheduleSlots) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="max-w-2xl w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <h3 className="text-xl font-semibold text-amber-900">Timeline Not Published Yet</h3>
                    <p className="mt-2 text-amber-800">
                        Stand access is enabled only during published live schedule slots.
                    </p>
                    <a
                        href={`/events/${id}`}
                        className="inline-flex mt-4 px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 transition-colors"
                    >
                        Back to Event Details
                    </a>
                </div>
            </div>
        );
    }

    if (!canAccessLive) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="max-w-2xl w-full rounded-2xl border border-cyan-200 bg-cyan-50 p-6 text-center">
                    <h3 className={`text-xl font-semibold ${isBetweenSlots ? 'text-blue-900' : lifecycle?.status === 'ended' ? 'text-slate-900' : 'text-cyan-900'}`}>
                        {lifecycle?.status === 'ended'
                            ? 'Event Timeline Ended'
                            : isBetweenSlots
                              ? 'Event In Progress'
                              : 'Event Not Live Yet'}
                    </h3>
                    <p className="mt-2 text-cyan-800">
                        {lifecycle?.status === 'ended'
                            ? 'This event has ended, so stand access is now closed.'
                            : isBetweenSlots
                              ? 'There is no active slot right now. Stand access opens automatically when the next slot starts.'
                              : 'Stand access opens when the event enters a live schedule slot.'}
                    </p>
                    {lifecycle?.status === 'ended' && (
                        <p className="mt-2 text-sm font-medium text-slate-600">
                            Redirecting you back to the event page...
                        </p>
                    )}
                    {lifecycle?.status !== 'ended' && (
                        <p className="mt-3 text-sm font-semibold text-cyan-900">
                            {formatTimeToStart(lifecycle?.nextSlotStart || null)}
                        </p>
                    )}
                    <a
                        href={lifecycle?.status === 'ended' ? `/events/${id}` : `/events/${id}?tab=schedule`}
                        className="inline-flex mt-4 px-4 py-2 rounded-lg bg-cyan-700 text-white text-sm font-semibold hover:bg-cyan-800 transition-colors"
                    >
                        {lifecycle?.status === 'ended' ? 'Back to Event Details' : 'View Event Schedule'}
                    </a>
                </div>
            </div>
        );
    }

    const themeColor = stand.theme_color ?? '#1e293b';
    const avatarBg = stand.presenter_avatar_bg ?? '#ffffff';
    const resolvedStandId = stand.id || stand._id || standId;

    return (
        <>
            {/* ===== Immersive 2D Showroom ===== */}
            <VirtualStandLayout
                stand={stand}
                themeColor={themeColor}
                avatarBg={avatarBg}
                backHref={`/events/${stand.event_id || id}/live?tab=stands`}
                onChatOpen={() => setIsChatOpen(true)}
                onMeetingOpen={() => setIsMeetingModalOpen(true)}
                onAssistantOpen={() => setIsAssistantOpen(true)}
                onShopOpen={hasProducts ? () => setIsShopOpen(true) : undefined}
                onFavoriteToggle={toggleFavorite}
                favoriteId={favoriteId}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            >
                {/* ----- Tab content passed as children ----- */}
                {activeTab === 'resources' ? (
                    <div className="space-y-5">
                        <StandResources standId={resolvedStandId} />
                        <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100">
                            <h4 className="font-semibold text-indigo-900 mb-1 text-sm">Recommended for You</h4>
                            <p className="text-xs text-indigo-700 leading-relaxed">
                                Based on your profile, this stand matches your interest in <strong>AI Technology</strong>.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">About Us</h3>
                        <p className="text-gray-600 leading-relaxed text-sm">
                            {stand.description || 'Company description coming soon.'}
                        </p>
                    </div>
                )}
            </VirtualStandLayout>

            {/* ===== Overlays (same as before, outside layout) ===== */}

            {/* Chat Panel */}
            {isChatOpen && (
                <ChatPanel
                    standId={resolvedStandId}
                    standName={stand.name}
                    onClose={() => setIsChatOpen(false)}
                    avatarBg={avatarBg}
                    themeColor={themeColor}
                    onMeetingOpen={() => setIsMeetingModalOpen(true)}
                    eventTimeZone={eventData?.event_timezone}
                />
            )}

            {/* Assistant */}
            {isAssistantOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-3 sm:p-6">
                    <div className="w-full max-w-5xl h-[88vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                        <ChatShell
                            scope={`stand-${resolvedStandId}`}
                            title={`${stand.name} Assistant`}
                            subtitle="Ask anything about this stand and its resources."
                            suggestedPrompts={[
                                'Summarize what this stand offers.',
                                'Show me the key brochures/resources.',
                                'What makes this company different?',
                            ]}
                            onClose={() => setIsAssistantOpen(false)}
                            className="h-full"
                        />
                    </div>
                </div>
            )}

            {/* Shop Panel */}
            {isShopOpen && (
                <ProductsPanel
                    standId={resolvedStandId}
                    standName={stand.name}
                    themeColor={themeColor}
                    onClose={() => setIsShopOpen(false)}
                />
            )}

            {/* Meeting Modal */}
            <MeetingRequestModal
                isOpen={isMeetingModalOpen}
                onClose={() => setIsMeetingModalOpen(false)}
                standId={resolvedStandId}
                standAliasIds={[
                    String(stand.id || ''),
                    String(stand._id || ''),
                    String(standId || ''),
                ]}
                standName={stand.name}
                eventId={id}
                eventAliasIds={[
                    String(id || ''),
                    String(stand.event_id || ''),
                    String(eventData?._id || ''),
                ]}
                eventStartDate={eventData?.start_date}
                eventEndDate={eventData?.end_date}
                scheduleDays={eventData?.schedule_days}
                eventTimeZone={eventData?.event_timezone}
                themeColor={themeColor}
            />
        </>
    );
}
