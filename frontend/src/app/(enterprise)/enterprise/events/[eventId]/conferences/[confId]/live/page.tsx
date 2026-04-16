'use client';

import { use, useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '@/components/ui/LoadingState';
import SpeakerRoom from '@/components/conferences/SpeakerRoom';
import { Conference, ConferenceTokenResponse } from '@/types/conference';
import { http } from '@/lib/http';
import { Event } from '@/types/event';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { getEventLifecycle, formatTimeToStart } from '@/lib/eventLifecycle';

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 15000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
            reject(new Error(`${label} timed out. Please check your connection and retry.`));
        }, timeoutMs);

        promise
            .then((value) => {
                window.clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                window.clearTimeout(timer);
                reject(error);
            });
    });
}

function SpeakerContent({ eventId, confId }: { eventId: string; confId: string }) {
    const router = useRouter();
    const { t } = useTranslation('enterprise');
    const [conf, setConf] = useState<Conference | null>(null);
    const [tokenData, setTokenData] = useState<ConferenceTokenResponse | null>(null);
    const [eventData, setEventData] = useState<Event | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState(t('enterprise.eventManagement.conferences.live.setupBroadcast'));
    const [reloadTick, setReloadTick] = useState(0);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());

    const lifecycle = eventData ? getEventLifecycle(eventData, new Date(timelineNow)) : null;
    const hasLiveAccess = lifecycle?.accessState === 'OPEN_SLOT_ACTIVE';

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                setLoadingMessage(t('enterprise.eventManagement.conferences.live.checkingTimeline'));
                const evt = await withTimeout(
                    apiClient.get<Event>(ENDPOINTS.EVENTS.GET(eventId)),
                    'Loading event timeline'
                );
                if (cancelled) return;
                setEventData(evt);

                const currentLifecycle = getEventLifecycle(evt, new Date());
                if (currentLifecycle.accessState !== 'OPEN_SLOT_ACTIVE') {
                    if (cancelled) return;
                    setError(
                        !currentLifecycle.hasScheduleSlots
                            ? t('enterprise.eventManagement.conferences.live.timelineNotPublished')
                            : currentLifecycle.displayState === 'ENDED'
                              ? t('enterprise.eventManagement.conferences.live.timelineEnded')
                              : formatTimeToStart(currentLifecycle.nextSlot?.start || null)
                    );
                    setLoading(false);
                    return;
                }

                setLoadingMessage(t('enterprise.eventManagement.conferences.live.loadingDetails'));
                const existingConf = await withTimeout(
                    http.get<Conference>(`/conferences/${confId}`),
                    'Loading conference details'
                );

                // When speaker rejoins an already-live room, avoid re-starting it.
                if (existingConf.status !== 'live') {
                    setLoadingMessage(t('enterprise.eventManagement.conferences.live.startingRoom'));
                    await withTimeout(
                        http.post(`/conferences/${confId}/start`, {}),
                        'Starting conference room'
                    );
                    if (cancelled) return;
                }

                const cData = existingConf.status === 'live'
                    ? existingConf
                    : await withTimeout(
                        http.get<Conference>(`/conferences/${confId}`),
                        'Refreshing conference details'
                    );
                if (cancelled) return;
                setConf(cData);

                setLoadingMessage(t('enterprise.eventManagement.conferences.live.requestingToken'));
                const tData = await withTimeout(
                    http.get<ConferenceTokenResponse>(`/conferences/${confId}/speaker-token`),
                    'Requesting live access token'
                );
                if (cancelled) return;
                setTokenData(tData);
            } catch (e: unknown) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : t('enterprise.eventManagement.conferences.live.failedConnect'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();

        return () => {
            cancelled = true;
        };
    }, [confId, eventId, reloadTick]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    const handleEnd = useCallback(async () => {
        await http.post(`/conferences/${confId}/end`, {});
        router.push(`/enterprise/events/${eventId}/manage`);
    }, [confId, eventId, router]);

    const refreshSpeakerToken = useCallback(async () => {
        const refreshed = await withTimeout(
            http.get<ConferenceTokenResponse>(`/conferences/${confId}/speaker-token`),
            'Refreshing live access token'
        );
        setTokenData(refreshed);
        return refreshed.token;
    }, [confId]);

    useEffect(() => {
        if (!tokenData || !eventData) return;
        if (!hasLiveAccess) {
            handleEnd().catch(() => {
                router.push(`/enterprise/events/${eventId}/manage`);
            });
        }
    }, [tokenData, eventData, hasLiveAccess, handleEnd, eventId, router]);

    if (loading) return <LoadingState message={loadingMessage} />;

    if (error || !conf || !tokenData) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2 text-center">
                    {error || t('enterprise.eventManagement.conferences.live.startFailed')}
                </h2>
                <p className="text-sm text-zinc-500 text-center max-w-md mb-5">
                    {t('enterprise.eventManagement.conferences.live.startFailedHint')}
                </p>
                <button
                    onClick={() => setReloadTick((prev) => prev + 1)}
                    className="px-6 py-2.5 border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 font-semibold rounded-xl transition-colors text-sm"
                >
                    {t('enterprise.eventManagement.conferences.live.retrySetup')}
                </button>
                <button
                    onClick={() => router.push(`/enterprise/events/${eventId}/manage`)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    {t('enterprise.eventManagement.conferences.live.backToEvent')}
                </button>
            </div>
        );
    }

    return (
        <SpeakerRoom
            token={tokenData.token}
            roomUrl={tokenData.room_url}
            conferenceId={confId}
            conferenceTitle={conf.title}
            conferenceDescription={conf.description}
            speakerName={conf.speaker_name}
            enterpriseName={conf.assigned_enterprise_name}
            startTime={conf.start_time}
            endTime={conf.end_time}
            attendeeCount={conf.attendee_count}
            qaEnabled={conf.qa_enabled}
            eventId={eventId}
            onEndSession={handleEnd}
            onRefreshToken={refreshSpeakerToken}
        />
    );
}

export default function EnterpriseSpeakerLivePage({
    params,
}: {
    params: Promise<{ eventId: string; confId: string }>;
}) {
    const { t } = useTranslation('enterprise');
    const { eventId, confId } = use(params);
    return (
        <Suspense fallback={<LoadingState message={t('enterprise.eventManagement.conferences.live.loading')} />}>
            <SpeakerContent eventId={eventId} confId={confId} />
        </Suspense>
    );
}
