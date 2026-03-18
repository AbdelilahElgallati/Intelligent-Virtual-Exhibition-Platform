'use client';

import { use, Suspense } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import AudienceRoom from '@/components/conferences/AudienceRoom';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Conference, ConferenceTokenResponse } from '@/types/conference';
import { Event } from '@/types/event';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { ParticipantStatus } from '@/lib/api/types';

import { http } from '@/lib/http';

interface Props {
    params: Promise<{ id: string; confId: string }>;
}

function WatchContent({ eventId, confId }: { eventId: string; confId: string }) {
    const router = useRouter();
    const [conf, setConf] = useState<Conference | null>(null);
    const [tokenData, setTokenData] = useState<ConferenceTokenResponse | null>(null);
    const [eventData, setEventData] = useState<Event | null>(null);
    const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('NOT_JOINED');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());

    const lifecycle = eventData ? getEventLifecycle(eventData, new Date(timelineNow)) : null;
    // Allow access when participant is approved and the conference is live.
    // The backend already validates the event timeline when issuing audience tokens,
    // so we don't double-gate on the frontend schedule slots.
    const isApprovedParticipant = participantStatus === 'APPROVED' || participantStatus === 'GUEST_APPROVED';
    const hasLiveAccess = isApprovedParticipant && conf?.status === 'live';

    useEffect(() => {
        async function load() {
            try {
                const [cData, evtData, statusData] = await Promise.all([
                    http.get<Conference>(`/conferences/${confId}`),
                    apiClient.get<Event>(ENDPOINTS.EVENTS.GET(eventId)).catch(() => null),
                    apiClient
                        .get<{ status: ParticipantStatus }>(ENDPOINTS.EVENTS.MY_STATUS(eventId))
                        .catch(() => ({ status: 'NOT_JOINED' as ParticipantStatus })),
                ]);

                setConf(cData);
                setEventData(evtData);
                setParticipantStatus(statusData.status || 'NOT_JOINED');

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
    }, [confId, eventId]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    if (loading) return <LoadingState message="Joining conference…" />;

    if (!isApprovedParticipant) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-5">🔒</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">Registration Required</h2>
                <p className="text-zinc-500 text-sm text-center max-w-md">
                    You need approved participation to join conference sessions.
                </p>
                <button
                    onClick={() => router.push(`/events/${eventId}`)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    Go to Event
                </button>
            </div>
        );
    }

    if (!hasLiveAccess) {
        const isBetweenSlots = Boolean(
            lifecycle && lifecycle.hasScheduleSlots && lifecycle.status === 'upcoming' && lifecycle.withinScheduleWindow
        );
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-5">🕒</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">
                    {conf?.status === 'scheduled'
                        ? 'Conference Not Started Yet'
                        : conf?.status === 'ended'
                          ? 'Conference Has Ended'
                          : !lifecycle?.hasScheduleSlots
                            ? 'Timeline Not Published Yet'
                            : lifecycle?.status === 'ended'
                              ? 'Event Timeline Ended'
                              : isBetweenSlots
                                ? 'Event In Progress'
                                : 'Event Not Live Yet'}
                </h2>
                <p className="text-zinc-500 text-sm text-center max-w-md">
                    {conf?.status === 'scheduled'
                        ? 'This conference has not started yet. Come back when the speaker goes live!'
                        : conf?.status === 'ended'
                          ? 'This conference has ended.'
                          : !lifecycle?.hasScheduleSlots
                            ? 'Conference access is enabled only during published live schedule slots.'
                            : lifecycle?.status === 'ended'
                              ? 'This event has ended, so conference access is now closed.'
                              : isBetweenSlots
                                ? 'There is no active slot right now. Access opens automatically at the next slot.'
                                : formatTimeToStart(lifecycle?.nextSlotStart || null)}
                </p>
                <button
                    onClick={() => router.push(`/events/${eventId}/live?tab=conferences`)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    ← Back to Event
                </button>
            </div>
        );
    }

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

    const refreshAudienceToken = async () => {
        const tData = await http.get<ConferenceTokenResponse>(`/conferences/${confId}/token`);
        setTokenData(tData);
        return tData.token;
    };

    return (
        <AudienceRoom
            token={tokenData.token}
            serverUrl={tokenData.livekit_url}
            conferenceId={confId}
            conferenceTitle={conf.title}
            conferenceDescription={conf.description}
            speakerName={conf.speaker_name}
            enterpriseName={conf.assigned_enterprise_name}
            startTime={conf.start_time}
            endTime={conf.end_time}
            attendeeCount={conf.attendee_count}
            qaEnabled={conf.qa_enabled}
            onLeave={() => router.push(`/events/${eventId}/live?tab=conferences`)}
            onRefreshToken={refreshAudienceToken}
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
