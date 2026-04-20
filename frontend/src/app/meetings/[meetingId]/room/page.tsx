'use client';

import { use, Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui/LoadingState';
import MeetingRoom from '@/components/meetings/MeetingRoom';
import { MeetingJoinResponse } from '@/types/meeting';
import { apiClient } from '@/lib/api/client';
import { useTranslation } from 'react-i18next';

function MeetingRoomContent({ meetingId }: Readonly<{ meetingId: string }>) {
    const { t } = useTranslation();
    const router = useRouter();
    const [tokenData, setTokenData] = useState<MeetingJoinResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const autoEndMeeting = useCallback(async () => {
        try {
            await apiClient.post(`/meetings/${meetingId}/end`);
        } catch {
            // Best-effort, server may already have auto-closed this meeting.
        }
        setError(t('visitor.meetingRoom.meetingEnded'));
        setTimeout(() => router.back(), 1200);
    }, [meetingId, router, t]);

    useEffect(() => {
        async function load() {
            try {
                // Fetch the meeting token — this also validates participant access
                const tData = await apiClient.get<MeetingJoinResponse>(`/meetings/${meetingId}/token`);
                setTokenData(tData);

                // Start the session (marks as live)
                await apiClient.post(`/meetings/${meetingId}/start`);
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : t('visitor.meetingRoom.connectionFailed'));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [meetingId, t]);

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

        const timer = globalThis.setTimeout(() => {
            autoEndMeeting();
        }, delay);

        return () => globalThis.clearTimeout(timer);
    }, [tokenData?.ends_at, autoEndMeeting]);

    const handleEnd = async () => {
        // Best-effort end session
        await apiClient.post(`/meetings/${meetingId}/end`).catch(() => { });
        router.back();
    };

    if (loading) return <LoadingState message={t('visitor.meetingRoom.connecting')} />;

    if (error || !tokenData) {
        return (
            <div style={{
                minHeight: '100vh', background: '#060B18', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: 24, gap: 16,
            }}>
                <div style={{ fontSize: 56 }}>🔒</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}>
                    {error || t('visitor.meetingRoom.cannotJoin')}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', maxWidth: 380 }}>
                    {error && /not started yet/i.test(error)
                        ? t('visitor.meetingRoom.timeRestriction')
                        : t('visitor.meetingRoom.approvalRequired')}
                </p>
                <button
                    onClick={() => router.back()}
                    style={{
                        background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none',
                        borderRadius: 10, color: '#fff', padding: '10px 24px',
                        fontWeight: 600, cursor: 'pointer', fontSize: 14,
                    }}
                >
                    {`← ${t('visitor.meetingRoom.goBack')}`}
                </button>
            </div>
        );
    }

    return (
        <MeetingRoom
            token={tokenData.token}
            roomUrl={tokenData.room_url}
            startsAt={tokenData.starts_at}
            endsAt={tokenData.ends_at}
            onSessionEnd={handleEnd}
        />
    );
}

export default function MeetingRoomPage({ params }: Readonly<{ params: Promise<{ meetingId: string }> }>) {
    const { t } = useTranslation();
    const { meetingId } = use(params);
    return (
        <Suspense fallback={<LoadingState message={t('common.messages.loading')} />}>
            <MeetingRoomContent meetingId={meetingId} />
        </Suspense>
    );
}
