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

    // 1. Absolute URLs (R2, External, etc.)
    if (ABSOLUTE_URL_PATTERN.test(normalized)) {
        return normalized;
    }

    const cleanPath = normalized.startsWith('/')
        ? normalized
        : `/${normalized}`;

    const hasR2Base = Boolean(R2_PUBLIC_BASE_URL);

    // 2. Normalize legacy /uploads/ to R2 if configured
    if (hasR2Base && cleanPath.startsWith(LEGACY_UPLOADS_PREFIX)) {
        const objectKey = cleanPath.slice(LEGACY_UPLOADS_PREFIX.length);
        return `${R2_PUBLIC_BASE_URL}/${objectKey}`;
    }

    // 3. Known media folders -> R2
    if (hasR2Base && !cleanPath.startsWith('/api/')) {
        const isMediaFolder = /^(\/(event_banners|enterprise_profile|product_images|resources|stand_resources|payments|transcripts)\/)/i.test(cleanPath);
        
        if (isMediaFolder) {
            return `${R2_PUBLIC_BASE_URL}${cleanPath}`;
        }
    }

    // 4. Seeded event banner fallback
    if (SEEDED_EVENT_BANNER_PATTERN.test(cleanPath)) {
        return SEEDED_EVENT_BANNER_FALLBACK;
    }

    // 5. Static frontend assets
    if (STATIC_PUBLIC_MEDIA_PATTERN.test(cleanPath)) {
        return cleanPath;
    }

    // 6. Final fallback to API Origin (Local backend uploads)
    return `${getApiOrigin()}${cleanPath}`;
}
