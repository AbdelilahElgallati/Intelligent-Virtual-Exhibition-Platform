'use client';

import { use, Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui/LoadingState';
import MeetingRoom from '@/components/meetings/MeetingRoom';
import { MeetingJoinResponse } from '@/types/meeting';
import { apiClient } from '@/lib/api/client';
import { Event } from '@/types/event';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { getEventLifecycle } from '@/lib/eventLifecycle';

type MeetingLite = {
    _id?: string;
    id?: string;
    event_id?: string;
};

function MeetingRoomContent({ meetingId }: { meetingId: string }) {
    const router = useRouter();
    const [tokenData, setTokenData] = useState<MeetingJoinResponse | null>(null);
    const [eventData, setEventData] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timelineNow, setTimelineNow] = useState<number>(Date.now());

    const autoEndMeeting = useCallback(async () => {
        try {
            await apiClient.post(`/meetings/${meetingId}/end`);
        } catch {
            // Best-effort, server may already have auto-closed this meeting.
        }
        setError('Meeting timeslot ended automatically.');
        setTimeout(() => router.back(), 1200);
    }, [meetingId, router]);

    useEffect(() => {
        async function load() {
            try {
                // Fetch the meeting token — this also validates participant access
                const tData = await apiClient.get<MeetingJoinResponse>(`/meetings/${meetingId}/token`);
                setTokenData(tData);

                // Resolve meeting event for lifecycle gating.
                try {
                    const myMeetings = await apiClient.get<MeetingLite[]>('/meetings/my-meetings');
                    const matched = myMeetings.find((m) => (m.id || m._id) === meetingId);
                    if (matched?.event_id) {
                        const evt = await apiClient.get<Event>(ENDPOINTS.EVENTS.GET(matched.event_id));
                        setEventData(evt);
                    }
                } catch {
                    // Keep meeting join flow resilient if event lookup fails.
                }

                // Start the session (marks as live)
                await apiClient.post(`/meetings/${meetingId}/start`);
            } catch (e: any) {
                setError(e.message || 'Failed to join meeting');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [meetingId]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimelineNow(Date.now());
        }, 30000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const endsAt = tokenData?.ends_at;
        if (!endsAt) return;

        const endAtMs = new Date(endsAt).getTime();
        if (!Number.isFinite(endAtMs)) return;

        const delay = endAtMs - Date.now();
        if (delay <= 0) {
            autoEndMeeting();
            return;
        }

        const timer = window.setTimeout(() => {
            autoEndMeeting();
        }, delay);

        return () => window.clearTimeout(timer);
    }, [tokenData?.ends_at, autoEndMeeting]);

    useEffect(() => {
        if (!tokenData || !eventData) return;
        const lifecycle = getEventLifecycle(eventData, new Date(timelineNow));
        const timelineIsLive = lifecycle.hasScheduleSlots && lifecycle.status === 'live';
        if (!timelineIsLive) {
            autoEndMeeting();
        }
    }, [tokenData, eventData, timelineNow, autoEndMeeting]);

    const handleEnd = async () => {
        // Best-effort end session
        await apiClient.post(`/meetings/${meetingId}/end`).catch(() => { });
        router.back();
    };

    if (loading) return <LoadingState message="Connecting to meeting room…" />;

    if (error || !tokenData) {
        return (
            <div style={{
                minHeight: '100vh', background: '#060B18', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: 24, gap: 16,
            }}>
                <div style={{ fontSize: 56 }}>🔒</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}>
                    {error || 'Cannot join this meeting'}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', maxWidth: 380 }}>
                    The meeting must be approved and you must be a participant to join.
                </p>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none',
                        borderRadius: 10, color: '#fff', padding: '10px 24px',
                        fontWeight: 600, cursor: 'pointer', fontSize: 14,
                    }}
                >
                    ← Go Back
                </button>
            </div>
        );
    }

    return (
        <MeetingRoom
            token={tokenData.token}
            serverUrl={tokenData.livekit_url}
            onSessionEnd={handleEnd}
        />
    );
}

export default function MeetingRoomPage({ params }: { params: Promise<{ meetingId: string }> }) {
    const { meetingId } = use(params);
    return (
        <Suspense fallback={<LoadingState message="Loading…" />}>
            <MeetingRoomContent meetingId={meetingId} />
        </Suspense>
    );
}
