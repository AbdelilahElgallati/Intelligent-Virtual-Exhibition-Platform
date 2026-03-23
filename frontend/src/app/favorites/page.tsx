"use client";

import Link from "next/link";
import { Container } from "@/components/common/Container";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { Heart, HeartOff, Image as ImageIcon, ExternalLink, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { favoritesService, Favorite } from "@/services/favorites.service";
import { apiClient } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { resolveMediaUrl } from "@/lib/media";
import { motion, AnimatePresence, Variants } from "framer-motion";

// Helper to determine Card styling based on target type
const getTypeColor = (type: string) => {
    switch(type) {
        case 'event': return 'from-indigo-500 to-indigo-700';
        case 'stand': return 'from-emerald-500 to-teal-700';
        case 'organization': return 'from-amber-500 to-orange-700';
        default: return 'from-slate-500 to-slate-700';
    }
}

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
                setError("Failed to load favorites");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isAuthenticated]);

    const handleRemove = async (id: string) => {
        try {
            await favoritesService.remove(id);
            setFavorites((prev) => prev.filter((f) => f.id !== id && (f as any)._id !== id));
        } catch (err) {
            console.error(err);
            setError("Failed to remove favorite");
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50/50">
            {/* Page Header */}
            <div className="bg-white border-b border-zinc-200 py-12">
                <Container className="max-w-7xl px-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-rose-50 text-rose-500 shadow-sm">
                                <Heart className="w-8 h-8 fill-rose-100" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wider text-rose-500">Your Collection</p>
                                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl mt-1">Saved Favorites</h1>
                            </div>
                        </div>
                        {isAuthenticated && !loading && (
                            <p className="text-sm text-zinc-500 font-medium bg-zinc-100 px-4 py-2 rounded-full shadow-inner">
                                {favorites.length} Item{favorites.length !== 1 && 's'} Found
                            </p>
                        )}
                    </div>
                </Container>
            </div>

            <Container className="max-w-7xl px-6 py-12">
                {!isAuthenticated ? (
                    <EmptyState
                        title="Login to view favorites"
                        message="Sign in to see events, stands, and resources you’ve carefully saved for later."
                        action={
                            <div className="flex gap-4 mt-4">
                                <Link href="/auth/login"><Button size="lg" className="shadow-md shadow-indigo-500/20">Login</Button></Link>
                                <Link href="/auth/register"><Button variant="outline" size="lg">Create Account</Button></Link>
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
            </Container>
        </div>
    );
}

// Interfaces & Animations
type GroupKey = Favorite["target_type"];
interface EntityData {
    title: string;
    description?: string;
    img?: string;
    href?: string;
}

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
};

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
    const [detailsMap, setDetailsMap] = useState<Record<string, EntityData>>({});
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Fetch Rich Entity Data to replace Raw IDs
    useEffect(() => {
        if (favorites.length === 0) return;

        const loadRichData = async () => {
            setLoadingDetails(true);
            const map: Record<string, EntityData> = {};

            await Promise.all(favorites.map(async (fav) => {
                const safeId = fav.id || `${fav.target_type}-${fav.target_id}`;
                try {
                    if (fav.target_type === 'event') {
                        const evt = await apiClient.get<any>(ENDPOINTS.EVENTS.GET(fav.target_id));
                        map[safeId] = {
                            title: evt.title || "Unknown Event",
                            description: evt.description || "No description provided.",
                            img: evt.banner_url,
                            href: `/events/${fav.target_id}`
                        };
                    } else if (fav.target_type === 'stand') {
                        const std = await apiClient.get<any>(ENDPOINTS.STANDS.GET(fav.target_id, fav.target_id));
                        map[safeId] = {
                            title: std.name || "Unknown Stand",
                            description: std.description || "No description provided.",
                            img: std.logo_url || std.banner_url,
                            href: std.event_id ? `/events/${std.event_id}/stands/${fav.target_id}` : undefined
                        };
                    } else if (fav.target_type === 'organization') {
                         const org = await apiClient.get<any>(ENDPOINTS.ORGANIZATIONS.GET(fav.target_id));
                         map[safeId] = {
                             title: org.name || "Unknown Organization",
                             description: org.description,
                             img: org.logo_url
                         };
                    }
                } catch {
                    // Fallback if entity is deleted or network fails
                    map[safeId] = {
                        title: `${fav.target_type.charAt(0).toUpperCase() + fav.target_type.slice(1)} Identity Removed`,
                        description: `ID: ${fav.target_id}`
                    };
                }
            }));
            
            setDetailsMap(map);
            setLoadingDetails(false);
        };
        loadRichData();
    }, [favorites]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm animate-pulse h-64 flex flex-col justify-between">
                        <div className="h-32 bg-zinc-200 rounded-xl w-full mb-4"></div>
                        <div className="space-y-3"><div className="h-4 bg-zinc-200 rounded w-3/4"></div><div className="h-4 bg-zinc-200 rounded w-1/2"></div></div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>;
    }

    if (favorites.length === 0) {
        return (
            <EmptyState
                title="Your collection is empty"
                message="Start exploring Events, Booths, and Organizations to build your personalized directory."
                action={
                    <Link href="/events">
                        <Button variant="outline" className="mt-4"><Activity className="w-4 h-4 mr-2" /> Browse Live Events</Button>
                    </Link>
                }
            />
        );
    }

    // Grouping by target_type
    const grouped = favorites.reduce<Record<GroupKey, Favorite[]>>((acc, fav) => {
        const key = fav.target_type;
        acc[key] = acc[key] ? [...acc[key], fav] : [fav];
        return acc;
    }, {} as Record<GroupKey, Favorite[]>);

    const sections: { key: GroupKey; label: string }[] = [
        { key: "event", label: "Events" },
        { key: "stand", label: "Stands & Booths" },
        { key: "organization", label: "Organizations" },
    ];

    return (
        <div className="space-y-16">
            {sections.map(({ key, label }) => {
                const items = grouped[key] || [];
                if (items.length === 0) return null;

                return (
                    <div key={key} className="space-y-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-zinc-900 border-b-2 border-indigo-500 pb-1 inline-block">{label}</h2>
                            <span className="text-xs font-semibold bg-zinc-200 text-zinc-600 px-2 py-1 rounded-full">{items.length}</span>
                        </div>
                        
                        <motion.div 
                            variants={containerVariants}
                            initial="hidden"
                            animate="show"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <AnimatePresence>
                                {items.map((fav) => {
                                    const safeId = fav.id || `${fav.target_type}-${fav.target_id}`;
                                    const data = detailsMap[safeId];
                                    const isLoading = loadingDetails || !data;
                                    const href = data?.href;
                                    
                                    return (
                                        <motion.div
                                            variants={itemVariants}
                                            initial="hidden"
                                            animate="show"
                                            exit="exit"
                                            layout
                                            key={safeId} 
                                            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                                        >
                                            {/* Top Banner Area */}
                                            <div className="h-32 w-full relative overflow-hidden bg-zinc-100 flex-shrink-0">
                                                {isLoading ? (
                                                    <div className="w-full h-full animate-pulse bg-zinc-200" />
                                                ) : data?.img ? (
                                                    <img
                                                        src={resolveMediaUrl(data.img)}
                                                        alt={data?.title}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className={`w-full h-full bg-gradient-to-br ${getTypeColor(fav.target_type)} flex items-center justify-center opacity-80`}>
                                                        <ImageIcon className="text-white/30 w-12 h-12" />
                                                    </div>
                                                )}

                                                <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 shadow-sm">
                                                    <Heart className="h-3 w-3 fill-current" />
                                                    Favorited
                                                </span>
                                                
                                                {/* Float Action Button */}
                                                <button 
                                                    onClick={(e) => { 
                                                        e.preventDefault(); 
                                                        const removeId = fav.id || (fav as any)._id;
                                                        if (removeId) onRemove(removeId); 
                                                    }}
                                                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full text-rose-500 hover:bg-rose-500 hover:text-white transition-colors shadow-sm z-10"
                                                    title="Remove from favorites"
                                                >
                                                    <HeartOff className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Content Area */}
                                            <div className="p-5 flex flex-col flex-grow">
                                                {isLoading ? (
                                                    <div className="space-y-3">
                                                        <div className="h-4 bg-zinc-200 rounded w-3/4 animate-pulse"></div>
                                                        <div className="h-3 bg-zinc-200 rounded w-full animate-pulse"></div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h3 className="text-lg font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                                                {data?.title}
                                                            </h3>
                                                        </div>
                                                        <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed flex-grow">
                                                            {data?.description}
                                                        </p>
                                                    </>
                                                )}

                                                <div className="mt-6 flex items-center justify-between pt-4 border-t border-zinc-100">
                                                    <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                                                        {fav.target_type}
                                                    </span>
                                                    {href && !isLoading ? (
                                                        <Link href={href} className="flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline">
                                                            View Details <ExternalLink className="w-4 h-4 ml-1" />
                                                        </Link>
                                                    ) : (
                                                        <span className="text-xs text-zinc-300">Unreachable Route</span>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                );
            })}
        </div>
    );
}
