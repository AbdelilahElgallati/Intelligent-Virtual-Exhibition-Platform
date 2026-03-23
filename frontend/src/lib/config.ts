export const API_BASE_URL = (() => {
  // NEXT_PUBLIC_IVEP_SAFE_API_URL is set by next.config.ts with https:// guaranteed.
  // Falls back to NEXT_PUBLIC_API_URL if somehow the build config is skipped.
  const rawUrl = process.env.NEXT_PUBLIC_IVEP_SAFE_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let url = rawUrl.trim().replace(/\/$/, '');
  // Last-resort safety: force https for any non-localhost URL
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