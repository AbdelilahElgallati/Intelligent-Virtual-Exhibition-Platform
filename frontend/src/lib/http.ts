import { getApiUrl, getDirectApiUrl } from './config';

type RequestOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    token?: string | null;
    responseType?: 'json' | 'blob';
};

/** Check if a URL is an authentication endpoint (login, register, refresh). */
function isAuthEndpoint(url: string): boolean {
    return /\/auth\/(login|register|refresh)$/.test(url);
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, token, responseType = 'json' } = options;
    const url = getApiUrl(endpoint);
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const defaultHeaders: Record<string, string> = {
        ...headers,
    };

    const methodUpper = method.toUpperCase();
    const shouldSendJsonContentType = !isFormData && methodUpper !== 'GET' && methodUpper !== 'HEAD';

    if (shouldSendJsonContentType && !defaultHeaders['Content-Type']) {
        defaultHeaders['Content-Type'] = 'application/json';
    } else if (isFormData && defaultHeaders['Content-Type']) {
        delete defaultHeaders['Content-Type'];
    }

    let activeToken = token;

    // Automatically try to get token from localStorage if in browser and none provided
    if (!activeToken && typeof window !== 'undefined') {
        try {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                const parsed = JSON.parse(storedTokens);
                activeToken = parsed.access_token;
            }
        } catch (e) {
            console.error('Failed to parse auth_tokens from localStorage', e);
        }
    }

    if (activeToken) {
        defaultHeaders['Authorization'] = `Bearer ${activeToken}`;
    }

    const response = await fetch(url, {
        method,
        headers: defaultHeaders,
        body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (response.status === 401) {
        let detail = 'Unauthorized';
        try {
            const errorData = await response.json();
            const msg = errorData?.detail;
            if (typeof msg === 'string') {
                detail = msg;
            } else if (Array.isArray(msg)) {
                const parts = msg
                    .map((item: any) => item?.msg)
                    .filter((item: unknown) => typeof item === 'string');
                if (parts.length > 0) {
                    detail = parts.join('; ');
                }
            }
        } catch {
            // Use default detail
        }
        if (typeof window !== 'undefined' && !isAuthEndpoint(url)) {
            window.location.href = '/auth/login';
        }
        throw new Error(detail);
    }

    if (!response.ok) {
        let errorData: any;
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: 'An unknown error occurred' };
        }

        const detail = errorData?.detail;
        let message = errorData?.message;

        if (!message && typeof detail === 'string') {
            message = detail;
        }

        if (!message && Array.isArray(detail)) {
            // FastAPI/Pydantic validation format: [{ msg, loc, ... }]
            const parts = detail
                .map((item: any) => item?.msg)
                .filter((item: unknown) => typeof item === 'string');
            if (parts.length > 0) {
                message = parts.join('; ');
            }
        }

        throw new Error(message || `Error: ${response.status}`);
    }

    // Handle empty responses (like 204 No Content)
    if (response.status === 204) {
        return {} as T;
    }

    if (responseType === 'blob') {
        return response.blob() as any;
    }

    return response.json();
}

/** Coalesce concurrent blob downloads (same URL + auth) to a single fetch. */
const inflightBlobs = new Map<string, Promise<Blob>>();

async function readResponseAsBlob(response: Response): Promise<Blob> {
    const ct = response.headers.get('content-type') || 'application/octet-stream';
    const buf = await response.arrayBuffer();
    return new Blob([buf], { type: ct });
}

function binaryGetInit(headers: Record<string, string>, cache: RequestCache): RequestInit {
    return {
        method: 'GET',
        headers: {
            ...headers,
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
        },
        cache,
    };
}

/**
 * Authenticated GET that returns a Blob (e.g. PDF export).
 * Intentionally omits `credentials: 'include'` so behavior matches `request()` and
 * avoids credentialed CORS edge cases that surfaces as `TypeError: Failed to fetch`.
 *
 * Uses the backend origin directly (not the Next.js /api/v1 rewrite) so PDF bytes are not
 * dropped by the dev proxy. arrayBuffer() + one retry still applies for 304 / empty edge cases.
 */
async function getBlob(
    endpoint: string,
    options: { accept?: string; token?: string | null } = {},
): Promise<Blob> {
    const { accept = 'application/pdf', token } = options;
    const directUrl = typeof window !== 'undefined' ? getDirectApiUrl(endpoint) : getApiUrl(endpoint);
    const proxyUrl = getApiUrl(endpoint);

    let activeToken = token;
    if (!activeToken && typeof window !== 'undefined') {
        try {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                const parsed = JSON.parse(storedTokens);
                activeToken = parsed.access_token;
            }
        } catch {
            /* ignore */
        }
    }

    const headers: Record<string, string> = { Accept: accept };
    if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
    }

    const key = `${proxyUrl}\0${accept}\0${activeToken ?? ''}`;
    const existing = inflightBlobs.get(key);
    if (existing) return existing;

    const promise = (async (): Promise<Blob> => {
        try {
            const handleFailure = async (response: Response): Promise<never> => {
                if (response.status === 401) {
                    if (typeof window !== 'undefined') {
                        window.location.href = '/auth/login';
                    }
                    throw new Error('Unauthorized');
                }
                const text = await response.text();
                let message = `Export failed (${response.status})`;
                try {
                    const errJson = JSON.parse(text) as {
                        detail?: unknown;
                        message?: string;
                    };
                    const detail = errJson?.detail;
                    if (typeof detail === 'string') {
                        message = detail;
                    } else if (Array.isArray(detail)) {
                        const parts = detail
                            .map((item: { msg?: string }) => item?.msg)
                            .filter((item: unknown): item is string => typeof item === 'string');
                        if (parts.length) message = parts.join('; ');
                    }
                } catch {
                    if (text && text.length < 400) message = text;
                }
                throw new Error(message);
            };

            let response: Response;
            try {
                response = await fetch(proxyUrl, binaryGetInit(headers, 'no-store'));
            } catch (err: any) {
                const msg = String((err as Error)?.message || '');
                const isFailedFetch = err instanceof TypeError && (msg === 'Failed to fetch' || msg.toLowerCase().includes('failed to fetch'));
                if (!isFailedFetch) throw err;
                response = await fetch(directUrl, binaryGetInit(headers, 'no-store'));
            }

            if (!response.ok) {
                await handleFailure(response);
            }

            let blob = await readResponseAsBlob(response);



            if (blob.size === 0) {
                throw new Error(
                    'PDF export returned an empty file. Confirm the backend report route is running and try again.',
                );
            }

            return blob;
        } finally {
            inflightBlobs.delete(key);
        }
    })();

    inflightBlobs.set(key, promise);
    return promise;
}

export const http = {
    getBlob,
    get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(endpoint, { ...options, method: 'GET' }),
    post: <T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(endpoint, { ...options, method: 'POST', body }),
    put: <T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(endpoint, { ...options, method: 'PUT', body }),
    patch: <T>(endpoint: string, body: any, options?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(endpoint, { ...options, method: 'PATCH', body }),
    delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
        request<T>(endpoint, { ...options, method: 'DELETE' }),
};
