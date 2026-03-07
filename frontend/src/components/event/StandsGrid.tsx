'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Stand, StandsListResponse } from '@/types/stand';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { EmptyState } from '@/components/ui/EmptyState';
import { StandFilterModal, FilterValues } from '@/components/event/StandFilterModal';
import { Search, SlidersHorizontal, X, Building2, ChevronLeft, ChevronRight, LayoutGrid, Landmark } from 'lucide-react';

/* Lazy-load the 3D hall to keep initial bundle light */
const HallScene = lazy(() => import('@/components/hall3d/HallScene').then(m => ({ default: m.HallScene })));

/* ── Stand categories available for filtering ── */
const STAND_CATEGORIES = [
    'Technology',
    'Healthcare',
    'Education',
    'Finance',
    'Recruitment',
    'Marketing',
    'Design',
    'Engineering',
    'Sustainability',
    'Other',
] as const;

const DEFAULT_PAGE_SIZE = 9;

export interface StandsGridRef {
    refetch: () => void;
}

interface StandsGridProps {
    eventId: string;
    /** When true, shows the persistent filter bar above the grid */
    showFilters?: boolean;
    /** Initial filter values (e.g. from onboarding) */
    initialFilters?: { category?: string; search?: string };
    /** Override the number of items per page (default: 9) */
    pageSize?: number;
    /** When true, hides pagination controls */
    showPagination?: boolean;
    /** Event title displayed inside the 3D hall */
    eventTitle?: string;
}

export function StandsGrid({
    eventId,
    showFilters = true,
    initialFilters,
    pageSize = DEFAULT_PAGE_SIZE,
    showPagination = true,
    eventTitle
}: StandsGridProps) {
    const router = useRouter();
    const [stands, setStands] = useState<Stand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* ── view mode: 'grid' or 'hall' ── */
    const [viewMode, setViewMode] = useState<'grid' | 'hall'>('hall');

    /* ── filter state ── */
    const [category, setCategory] = useState<string>(initialFilters?.category || '');
    const [search, setSearch] = useState<string>(initialFilters?.search || '');

    /* ── sync with initialFilters if they change (e.g. from parent modal) ── */
    useEffect(() => {
        if (initialFilters) {
            if (initialFilters.category !== undefined) setCategory(initialFilters.category);
            if (initialFilters.search !== undefined) setSearch(initialFilters.search);
        }
    }, [initialFilters]);

    /* ── pagination state ── */
    const [currentPage, setCurrentPage] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchStands = useCallback(async (cat?: string, q?: string, page: number = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (cat) params.set('category', cat);
            if (q) params.set('search', q);
            params.set('limit', String(pageSize));
            params.set('skip', String((page - 1) * pageSize));
            const qs = params.toString();
            const url = ENDPOINTS.STANDS.LIST(eventId) + (qs ? `?${qs}` : '');
            const data = await apiClient.get<StandsListResponse>(url);
            setStands(data.items);
            setTotal(data.total);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch stands', err);
            setError('Failed to load stands. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, [eventId, pageSize]);

    /* Total pages calculation */
    const totalPages = Math.ceil(total / pageSize);

    /* Fetch on mount & when filters/page change */
    useEffect(() => {
        /* simple debounce for search/category changes */
        const timer = setTimeout(() => {
            fetchStands(category, search, currentPage);
        }, 300);
        return () => clearTimeout(timer);
    }, [category, search, currentPage, fetchStands]);

    /* Reset to page 1 if filters change */
    useEffect(() => {
        setCurrentPage(1);
    }, [category, search]);

    const resetFilters = () => {
        setCategory('');
        setSearch('');
        setCurrentPage(1);
    };

    /* ── Pagination handlers ── */
    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    /* ── Filter Helpers ── */
    const hasActiveFilters = category !== '' || search !== '';

    return (
        <div className="space-y-6">
            {/* ── Persistent Filter Bar ── */}
            {showFilters && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        {/* Search input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search stands by name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Category dropdown */}
                        <div className="relative min-w-[180px]">
                            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full appearance-none pl-10 pr-8 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                {STAND_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Reset button */}
                        {hasActiveFilters && (
                            <button
                                onClick={resetFilters}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition whitespace-nowrap"
                            >
                                <X className="h-3.5 w-3.5" />
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Active filter pills */}
                    {hasActiveFilters && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500 font-medium">Active:</span>
                            {category && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                    {category}
                                    <button onClick={() => setCategory('')} className="hover:text-indigo-900">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                            {search && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                    &quot;{search}&quot;
                                    <button onClick={() => setSearch('')} className="hover:text-amber-900">
                                        <X className="h-3 w-3" />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Results count + View Toggle ── */}
            {!loading && stands.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Showing {stands.length} of {total} stand{total !== 1 ? 's' : ''}
                        {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
                    </p>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('hall')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                viewMode === 'hall'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            title="3D Exhibition Hall"
                        >
                            <Landmark className="h-3.5 w-3.5" />
                            Hall View
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                viewMode === 'grid'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            title="Grid View"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Grid View
                        </button>
                    </div>
                </div>
            )}

            {/* ── Grid / States ── */}
            <>
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-56 bg-gray-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-center py-10">{error}</div>
                ) : stands.length === 0 ? (
                    <EmptyState
                        title={hasActiveFilters ? 'No matching stands' : 'No stands yet'}
                        message={
                            hasActiveFilters
                                ? 'Try adjusting your filters or search to find what you\'re looking for.'
                                : 'The exhibition hall is currently empty. Check back later!'
                        }
                    />
                ) : viewMode === 'hall' ? (
                    /* ── 3D Isometric Hall View ── */
                    <Suspense fallback={
                        <div className="w-full rounded-xl bg-gray-900 flex items-center justify-center" style={{ height: '85vh', minHeight: 600 }}>
                            <div className="text-center">
                                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-gray-400 text-sm">Loading Exhibition Hall...</p>
                            </div>
                        </div>
                    }>
                        <HallScene
                            stands={stands}
                            onStandClick={(standId) => router.push(`/events/${eventId}/stands/${standId}`)}
                            eventTitle={eventTitle}
                        />
                    </Suspense>
                ) : (
                    /* ── 2D Salon-style Visual Grid ── */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stands.map((stand) => {
                            const standId = (stand as any).id || (stand as any)._id;
                            const bgImage = stand.stand_background_url || stand.logo_url;
                            const themeColor = stand.theme_color || '#6366f1';

                            return (
                                <Link
                                    key={standId}
                                    href={`/events/${stand.event_id}/stands/${standId}`}
                                    className="group relative rounded-xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    style={{ aspectRatio: '4 / 3' }}
                                >
                                    {/* Background image or gradient fallback */}
                                    {bgImage ? (
                                        <img
                                            src={bgImage}
                                            alt={stand.name}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center"
                                            style={{
                                                background: `linear-gradient(135deg, ${themeColor}22 0%, ${themeColor}44 100%)`,
                                            }}
                                        >
                                            <Building2
                                                className="w-16 h-16 opacity-30"
                                                style={{ color: themeColor }}
                                            />
                                        </div>
                                    )}

                                    {/* Top-right badges */}
                                    <div className="absolute top-3 right-3 flex gap-1.5 z-10">
                                        {stand.stand_type === 'sponsor' && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-amber-900 shadow">
                                                Sponsor
                                            </span>
                                        )}
                                        {stand.category && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/90 text-gray-700 shadow backdrop-blur-sm">
                                                {stand.category}
                                            </span>
                                        )}
                                    </div>

                                    {/* Top-left logo pill */}
                                    {stand.logo_url && stand.stand_background_url && (
                                        <div className="absolute top-3 left-3 z-10">
                                            <div className="w-10 h-10 rounded-lg bg-white/90 backdrop-blur-sm shadow overflow-hidden flex items-center justify-center">
                                                <img
                                                    src={stand.logo_url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Bottom overlay — stand name + description */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 pt-12 transition-all duration-300">
                                        <h3 className="text-white font-bold text-lg leading-tight drop-shadow-sm line-clamp-1">
                                            {stand.name}
                                        </h3>
                                        {stand.description && (
                                            <p className="text-white/70 text-xs mt-1 line-clamp-2 group-hover:text-white/90 transition-colors">
                                                {stand.description}
                                            </p>
                                        )}
                                        {/* Tags row */}
                                        {stand.tags && stand.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {stand.tags.slice(0, 3).map((tag, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/20 text-white/80 backdrop-blur-sm"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover border glow */}
                                    <div
                                        className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-white/40 transition-colors duration-300 pointer-events-none"
                                    />
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* ── Pagination Controls ── */}
                {showPagination && totalPages > 1 && !loading && (
                    <div className="flex items-center justify-center gap-4 pt-6">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage <= 1}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-9 h-9 rounded-lg text-sm font-medium transition ${currentPage === pageNum
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleNextPage}
                            disabled={currentPage >= totalPages}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </>
        </div>
    );
}
