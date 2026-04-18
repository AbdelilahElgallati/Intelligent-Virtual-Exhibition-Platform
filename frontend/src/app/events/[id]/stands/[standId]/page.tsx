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
import { useChatWebSocket } from '@/hooks/useChatWebSocket';
import { ParticipantStatus } from '@/lib/api/types';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { useTranslation } from 'react-i18next';

type StandWithAliases = Stand & { _id?: string; event_id?: string; };
type EventWithAliases = Event & { _id?: string; };
type FavoriteDoc = { id?: string; _id?: string; target_type?: string; target_id?: string; };

const resolveFavoriteDocId = (fav?: FavoriteDoc | null): string => String(fav?.id || fav?._id || '');

export default function StandPage({ params }: { params: Promise<{ id: string; standId: string }> }) {
    const { t } = useTranslation();
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
    const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
    const [visitorRoomId, setVisitorRoomId] = useState<string | null>(null);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('NOT_JOINED');
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());
    const { isAuthenticated, user } = useAuth();

    // 1. WebSocket listener for REAL-TIME unread dot
    const { messages: wsMessages } = useChatWebSocket(
        (isAuthenticated && visitorRoomId && !isChatOpen) ? visitorRoomId : null
    );

    useEffect(() => {
        if (wsMessages.length > 0 && !isChatOpen) {
            const lastMsg = wsMessages[wsMessages.length - 1];
            const userId = user?.id || (user as any)?._id;
            if (lastMsg.sender_id !== userId) {
                setHasUnreadMessages(true);
            }
        }
    }, [wsMessages, isChatOpen, user]);

    useEffect(() => {
        const fetchStand = async () => {
            try {
                const [data, evt, statusData] = await Promise.all([
                    apiClient.get<StandWithAliases>(ENDPOINTS.STANDS.GET(id, standId)),
                    apiClient.get<EventWithAliases>(ENDPOINTS.EVENTS.GET(id)).catch(() => null),
                    apiClient.get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(id)).catch(() => ({ status: 'NOT_JOINED' as ParticipantStatus })),
                ]);
                setStand(data); setEventData(evt); setParticipantStatus(statusData.status || 'NOT_JOINED');
                const resolvedStandId = data.id || data._id || standId;
                if (isAuthenticated) {
                    try {
                        const favs = await favoritesService.list() as FavoriteDoc[];
                        const match = favs.find((f) => f.target_type === 'stand' && (f.target_id === data.id || f.target_id === data._id));
                        setFavoriteId(match ? resolveFavoriteDocId(match) : null);
                    } catch { }
                }
                try {
                    const products = await apiClient.get<unknown[]>(ENDPOINTS.MARKETPLACE.PRODUCTS(resolvedStandId));
                    setHasProducts(Array.isArray(products) && products.length > 0);
                } catch { }
                apiClient.post('/metrics/log', { type: 'stand_visit', event_id: id, stand_id: resolvedStandId }).catch(() => {});
            } catch (error) { console.error('Failed to fetch stand', error); } finally { setLoading(false); }
        };
        fetchStand();
    }, [id, standId, isAuthenticated]);

    useEffect(() => {
        const timer = window.setInterval(() => setTimelineNow(Date.now()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isAuthenticated || !stand) {
            setHasUnreadMessages(false);
            return;
        }
        
        const checkUnread = async () => {
            try {
                const rooms = await apiClient.get<any[]>(ENDPOINTS.CHAT.ROOMS + `?event_id=${id}&room_category=visitor`);
                const resolvedStandId = stand.id || stand._id || standId;
                const standRoom = rooms.find(r => r.stand_id === resolvedStandId);
                
                if (standRoom) {
                    setVisitorRoomId(standRoom.id || standRoom._id);
                    
                    if (standRoom.last_message) {
                        const msg = standRoom.last_message;
                        const rawTs = msg.timestamp || msg.created_at || msg.sent_at || msg.createdAt;
                        const lastMsgTime = rawTs ? new Date(rawTs).getTime() : 0;
                        
                        const userId = user?.id || (user as any)?._id;
                        const lastReadTime = standRoom.last_read_by?.[userId] 
                            ? new Date(standRoom.last_read_by[userId]).getTime() 
                            : 0;
                            
                        setHasUnreadMessages(lastMsgTime > lastReadTime);
                    } else {
                        setHasUnreadMessages(false);
                    }
                } else {
                    setHasUnreadMessages(false);
                }
            } catch { 
                setHasUnreadMessages(false);
            }
        };

        checkUnread();
        const interval = setInterval(checkUnread, 5000);
        return () => clearInterval(interval);
    }, [id, stand, standId, isAuthenticated, user]);

    const toggleFavorite = async () => {
        if (!stand) return;
        if (!isAuthenticated) { localStorage.setItem('redirectAfterLogin', `/events/${id}/stands/${standId}`); window.location.href = '/auth/login'; return; }
        try {
            if (favoriteId) { await favoritesService.remove(favoriteId); setFavoriteId(null); }
            else { const fav = await favoritesService.add('stand', stand.id || stand._id || ''); setFavoriteId(resolveFavoriteDocId(fav)); }
        } catch (error) { console.error('Failed to toggle favorite', error); }
    };

    const lifecycle = eventData ? getEventLifecycle(eventData, new Date(timelineNow)) : null;
    const isApproved = participantStatus === 'APPROVED' || participantStatus === 'GUEST_APPROVED';
    const canAccessLive = isApproved && lifecycle?.accessState === 'OPEN_SLOT_ACTIVE';

    useEffect(() => {
        if (lifecycle?.displayState === 'ENDED') {
            const timer = window.setTimeout(() => window.location.replace(`/events/${id}?event_ended=true`), 2500);
            return () => window.clearTimeout(timer);
        }
    }, [id, lifecycle?.displayState]);

    if (loading) return <LoadingState message={t('visitor.standsGrid.loading')} />;
    if (!stand || !lifecycle) return <div className="text-center py-20 text-gray-500">{t('visitor.eventLiveLayout.unavailable')}</div>;

    if (!isApproved) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="max-w-2xl w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <h3 className="text-xl font-semibold text-amber-900">{t('visitor.eventLiveLayout.registrationRequired')}</h3>
                    <a href={`/events/${id}`} className="inline-flex mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold">{t('events.detail.joinCard.notJoined.buttonFree')}</a>
                </div>
            </div>
        );
    }

    if (!canAccessLive) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="max-w-2xl w-full rounded-2xl border p-6 text-center bg-white shadow-sm">
                    <h3 className="text-xl font-semibold">{lifecycle.displayState}</h3>
                    <p className="mt-2 text-gray-600">
                        {lifecycle.accessState === 'CLOSED_BETWEEN_SLOTS' ? t('visitor.eventLiveLayout.accessNextSlot') : 
                         lifecycle.accessState === 'CLOSED_AFTER_EVENT' ? t('visitor.eventLiveLayout.eventConcluded') : t('visitor.eventLiveLayout.accessOpens')}
                    </p>
                    {lifecycle.nextSlot && <p className="mt-3 font-bold text-indigo-600">{formatTimeToStart(lifecycle.nextSlot.start)}</p>}
                    <a href={`/events/${id}`} className="inline-flex mt-4 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold">{t('visitor.eventLiveLayout.backToDetails')}</a>
                </div>
            </div>
        );
    }

    const themeColor = stand.theme_color ?? '#1e293b';
    const avatarBg = stand.presenter_avatar_bg ?? '#ffffff';
    const resolvedStandId = stand.id || stand._id || standId;

    return (
        <>
            <VirtualStandLayout
                stand={stand} themeColor={themeColor} avatarBg={avatarBg}
                backHref={`/events/${stand.event_id || id}/live?tab=stands`}
                onChatOpen={() => {
                    setIsChatOpen(true);
                    setHasUnreadMessages(false);
                }} onMeetingOpen={() => setIsMeetingModalOpen(true)}
                onAssistantOpen={() => setIsAssistantOpen(true)} onProductsOpen={hasProducts ? () => setIsShopOpen(true) : undefined}
                onFavoriteToggle={toggleFavorite} favoriteId={favoriteId} activeTab={activeTab} onTabChange={setActiveTab}
                hasUnreadChat={hasUnreadMessages} hasProducts={hasProducts}
            >
                {activeTab === 'resources' ? (
                    <div className="space-y-5"><StandResources standId={resolvedStandId} /></div>
                ) : (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"><h3 className="text-lg font-semibold mb-3">{t('visitor.virtualStandLayout.aboutTab')}</h3><p className="text-gray-600 text-sm leading-relaxed">{stand.description}</p></div>
                )}
            </VirtualStandLayout>

            {isChatOpen && <ChatPanel standId={resolvedStandId} standName={stand.name} onClose={() => setIsChatOpen(false)} avatarBg={avatarBg} themeColor={themeColor} onMeetingOpen={() => setIsMeetingModalOpen(true)} eventTimeZone={eventData?.event_timezone} />}
            {isAssistantOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-3"><div className="w-full max-w-5xl h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden"><ChatShell scope={`stand-${resolvedStandId}`} title={`${stand.name} ${t('visitor.virtualStand.actionBar.assistant')}`} onClose={() => setIsAssistantOpen(false)} className="h-full" /></div></div>}
            {isShopOpen && <ProductsPanel standId={resolvedStandId} standName={stand.name} themeColor={themeColor} onClose={() => setIsShopOpen(false)} />}
            <MeetingRequestModal isOpen={isMeetingModalOpen} onClose={() => setIsMeetingModalOpen(false)} standId={resolvedStandId} standName={stand.name} eventId={String(eventData?.id || id)} eventStartDate={eventData?.start_date} eventEndDate={eventData?.end_date} scheduleDays={eventData?.schedule_days} eventTimeZone={eventData?.event_timezone} themeColor={themeColor} />
        </>
    );
}
