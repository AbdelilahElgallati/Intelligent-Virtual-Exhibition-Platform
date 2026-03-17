import { API_BASE_URL } from '@/lib/config';

const ABSOLUTE_URL_PATTERN = /^(https?:|data:|blob:)/i;

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

    return `${getApiOrigin()}${cleanPath}`;
}
