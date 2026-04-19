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
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

import { http } from '@/lib/http';

interface Props {
    params: Promise<{ id: string; confId: string }>;
}

function WatchContent({ eventId, confId }: { eventId: string; confId: string }) {
    const { t } = useTranslation();
    const router = useRouter();
    const { user } = useAuth();
    const [conf, setConf] = useState<Conference | null>(null);
    const [tokenData, setTokenData] = useState<ConferenceTokenResponse | null>(null);
    const [eventData, setEventData] = useState<Event | null>(null);
    const [participantStatus, setParticipantStatus] = useState<ParticipantStatus>('NOT_JOINED');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());

    const lifecycle = eventData ? getEventLifecycle(eventData, new Date(timelineNow)) : null;
    
    // Check if user has a privileged role
    const isPrivileged = user?.role === 'admin' || user?.role === 'organizer';
    
    // Allow access when participant is approved, or if the user is an admin/organizer.
    const isApprovedParticipant = isPrivileged || participantStatus === 'APPROVED' || participantStatus === 'GUEST_APPROVED';
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
                        ? t('events.conferenceWatch.statusMessage.scheduled')
                        : t('events.conferenceWatch.statusMessage.ended'));
                    setLoading(false);
                    return;
                }

                const tData = await http.get<ConferenceTokenResponse>(`/conferences/${confId}/token`);
                setTokenData(tData);
            } catch (e: any) {
                if (e.status === 403 && e.message?.toLowerCase().includes('register')) {
                    setError('CONFERENCE_REGISTRATION_REQUIRED');
                } else {
                    setError(e.message || t('events.conferenceWatch.errors.loadFailed'));
                }
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [confId, eventId, t]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    if (loading) return <LoadingState message={t('events.conferenceWatch.loading.joining')} />;

    if (!isApprovedParticipant) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-5">🔒</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">{t('events.conferenceWatch.registrationRequired.title')}</h2>
                <p className="text-zinc-500 text-sm text-center max-w-md">
                    {t('events.conferenceWatch.registrationRequired.message')}
                </p>
                <button
                    onClick={() => router.push(`/events/${eventId}`)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    {t('events.conferenceWatch.actions.goToEvent')}
                </button>
            </div>
        );
    }

    if (!hasLiveAccess) {
        const isBetweenSlots = Boolean(lifecycle && lifecycle.isBetweenSlots);
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-5">🕒</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">
                    {conf?.status === 'scheduled'
                        ? t('events.conferenceWatch.statusTitle.scheduled')
                        : conf?.status === 'ended'
                          ? t('events.conferenceWatch.statusTitle.ended')
                          : !lifecycle?.hasScheduleSlots
                            ? t('events.conferenceWatch.statusTitle.timelineNotPublished')
                            : lifecycle?.displayState === 'ENDED'
                              ? t('events.conferenceWatch.statusTitle.eventTimelineEnded')
                              : isBetweenSlots
                                ? t('events.conferenceWatch.statusTitle.eventInProgress')
                                : t('events.conferenceWatch.statusTitle.eventNotLiveYet')}
                </h2>
                <p className="text-zinc-500 text-sm text-center max-w-md">
                    {conf?.status === 'scheduled'
                        ? t('events.conferenceWatch.statusMessage.scheduled')
                        : conf?.status === 'ended'
                          ? t('events.conferenceWatch.statusMessage.ended')
                          : !lifecycle?.hasScheduleSlots
                            ? t('events.conferenceWatch.statusMessage.timelineNotPublished')
                            : lifecycle?.displayState === 'ENDED'
                              ? t('events.conferenceWatch.statusMessage.eventEnded')
                              : isBetweenSlots
                                ? t('events.conferenceWatch.statusMessage.betweenSlots')
                                : formatTimeToStart(lifecycle?.nextSlot?.start || null)}
                </p>
                <button
                    onClick={() => router.push(`/events/${eventId}/live?tab=conferences`)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    {t('events.conferenceWatch.actions.backToEvent')}
                </button>
            </div>
        );
    }

    if (error || !conf) {
        if (error === 'CONFERENCE_REGISTRATION_REQUIRED') {
            return (
                <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                    <div className="text-6xl mb-5">📝</div>
                    <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">{t('events.conferenceWatch.sessionRegistrationRequired.title')}</h2>
                    <p className="text-zinc-500 text-sm text-center max-w-md">
                        {t('events.conferenceWatch.sessionRegistrationRequired.message')}
                    </p>
                    <button
                        onClick={() => router.push(`/events/${eventId}/live?tab=conferences`)}
                        className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                    >
                        {t('events.conferenceWatch.actions.registerNow')}
                    </button>
                </div>
            );
        }
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-5">🎙️</div>
                <h2 className="text-xl font-bold text-zinc-900 mb-3 text-center">
                    {error || t('events.conferenceWatch.errors.notAvailable')}
                </h2>
                <button
                    onClick={() => router.push(`/events/${eventId}/live?tab=conferences`)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                    {t('events.conferenceWatch.actions.backToEvent')}
                </button>
            </div>
        );
    }

    if (!tokenData) return <LoadingState message={t('events.conferenceWatch.loading.gettingToken')} />;

    const refreshAudienceToken = async () => {
        const tData = await http.get<ConferenceTokenResponse>(`/conferences/${confId}/token`);
        setTokenData(tData);
        return tData.token;
    };

    return (
        <AudienceRoom
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
            onLeave={() => router.push(`/events/${eventId}/live?tab=conferences`)}
            onRefreshToken={refreshAudienceToken}
        />
    );
}

export default function WatchConferencePage({ params }: Props) {
    const { t } = useTranslation();
    const { id, confId } = use(params);
    return (
        <Suspense fallback={<LoadingState message={t('events.conferenceWatch.loading.default')} />}>
            <WatchContent eventId={id} confId={confId} />
        </Suspense>
    );
}
