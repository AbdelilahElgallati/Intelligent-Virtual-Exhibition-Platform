'use client';

import { use, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui/LoadingState';
import SpeakerRoom from '@/components/conferences/SpeakerRoom';
import { Conference, ConferenceTokenResponse } from '@/types/conference';
import { http } from '@/lib/http';

function SpeakerContent({ eventId, confId }: { eventId: string; confId: string }) {
    const router = useRouter();
    const [conf, setConf] = useState<Conference | null>(null);
    const [tokenData, setTokenData] = useState<ConferenceTokenResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                // Start the conference (auto-starts LiveKit server if needed)
                await http.post(`/conferences/${confId}/start`);

                const cData = await http.get<Conference>(`/conferences/${confId}`);
                setConf(cData);

                const tData = await http.get<ConferenceTokenResponse>(`/conferences/${confId}/speaker-token`);
                setTokenData(tData);
            } catch (e: any) {
                setError(e.message || 'Failed to connect');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [confId]);

    const handleEnd = async () => {
        await http.post(`/conferences/${confId}/end`);
        router.push(`/enterprise/events/${eventId}/manage`);
    };

    if (loading) return <LoadingState message="Setting up your broadcast…" />;

    if (error || !conf || !tokenData) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2 text-center">
                    {error || 'Could not start broadcast'}
                </h2>
                <p className="text-sm text-zinc-500 text-center max-w-md mb-5">
                    Please check your connection and make sure you are the assigned speaker for this conference. Try again in a moment.
                </p>
                <button
                    onClick={() => router.push(`/enterprise/events/${eventId}/manage`)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    ← Back to Event
                </button>
            </div>
        );
    }

    return (
        <SpeakerRoom
            token={tokenData.token}
            serverUrl={tokenData.livekit_url}
            conferenceId={confId}
            conferenceTitle={conf.title}
            attendeeCount={conf.attendee_count}
            onEndSession={handleEnd}
        />
    );
}

export default function EnterpriseSpeakerLivePage({
    params,
}: {
    params: Promise<{ eventId: string; confId: string }>;
}) {
    const { eventId, confId } = use(params);
    return (
        <Suspense fallback={<LoadingState message="Loading…" />}>
            <SpeakerContent eventId={eventId} confId={confId} />
        </Suspense>
    );
}
