import { API_BASE_URL } from '@/lib/config';

const ABSOLUTE_URL_PATTERN = /^(https?:|data:|blob:)/i;
const SEEDED_EVENT_BANNER_PATTERN = /^\/stands\/.+-banner\.(png|jpe?g|webp)$/i;
const SEEDED_EVENT_BANNER_FALLBACK = '/stands/office-bg.jpg';
const STATIC_PUBLIC_MEDIA_PATTERN = /^\/(stands|images|icons|logos)\//i;

function getApiOrigin(): string {
    const trimmed = API_BASE_URL.replace(/\/$/, '');
    return trimmed.replace(/\/api\/v\d+$/i, '');
}

export function resolveMediaUrl(path?: string | null): string {
    if (!path) return '';

    const normalized = String(path).trim().replace(/\\/g, '/');
    if (!normalized) return '';

    if (ABSOLUTE_URL_PATTERN.test(normalized)) {
        return normalized;
    }

    const cleanPath = normalized.startsWith('/')
        ? normalized
        : normalized.startsWith('uploads/')
            ? `/${normalized}`
            : `/${normalized}`;

    // Seeded event banner URLs may not exist in every environment.
    // Normalize them to a guaranteed static asset to avoid frontend 404 noise.
    if (SEEDED_EVENT_BANNER_PATTERN.test(cleanPath)) {
        return SEEDED_EVENT_BANNER_FALLBACK;
    }

    // Keep frontend public assets local instead of routing through backend origin.
    if (STATIC_PUBLIC_MEDIA_PATTERN.test(cleanPath)) {
        return cleanPath;
    }

    return `${getApiOrigin()}${cleanPath}`;
}
