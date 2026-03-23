export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_PREFIX = '/api/v1';
export const R2_PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');

export const getApiUrl = (endpoint: string) => {
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	return `${API_BASE_URL}${API_PREFIX}${normalizedEndpoint}`;
};
