'use client';

import { use, Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/ui/LoadingState';
import MeetingRoom from '@/components/meetings/MeetingRoom';
import { Meeting, MeetingJoinResponse } from '@/types/meeting';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function MeetingRoomContent({ meetingId }: { meetingId: string }) {
    const router = useRouter();
    const [meeting, setMeeting] = useState<Meeting | null>(null);
    const [tokenData, setTokenData] = useState<MeetingJoinResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const token = localStorage.getItem('access_token');
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch the meeting token — this also validates participant access
                const tRes = await fetch(`${API_BASE}/meetings/${meetingId}/token`, { headers });
                if (!tRes.ok) {
                    const err = await tRes.json();
                    throw new Error(err.detail || 'Cannot join meeting');
                }
                const tData: MeetingJoinResponse = await tRes.json();
                setTokenData(tData);

                // Start the session (marks as live)
                await fetch(`${API_BASE}/meetings/${meetingId}/start`, {
                    method: 'POST',
                    headers,
                });
            } catch (e: any) {
                setError(e.message || 'Failed to join meeting');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [meetingId]);

    const handleEnd = async () => {
        const token = localStorage.getItem('access_token');
        // Best-effort end session
        await fetch(`${API_BASE}/meetings/${meetingId}/end`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        }).catch(() => { });
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
