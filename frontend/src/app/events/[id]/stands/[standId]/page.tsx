'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Stand } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Container } from '@/components/common/Container';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StandResources } from '@/components/stand/StandResources';
import { ChatPanel } from '@/components/stand/ChatPanel';
import { MeetingRequestModal } from '@/components/stand/MeetingRequestModal';
import { ChatShell } from '@/components/assistant/ChatShell';
import { favoritesService } from '@/services/favorites.service';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Building2, MessageSquare, CalendarDays, Info } from 'lucide-react';

export default function StandPage({ params }: { params: Promise<{ id: string; standId: string }> }) {
    const { id, standId } = use(params);
    const [stand, setStand] = useState<Stand | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'resources' | 'about'>('resources');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [favoriteId, setFavoriteId] = useState<string | null>(null);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        const fetchStand = async () => {
            try {
                const data = await apiClient.get<Stand>(ENDPOINTS.STANDS.GET(id, standId));
                setStand(data);

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
        <div className="min-h-screen bg-gray-50 relative">
            {/* Hero section with optional background image */}
            <div
                className="border-b border-gray-200 bg-cover bg-center"
                style={{
                    backgroundColor: themeColor,
                    backgroundImage: stand.stand_background_url
                        ? `url(${stand.stand_background_url})`
                        : 'none',
                }}
            >
                <div className="bg-white/90 backdrop-blur-sm">
                <Container className="py-8">
                    <Link href={`/events/${stand.event_id || id}/live?tab=stands`} className="inline-flex items-center text-sm text-gray-500 hover:text-indigo-600 mb-6">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Event
                    </Link>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Logo / Image */}
                        <div className="w-32 h-32 md:w-48 md:h-48 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center border border-indigo-100 text-indigo-400 shrink-0">
                            {stand.logo_url ? (
                                <img src={stand.logo_url} alt={stand.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                <Building2 className="w-16 h-16" />
                            )}
                        </div>

                        {/* Stand Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-gray-900">{stand.name}</h1>
                                {stand.stand_type === 'sponsor' && (
                                    <Badge variant="warning">SPONSOR</Badge>
                                )}
                            </div>

                            <p className="text-lg text-gray-600 mb-4 max-w-2xl">
                                {stand.description || "Welcome to our virtual stand. Explore our resources and connect with our team."}
                            </p>

                            <div className="flex flex-wrap gap-2 mb-6">
                                {stand.tags?.map((tag, idx) => (
                                    <Badge key={idx} variant="default" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button
                                    onClick={() => setIsChatOpen(true)}
                                    style={{ backgroundColor: themeColor }}
                                    className="hover:opacity-90 text-white"
                                >
                                    <MessageSquare className="w-5 h-5 mr-2" />
                                    Chat with Team
                                </Button>
                                <Button
                                    onClick={() => setIsMeetingModalOpen(true)}
                                    variant="outline"
                                >
                                    <CalendarDays className="w-5 h-5 mr-2" />
                                    Request Meeting
                                </Button>
                                <Button variant="outline" onClick={() => setIsAssistantOpen(true)}>
                                    <Info className="w-5 h-5 mr-2" />
                                    Ask Assistant
                                </Button>
                                <Button variant={favoriteId ? 'secondary' : 'outline'} onClick={toggleFavorite}>
                                    {favoriteId ? 'Favorited' : 'Add to favorites'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Container>
                </div>
            </div>

            {/* Stand Showcase & Presenter Section */}
            {stand.stand_background_url && (
                <div className="w-full relative" style={{ minHeight: '480px' }}>
                    {/* Full-width background image */}
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${stand.stand_background_url})` }}
                    >
                        {/* Dark overlay for contrast */}
                        <div className="absolute inset-0 bg-black/20" />
                    </div>

                    {/* Presenter — full-body image anchored at bottom-right */}
                    {stand.presenter_avatar_url && (
                        <div className="absolute bottom-0 right-8 sm:right-16 md:right-24 lg:right-32 z-10 flex flex-col items-center">
                            <div
                                className="relative"
                                style={{ backgroundColor: avatarBg }}
                            >
                                <img
                                    src={stand.presenter_avatar_url}
                                    alt={stand.presenter_name ?? 'Presenter'}
                                    className="h-72 sm:h-80 md:h-96 w-auto object-contain drop-shadow-2xl"
                                />
                            </div>
                            {stand.presenter_name && (
                                <div
                                    className="absolute -bottom-0 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-t-lg shadow-md text-center whitespace-nowrap"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    <p className="text-sm font-semibold text-white">{stand.presenter_name}</p>
                                    <p className="text-xs text-white/80">Stand Presenter</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stand name overlay at bottom-left */}
                    <div className="absolute bottom-6 left-6 sm:left-12 z-10">
                        <div className="px-5 py-3 rounded-xl backdrop-blur-md bg-white/20 border border-white/30 shadow-lg">
                            <p className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">
                                {stand.name}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
                <Container>
                    <div className="flex space-x-8 -mb-px">
                        <button
                            onClick={() => setActiveTab('resources')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'resources'
                                ? 'text-gray-900'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                            style={activeTab === 'resources' ? { borderColor: themeColor, color: themeColor } : undefined}
                        >
                            Resources
                        </button>
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'about'
                                ? 'text-gray-900'
                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }`}
                            style={activeTab === 'about' ? { borderColor: themeColor, color: themeColor } : undefined}
                        >
                            About
                        </button>
                    </div>
                </Container>
            </div>

            <Container className="py-8">
                {activeTab === 'resources' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-6">
                            <h3 className="text-lg font-bold text-gray-900">Documents & Videos</h3>
                            <StandResources standId={standId} />
                        </div>
                        <div>
                            <Card className="p-6 bg-indigo-50 border-indigo-100">
                                <h4 className="font-bold text-indigo-900 mb-2">Recommended for You</h4>
                                <p className="text-sm text-indigo-700 mb-4">
                                    Based on your profile, this stand matches your interest in <strong>AI Technology</strong>.
                                </p>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'about' && (
                    <Card className="p-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">About Us</h3>
                        <p className="text-gray-600 leading-relaxed">
                            {stand.description || "Company description coming soon."}
                        </p>
                    </Card>
                )}
            </Container>

            {/* Chat Panel */}
            {isChatOpen && (
                <ChatPanel
                    standId={standId}
                    standName={stand.name}
                    onClose={() => setIsChatOpen(false)}
                    avatarBg={avatarBg}
                />
            )}

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
            />
        </div>
    );
}
