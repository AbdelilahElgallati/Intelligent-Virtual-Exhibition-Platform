export const API_BASE_URL = (() => {
  // NEXT_PUBLIC_IVEP_SAFE_API_URL is set by next.config.ts (origin only; no /api/v1 suffix).
  // Falls back to NEXT_PUBLIC_API_URL — strip /api/v1 so we never double-prefix paths.
  const rawUrl =
    process.env.NEXT_PUBLIC_IVEP_SAFE_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  let url = rawUrl.trim().replace(/\/$/, "");
  url = url.replace(/\/api\/v1$/i, "").replace(/\/$/, "");
  if (!url.includes("localhost") && !url.includes("127.0.0.1") && url.startsWith("http:")) {
    url = url.replace("http:", "https:");
  }
  if (process.env.NEXT_PUBLIC_API_PROXY_IPV4 !== "0") {
    try {
      const p = new URL(url);
      if (p.hostname === "localhost") {
        p.hostname = "127.0.0.1";
        url = p.origin;
      }
    } catch {
      /* ignore */
    }
  }
  return url;
})();
export const API_PREFIX = '/api/v1';
export const R2_PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');

/**
 * In the browser, default to same-origin `/api/v1/...` so Next.js rewrites proxy to FastAPI.
 * Set NEXT_PUBLIC_BROWSER_API_PROXY=0 to call the backend URL directly (cross-origin).
 * Server-side code keeps using the absolute API base URL.
 */
export const getApiUrl = (endpoint: string) => {
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	const useSameOriginProxy =
		typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BROWSER_API_PROXY !== '0';

	if (useSameOriginProxy) {
		return `${API_PREFIX}${normalizedEndpoint}`;
	}

	// Legacy: base URL used to include /api/v1; after normalization it does not.
	if (API_BASE_URL.includes("/api/v")) {
		return `${API_BASE_URL}${normalizedEndpoint}`;
	}
	return `${API_BASE_URL}${API_PREFIX}${normalizedEndpoint}`;
};

/**
 * Absolute URL to the real FastAPI host (always includes API_PREFIX when base is origin-only).
 * Use for binary/PDF fetches: Next.js dev rewrites can return an empty body for streamed responses.
 */
export function getDirectApiUrl(endpoint: string): string {
	const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	if (API_BASE_URL.includes('/api/v')) {
		return `${API_BASE_URL}${normalizedEndpoint}`;
	}
	return `${API_BASE_URL}${API_PREFIX}${normalizedEndpoint}`;
}