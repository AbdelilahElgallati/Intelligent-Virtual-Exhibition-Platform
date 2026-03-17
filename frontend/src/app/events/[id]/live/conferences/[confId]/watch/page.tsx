'use client';

import { use, Suspense } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import AudienceRoom from '@/components/conferences/AudienceRoom';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Conference, ConferenceTokenResponse } from '@/types/conference';

import { http } from '@/lib/http';

interface Props {
    params: Promise<{ id: string; confId: string }>;
}

function WatchContent({ eventId, confId }: { eventId: string; confId: string }) {
    const router = useRouter();
    const [conf, setConf] = useState<Conference | null>(null);
    const [tokenData, setTokenData] = useState<ConferenceTokenResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const cData = await http.get<Conference>(`/conferences/${confId}`);
                setConf(cData);

                if (cData.status !== 'live') {
                    setError(cData.status === 'scheduled'
                        ? 'This conference has not started yet. Come back when it goes live!'
                        : 'This conference has ended.');
                    setLoading(false);
                    return;
                }

                const tData = await http.get<ConferenceTokenResponse>(`/conferences/${confId}/token`);
                setTokenData(tData);
            } catch (e: any) {
                setError(e.message || 'Failed to load conference');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [confId]);

    if (loading) return <LoadingState message="Joining conference…" />;

    if (error || !conf) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-5">🎙️</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">
                    {error || 'Conference not available'}
                </h2>
                <button
                    onClick={() => router.push(`/events/${eventId}/live?tab=conferences`)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    ← Back to Event
                </button>
            </div>
        );
    }

    if (!tokenData) return <LoadingState message="Getting your access token…" />;

    return (
        <AudienceRoom
            token={tokenData.token}
            serverUrl={tokenData.livekit_url}
            conferenceId={confId}
            conferenceTitle={conf.title}
            attendeeCount={conf.attendee_count}
            onLeave={() => router.push(`/events/${eventId}/live?tab=conferences`)}
        />
    );
}

export default function WatchConferencePage({ params }: Props) {
    const { id, confId } = use(params);
    return (
        <Suspense fallback={<LoadingState message="Loading…" />}>
            <WatchContent eventId={id} confId={confId} />
        </Suspense>
    );
}
