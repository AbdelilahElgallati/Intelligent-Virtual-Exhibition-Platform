"use client";

import Link from 'next/link';
import { Container } from '@/components/common/Container';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { favoritesService, Favorite } from '@/services/favorites.service';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Stand } from '@/lib/api/types';

export default function FavoritesPage() {
    const { isAuthenticated } = useAuth();
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;
        const load = async () => {
            try {
                setLoading(true);
                const data = await favoritesService.list();
                setFavorites(data);
            } catch (err) {
                console.error(err);
                setError('Failed to load favorites');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isAuthenticated]);

    const handleRemove = async (id: string) => {
        try {
            await favoritesService.remove(id);
            setFavorites((prev) => prev.filter((f) => f.id !== id));
        } catch (err) {
            console.error(err);
            setError('Failed to remove favorite');
        }
    };

    return (
        <Container className="py-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600"><Heart className="w-5 h-5" /></div>
                    <div>
                        <p className="text-sm font-semibold text-rose-600">Your saved items</p>
                        <h1 className="text-3xl font-bold text-gray-900">Favorites</h1>
                    </div>
                </div>

                {!isAuthenticated ? (
                    <EmptyState
                        title="Login to view favorites"
                        description="Sign in to see events, stands, and resources you’ve saved."
                        action={
                            <div className="flex gap-3">
                                <Link href="/auth/login"><Button size="sm">Login</Button></Link>
                                <Link href="/auth/register"><Button variant="outline" size="sm">Register</Button></Link>
                            </div>
                        }
                    />
                ) : (
                    <FavoritesList
                        favorites={favorites}
                        loading={loading}
                        error={error}
                        onRemove={handleRemove}
                    />
                )}
            </div>
        </Container>
    );
}

type GroupKey = Favorite['target_type'];

function FavoritesList({
    favorites,
    loading,
    error,
    onRemove,
}: {
    favorites: Favorite[];
    loading: boolean;
    error: string | null;
    onRemove: (id: string) => void;
}) {
    const [standEventMap, setStandEventMap] = useState<Record<string, string>>({});

    // Resolve stand -> event ids so links are correct even when the incoming route lacks event context.
    useEffect(() => {
        const standFavs = favorites.filter((f) => f.target_type === 'stand');
        if (standFavs.length === 0) return;

        const load = async () => {
            try {
                const entries = await Promise.all(standFavs.map(async (f) => {
                    try {
                        // The stands endpoint ignores the event_id path param, so we can reuse target_id for both.
                        const stand = await apiClient.get<Stand>(ENDPOINTS.STANDS.GET(f.target_id, f.target_id));
                        return [f.target_id, stand.event_id] as const;
                    } catch {
                        return [f.target_id, undefined] as const;
                    }
                }));
                const mapped = entries.reduce<Record<string, string>>((acc, [standId, eventId]) => {
                    if (eventId) acc[standId] = eventId;
                    return acc;
                }, {});
                setStandEventMap(mapped);
            } catch {
                /* ignore metadata errors */
            }
        };

        load();
    }, [favorites]);

    const grouped = favorites.reduce<Record<GroupKey, Favorite[]>>((acc, fav) => {
        const key = fav.target_type;
        acc[key] = acc[key] ? [...acc[key], fav] : [fav];
        return acc;
    }, {} as Record<GroupKey, Favorite[]>);

    const sections: { key: GroupKey; label: string }[] = [
        { key: 'event', label: 'Events' },
        { key: 'stand', label: 'Stands' },
        { key: 'organization', label: 'Organizations' },
    ];

    const hasItems = favorites.length > 0;

    return (
        <div className="space-y-4">
            {loading && <div className="text-sm text-gray-500">Loading favorites...</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}

            {!hasItems && !loading ? (
                <EmptyState
                    title="No favorites yet"
                    description="Save events or stands to quickly find them later."
                    action={
                        <Link href="/events">
                            <Button variant="outline" size="sm">Browse events</Button>
                        </Link>
                    }
                />
            ) : (
                sections.map(({ key, label }) => {
                    const items = grouped[key] || [];
                    if (items.length === 0) return null;
                    return (
                        <div key={key} className="space-y-2">
                            <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
                            <div className="space-y-2">
                                {items.map((fav) => {
                                    const stableKey = fav.id || `${fav.target_type}-${fav.target_id}`;
                                    const href = fav.target_type === 'event'
                                        ? `/events/${fav.target_id}`
                                        : fav.target_type === 'stand'
                                            ? (standEventMap[fav.target_id]
                                                ? `/events/${standEventMap[fav.target_id]}/stands/${fav.target_id}`
                                                : undefined)
                                            : undefined;
                                    return (
                                        <div key={stableKey} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 capitalize">{fav.target_type}</p>
                                                <p className="text-xs text-gray-500 break-all">{fav.target_id}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {href && (
                                                    <Link href={href} className="text-xs text-indigo-600 hover:underline">Open</Link>
                                                )}
                                                <Button size="sm" variant="outline" onClick={() => onRemove(fav.id)}>Remove</Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
