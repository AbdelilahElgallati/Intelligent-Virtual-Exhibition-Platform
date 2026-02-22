'use client';

import { Suspense, use } from 'react';
import { EventLiveLayout } from '@/components/event/EventLiveLayout';
import { StandsGrid } from '@/components/event/StandsGrid';
import { LoadingState } from '@/components/ui/LoadingState';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';

function LiveEventContent({ eventId }: { eventId: string }) {
    const searchParams = useSearchParams();
    const tab = searchParams.get('tab') || 'overview';

    return (
        <EventLiveLayout eventId={eventId}>
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
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Featured Stands</h3>
                        <StandsGrid eventId={eventId} showFilters={false} />
                    </div>
                </div>
            )}

            {tab === 'stands' && (
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Exhibition Hall</h2>
                    <StandsGrid eventId={eventId} showFilters={true} />
                </div>
            )}

            {tab === 'schedule' && (
                <Card className="p-12 text-center text-gray-500">
                    Schedule coming soon...
                </Card>
            )}

            {tab === 'networking' && (
                <Card className="p-12 text-center text-gray-500">
                    Networking area coming soon...
                </Card>
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
