export const API_BASE_URL = (() => {
  let url = (process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8000').replace(/\/$/, '');
  // Force HTTPS for any real (non-localhost) API endpoint
  if (!url.includes('localhost') && !url.includes('127.0.0.1') && url.startsWith('http:')) {
    url = url.replace('http:', 'https:');
  }
  return url;
})();
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
