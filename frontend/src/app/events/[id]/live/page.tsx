'use client';

import { Suspense, use, useState, useEffect } from 'react';
import { EventLiveLayout } from '@/components/event/EventLiveLayout';
import { StandsGrid } from '@/components/event/StandsGrid';
import { StandFilterModal, FilterValues } from '@/components/event/StandFilterModal';
import { ScheduleTab } from '@/components/event/ScheduleTab';
import { NetworkingTab } from '@/components/event/NetworkingTab';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Event } from '@/types/event';

function LiveEventContent({ eventId }: { eventId: string }) {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'overview';

    /* ── Visitor Onboarding State ── */
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [visitorPrefs, setVisitorPrefs] = useState<{ category?: string; search?: string } | undefined>(undefined);

    /* Check for saved visitor preferences on mount */
    useEffect(() => {
        // Check if we already have preferences saved for this event
        const key = `ivep_visitor_prefs_${eventId}`;
        const saved = localStorage.getItem(key);

        if (saved) {
            try {
                setVisitorPrefs(JSON.parse(saved));
                setShowOnboarding(false);
            } catch (e) {
                // Corrupted data, show onboarding
                setShowOnboarding(true);
            }
        } else {
            // No preferences found, show onboarding
            setShowOnboarding(true);
        }
    }, [eventId]);

    const handleOnboardingApply = (filters: FilterValues) => {
        const prefs = { category: filters.category, search: filters.search };
        localStorage.setItem(`ivep_visitor_prefs_${eventId}`, JSON.stringify(prefs));
        setVisitorPrefs(prefs);
        setShowOnboarding(false);
    };

    const handleOnboardingSkip = () => {
        const emptyPrefs = {};
        localStorage.setItem(`ivep_visitor_prefs_${eventId}`, JSON.stringify(emptyPrefs));
        setVisitorPrefs(emptyPrefs);
        setShowOnboarding(false);
    };

    return (
        <EventLiveLayout eventId={eventId}>
            {(event: Event | null) => (
                <>
                    {/* ── Visitor Onboarding Modal ── */}
                    {showOnboarding && (
                        <StandFilterModal
                            onApply={handleOnboardingApply}
                            onSkip={handleOnboardingSkip}
                        />
                    )}

                    {tab === 'overview' && (
                        <div className="space-y-6">
                            <Card className="p-8 text-center bg-gray-50 border-dashed">
                                <h3 className="text-xl font-medium text-gray-900">Welcome to the Live Event!</h3>
                                <p className="mt-2 text-gray-500">
                                    Explore the exhibition hall, visit stands, and network with other participants.
                                    Use the tabs above to navigate.
                                </p>
                            </Card>

                            <div className="mt-8">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Recommended for You</h3>
                                {!showOnboarding && (
                                    <StandsGrid
                                        eventId={eventId}
                                        showFilters={true}
                                        initialFilters={visitorPrefs}
                                        showPagination={true}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'stands' && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Exhibition Hall - All Stands</h2>
                            <StandsGrid eventId={eventId} showFilters={true} showPagination={true} />
                        </div>
                    )}

                    {tab === 'schedule' && (
                        <ScheduleTab event={event} />
                    )}

                    {tab === 'networking' && (
                        <NetworkingTab event={event} eventId={eventId} />
                    )}
                </>
            )}
        </EventLiveLayout>
    );
}

export default function LiveEventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <Suspense fallback={<LoadingState message="Loading event..." />}>
            <LiveEventContent eventId={id} />
        </Suspense>
    );
}
