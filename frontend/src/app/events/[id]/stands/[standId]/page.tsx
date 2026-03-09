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
import { ChatShell } from '@/components/assistant/ChatShell';
import { ProductsPanel } from '@/components/stand/ProductsPanel';
import { favoritesService } from '@/services/favorites.service';
import { useAuth } from '@/hooks/useAuth';

export default function StandPage({ params }: { params: Promise<{ id: string; standId: string }> }) {
    const { id, standId } = use(params);
    const [stand, setStand] = useState<Stand | null>(null);
    const [eventData, setEventData] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resources' | 'about'>('resources');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [isProductsOpen, setIsProductsOpen] = useState(false);
    const [hasProducts, setHasProducts] = useState(false);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        const fetchStand = async () => {
            try {
                const data = await apiClient.get<Stand>(ENDPOINTS.STANDS.GET(id, standId));
                setStand(data);

                // Fetch event data for meeting schedule constraints
                try {
                    const evt = await apiClient.get<Event>(ENDPOINTS.EVENTS.GET(id));
                    setEventData(evt);
                } catch {
                    /* event fetch is non-critical */
                }

                // Fetch favorites state
                if (isAuthenticated) {
                    try {
                        const favs = await favoritesService.list();
                        const match = favs.find((f) => f.target_type === 'stand' && (f.target_id === (data as any).id || f.target_id === (data as any)._id));
                        setFavoriteId(match ? match.id : null);
                    } catch {
                        /* ignore favorites fetch error */
                    }
                }

                // Track visit
                try {
                    await apiClient.post('/analytics/log', {
                        type: 'stand_visit',
                        event_id: id,
                        stand_id: standId,
                    });
                } catch (e) {
                    // ignore
                }

                // Check if stand has marketplace products
                try {
                    const prods = await apiClient.get<any[]>(ENDPOINTS.MARKETPLACE.PRODUCTS(standId));
                    setHasProducts(Array.isArray(prods) && prods.length > 0);
                } catch {
                    /* ignore */
                }
            } catch (error) {
                console.error('Failed to fetch stand', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStand();
    }, [id, standId, isAuthenticated]);

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
                const fav = await favoritesService.add('stand', (stand as any).id || (stand as any)._id);
                setFavoriteId(fav.id);
            }
        } catch (error) {
            console.error('Failed to toggle favorite', error);
        }
    };

    if (loading) return <LoadingState message="Loading stand..." />;
    if (!stand) return <div className="text-center py-20 text-gray-500">Stand not found</div>;

    const themeColor = stand.theme_color ?? '#1e293b';
    const avatarBg = stand.presenter_avatar_bg ?? '#ffffff';

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
                onProductsOpen={() => setIsProductsOpen(true)}
                hasProducts={hasProducts}
                onFavoriteToggle={toggleFavorite}
                favoriteId={favoriteId}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            >
                {/* ----- Tab content passed as children ----- */}
                {activeTab === 'resources' ? (
                    <div className="space-y-5">
                        <StandResources standId={standId} />
                        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                            <h4 className="font-bold text-indigo-900 mb-1 text-sm">Recommended for You</h4>
                            <p className="text-xs text-indigo-700">
                                Based on your profile, this stand matches your interest in <strong>AI Technology</strong>.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3">About Us</h3>
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
                    standId={standId}
                    standName={stand.name}
                    onClose={() => setIsChatOpen(false)}
                    avatarBg={avatarBg}
                />
            )}

            {/* Assistant */}
            {isAssistantOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
                    <div className="w-full sm:w-[520px] h-full bg-white shadow-2xl border-l border-gray-200">
                        <ChatShell
                            scope={`stand-${standId}`}
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

            {/* Meeting Modal */}
            <MeetingRequestModal
                isOpen={isMeetingModalOpen}
                onClose={() => setIsMeetingModalOpen(false)}
                standId={standId}
                standName={stand.name}
                eventStartDate={eventData?.start_date}
                eventEndDate={eventData?.end_date}
                scheduleDays={eventData?.schedule_days}
            />

            {/* Products Panel */}
            {isProductsOpen && (
                <ProductsPanel
                    standId={standId}
                    standName={stand.name}
                    themeColor={themeColor}
                    onClose={() => setIsProductsOpen(false)}
                />
            )}
        </>
    );
}
