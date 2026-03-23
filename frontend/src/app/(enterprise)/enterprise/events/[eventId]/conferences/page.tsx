'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Conference } from '@/types/conference';
import { LoadingState } from '@/components/ui/LoadingState';
import { http } from '@/lib/http';

function EnterpriseConferencesContent({ eventId }: { eventId: string }) {
    const router = useRouter();
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await http.get<Conference[]>('/conferences/my-assigned');
            // Filter to this event's conferences
            setConferences((data || []).filter((c: Conference) => c.event_id === eventId));
        } finally { setLoading(false); }
    }, [eventId]);

    useEffect(() => { load(); }, [load]);

    const startConference = async (confId: string) => {
        try {
            await http.post(`/conferences/${confId}/start`, {});
            router.push(`/enterprise/events/${eventId}/conferences/${confId}/live`);
        } catch (err: any) {
            alert(err?.message || 'Failed to start session');
        }
    };

    if (loading) return <LoadingState message="Loading your conferences…" />;

    return (
        <div style={{ minHeight: '100vh', background: '#060B18', color: '#e2e8f0', padding: '32px 24px', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <button
                    onClick={() => router.back()}
                    style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 14, marginBottom: 24, padding: 0 }}
                >
                    ← Back
                </button>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0' }}>My Assigned Conferences</h1>
                <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 32px 0' }}>
                    Conferences assigned to you by the event organizer. Click "Go Live" when ready to broadcast.
                </p>

                {conferences.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '60px 20px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: 16,
                        border: '2px dashed rgba(255,255,255,0.08)',
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                        <h3 style={{ fontWeight: 700, fontSize: 18, margin: '0 0 8px 0' }}>No conferences assigned</h3>
                        <p style={{ color: '#64748b', fontSize: 14 }}>The organizer will assign conferences to you.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {conferences.map((conf) => {
                            const start = new Date(conf.start_time);
                            const now = new Date();
                            const minutesUntil = (start.getTime() - now.getTime()) / 60000;
                            const canGoLive = conf.status === 'scheduled' && minutesUntil <= 20;
                            const isLive = conf.status === 'live';

                            return (
                                <div key={conf._id} style={{
                                    background: 'linear-gradient(135deg,rgba(15,20,40,0.9),rgba(25,30,55,0.9))',
                                    border: isLive ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(139,92,246,0.2)',
                                    borderRadius: 16, padding: '24px 28px',
                                    display: 'flex', flexDirection: 'column', gap: 12,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <span style={{
                                                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, marginBottom: 8,
                                                display: 'inline-block',
                                                background: isLive ? 'rgba(16,185,129,0.15)' : 'rgba(79,70,229,0.15)',
                                                color: isLive ? '#34d399' : '#818cf8',
                                                textTransform: 'uppercase',
                                            }}>
                                                {isLive ? '🔴 Live Now' : conf.status}
                                            </span>
                                            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '6px 0 4px 0', color: '#f1f5f9' }}>{conf.title}</h3>
                                            {conf.description && (
                                                <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>{conf.description}</p>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: 13, color: '#64748b' }}>
                                            <div>{start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                                            <div style={{ fontWeight: 600 }}>
                                                {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div style={{ marginTop: 4, color: '#7c3aed' }}>👥 {conf.attendee_count} registered</div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 10 }}>
                                        {isLive && (
                                            <button
                                                onClick={() => router.push(`/enterprise/events/${eventId}/conferences/${conf._id}/live`)}
                                                style={{
                                                    background: 'linear-gradient(135deg,#10b981,#059669)',
                                                    border: 'none', borderRadius: 10, color: '#fff',
                                                    padding: '10px 24px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
                                                    boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                                                }}
                                            >
                                                Re-enter Speaker Room →
                                            </button>
                                        )}
                                        {conf.status === 'scheduled' && (
                                            <button
                                                onClick={() => canGoLive ? startConference(conf._id) : null}
                                                disabled={!canGoLive}
                                                style={{
                                                    background: canGoLive
                                                        ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                                                        : 'rgba(255,255,255,0.05)',
                                                    border: canGoLive ? 'none' : '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: 10, color: canGoLive ? '#fff' : '#64748b',
                                                    padding: '10px 24px', fontWeight: 700,
                                                    cursor: canGoLive ? 'pointer' : 'not-allowed', fontSize: 13,
                                                }}
                                                title={!canGoLive ? `Go Live available 20 minutes before start (${Math.ceil(minutesUntil)} min away)` : ''}
                                            >
                                                {canGoLive ? '🔴 Go Live' : `⏰ Go Live in ${Math.ceil(minutesUntil)} min`}
                                            </button>
                                        )}
                                        {conf.status === 'ended' && (
                                            <span style={{ color: '#64748b', fontSize: 13, padding: '10px 0' }}>✅ Session ended</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function EnterpriseEventConferencesPage({ params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = use(params);
    return (
        <Suspense fallback={<LoadingState message="Loading…" />}>
            <EnterpriseConferencesContent eventId={eventId} />
        </Suspense>
    );
}
