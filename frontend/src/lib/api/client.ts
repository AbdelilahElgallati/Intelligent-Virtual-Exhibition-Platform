import { getApiUrl } from '../config';
import { getStoredTokens } from '../auth';

// ── Token refresh helpers ──────────────────────────────────────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(token: string) {
    refreshSubscribers.forEach((fn) => fn(token));
    refreshSubscribers = [];
}

async function tryRefreshToken(): Promise<string | null> {
    const stored = getStoredTokens();
    if (!stored?.refresh_token) return null;

    const url = getApiUrl('/auth/refresh');
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: stored.refresh_token }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        // Persist new tokens
        const updated = {
            access_token: data.access_token,
            refresh_token: data.refresh_token ?? stored.refresh_token,
            token_type: data.token_type ?? 'bearer',
        };
        localStorage.setItem('auth_tokens', JSON.stringify(updated));
        if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user));
        return data.access_token as string;
    } catch {
        return null;
    }
}

function redirectToLogin() {
    if (typeof window !== 'undefined') {
        localStorage.setItem('redirectAfterLogin', window.location.pathname);
        window.location.href = '/auth/login';
    }
}

// ── Core request ──────────────────────────────────────────────────────────────

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = getApiUrl(endpoint);

    const buildHeaders = (token?: string | null): Headers => {
        const headers = new Headers(options.headers);
        const isFormData = options.body instanceof FormData;
        if (!isFormData && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        const t = token ?? getStoredTokens()?.access_token;
        if (t) headers.set('Authorization', `Bearer ${t}`);
        return headers;
    };

    let response = await fetch(url, { ...options, headers: buildHeaders() });

    // ── Silent refresh on 401 ─────────────────────────────────────────────────
    if (response.status === 401) {
        if (!isRefreshing) {
            isRefreshing = true;
            const newToken = await tryRefreshToken();
            isRefreshing = false;

            if (newToken) {
                onTokenRefreshed(newToken);
                // Retry original request with the new token
                response = await fetch(url, { ...options, headers: buildHeaders(newToken) });
            } else {
                redirectToLogin();
                throw new Error('Session expired. Please log in again.');
            }
        } else {
            // Another request triggered refresh — wait for it
            const newToken = await new Promise<string>((resolve) => {
                refreshSubscribers.push(resolve);
            });
            response = await fetch(url, { ...options, headers: buildHeaders(newToken) });
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'An error occurred' }));
        let errorMessage = 'API request failed';

        if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
            errorMessage = errorData.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ');
        } else if (errorData.detail && typeof errorData.detail === 'object') {
            errorMessage = (errorData.detail as { message?: string }).message || JSON.stringify(errorData.detail);
        }

        throw new Error(errorMessage);
    }

    if (response.status === 204) return {} as T;

    return response.json();
}

export const apiClient = {
    get: <T>(endpoint: string, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'GET' }),
    post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
    patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(endpoint: string, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'DELETE' }),
};
