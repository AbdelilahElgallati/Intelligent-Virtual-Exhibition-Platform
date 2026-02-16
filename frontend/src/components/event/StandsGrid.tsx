'use client';

import { useState, useEffect } from 'react';
import { Stand } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { StandCard } from '@/components/stand/StandCard';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Store } from 'lucide-react';

interface StandsGridProps {
    eventId: string;
}

export function StandsGrid({ eventId }: StandsGridProps) {
    const [stands, setStands] = useState<Stand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStands = async () => {
            try {
                const data = await apiClient.get<Stand[]>(ENDPOINTS.STANDS.LIST(eventId));
                setStands(data);
            } catch (err) {
                console.error('Failed to fetch stands', err);
                setError('Failed to load stands. Please try again later.');
            } finally {
                setLoading(false);
            }
        };
        fetchStands();
    }, [eventId]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-64 bg-gray-100 rounded-lg animate-pulse" />
                ))}
            </div>
        )
    }

    if (error) {
        return <div className="text-red-500 text-center py-10">{error}</div>;
    }

    if (stands.length === 0) {
        return (
            <EmptyState
                title="No stands yet"
                description="The exhibition hall is currently empty. Check back later!"
                icon={<Store className="w-12 h-12 text-gray-400" />}
            />
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {stands.map((stand) => (
                <StandCard key={stand.id} stand={stand} />
            ))}
        </div>
    );
}
