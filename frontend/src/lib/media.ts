import { API_BASE_URL, R2_PUBLIC_BASE_URL } from '@/lib/config';

const ABSOLUTE_URL_PATTERN = /^(https?:|data:|blob:)/i;
const SEEDED_EVENT_BANNER_PATTERN = /^\/stands\/.+-banner\.(png|jpe?g|webp)$/i;
const SEEDED_EVENT_BANNER_FALLBACK = '/stands/office-bg.jpg';
const STATIC_PUBLIC_MEDIA_PATTERN = /^\/(stands|images|icons|logos)\//i;
const LEGACY_UPLOADS_PREFIX = '/uploads/';

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

    const hasR2Base = Boolean(R2_PUBLIC_BASE_URL);

    // Legacy DB rows may keep '/uploads/<folder>/<file>' while new uploads in R2
    // use '<folder>/<file>' keys. Normalize both to the same R2 URL when possible.
    if (hasR2Base && cleanPath.startsWith(LEGACY_UPLOADS_PREFIX)) {
        const objectKey = cleanPath.slice(LEGACY_UPLOADS_PREFIX.length);
        return `${R2_PUBLIC_BASE_URL}/${objectKey}`;
    }

    // Relative object keys from backend (e.g. 'event_banners/file.png') should also
    // be served from R2 directly when public base is configured.
    if (hasR2Base && !cleanPath.startsWith('/api/')) {
        const looksLikeMediaKey = /\.(png|jpe?g|webp|gif|svg|pdf|mp4|webm|mov|txt|docx?)$/i.test(cleanPath)
            || /^(\/(event_banners|enterprise_profile|product_images|resources|stand_resources|payments|transcripts)\/)/i.test(cleanPath)
            || /^(\/(event_banners|enterprise_profile|product_images|resources|stand_resources|payments|transcripts)\/)/i.test(cleanPath);

        if (looksLikeMediaKey) {
            return `${R2_PUBLIC_BASE_URL}${cleanPath}`;
        }
    }

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
