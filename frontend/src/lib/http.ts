import { getApiUrl } from './config';

type RequestOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    token?: string | null;
    responseType?: 'json' | 'blob';
};

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
        if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
        }
        throw new Error('Unauthorized');
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

export const http = {
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