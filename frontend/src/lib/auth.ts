// Helper utilities for working with auth tokens on the client side

export interface StoredTokens {
	access_token?: string;
	refresh_token?: string;
	token_type?: string;
}

/**
 * Safely read the persisted auth tokens from localStorage.
 * Falls back to null when running on the server or when parsing fails.
 */
export function getStoredTokens(): StoredTokens | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem('auth_tokens');
		if (!raw) return null;
		return JSON.parse(raw) as StoredTokens;
	} catch (error) {
		console.error('Unable to parse auth_tokens from storage', error);
		return null;
	}
}

/**
 * Returns the current access token if available.
 * Looks at AuthContext-persisted storage; callers can still pass a token explicitly.
 */
export function getAccessToken(): string | null {
	const tokens = getStoredTokens();
	return tokens?.access_token ?? null;
}
