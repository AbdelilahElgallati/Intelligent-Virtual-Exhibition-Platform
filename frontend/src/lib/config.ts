export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const API_PREFIX = '/api/v1';
export const R2_PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');

export const getApiUrl = (endpoint: string) => {
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	// If the base URL already includes the version (e.g., /api/v1), don't add the prefix again
	if (API_BASE_URL.includes('/api/v')) {
		return `${API_BASE_URL}${normalizedEndpoint}`;
	}
	return `${API_BASE_URL}${API_PREFIX}${normalizedEndpoint}`;
};
