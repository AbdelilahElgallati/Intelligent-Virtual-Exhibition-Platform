'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Conference } from '@/types/conference';
import ConferenceCard from './ConferenceCard';

interface EventConferencesTabProps {
    eventId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default function EventConferencesTab({ eventId }: EventConferencesTabProps) {
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'live' | 'scheduled' | 'ended'>('all');

    const load = useCallback(async () => {
        try {
            const token = localStorage.getItem('access_token');
            const params = new URLSearchParams({ event_id: eventId });
            if (filter !== 'all') params.set('status', filter);
            const res = await fetch(`${API_BASE}/conferences/?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setConferences(data);
            }
        } finally {
            setLoading(false);
        }
    }, [eventId, filter]);

    useEffect(() => { load(); }, [load]);

    // Auto-refresh every 15s when a live conference might start
    useEffect(() => {
        const interval = setInterval(load, 15000);
        return () => clearInterval(interval);
    }, [load]);

    const register = async (confId: string) => {
        const token = localStorage.getItem('access_token');
        await fetch(`${API_BASE}/conferences/${confId}/register`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        load();
    };

    const unregister = async (confId: string) => {
        const token = localStorage.getItem('access_token');
        await fetch(`${API_BASE}/conferences/${confId}/register`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        load();
    };

    const liveCount = conferences.filter((c) => c.status === 'live').length;

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', margin: '0 0 6px 0' }}>
                    🎙️ Live Conferences & Talks
                </h2>
                <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                    Register for upcoming sessions or join live broadcasts from enterprise speakers.
                </p>
                {liveCount > 0 && (
                    <div style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.3)',
                        borderRadius: 20,
                        padding: '6px 14px',
                    }}>
                        <span style={{
                            width: 8, height: 8, background: '#10b981', borderRadius: '50%',
                            animation: 'pulse 2s infinite', display: 'inline-block'
                        }}></span>
                        <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>
                            {liveCount} session{liveCount > 1 ? 's' : ''} live now
                        </span>
                    </div>
                )}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {(['all', 'live', 'scheduled', 'ended'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 20,
                            border: filter === f ? '1px solid #4f46e5' : '1px solid #e2e8f0',
                            background: filter === f ? '#4f46e5' : 'white',
                            color: filter === f ? 'white' : '#64748b',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textTransform: 'capitalize',
                        }}
                    >
                        {f === 'all' ? 'All' : f === 'live' ? '🔴 Live' : f === 'scheduled' ? '⏰ Upcoming' : '✅ Past'}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div style={{
                        width: 40, height: 40,
                        border: '3px solid #e2e8f0',
                        borderTopColor: '#4f46e5',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                </div>
            )}

            {/* Empty */}
            {!loading && conferences.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: '#f8fafc',
                    borderRadius: 16,
                    border: '2px dashed #e2e8f0',
                }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 8px 0' }}>
                        No conferences yet
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: 14 }}>
                        Organizers will schedule live talks and conferences here.
                    </p>
                </div>
            )}

            {/* Cards */}
            {!loading && conferences.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: 20,
                }}>
                    {conferences.map((conf) => (
                        <ConferenceCard
                            key={conf._id}
                            conference={conf}
                            eventId={eventId}
                            onRegister={register}
                            onUnregister={unregister}
                        />
                    ))}
                </div>
            )}

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; } 
          50% { opacity: 0.4; }
        }
      `}</style>
        </div>
    );
}
