export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';
export const API_PREFIX = '/api/v1'; // Standardizing on v1 prefix if applicable, can be empty string

export const getApiUrl = (endpoint: string) => `${API_BASE_URL}${API_PREFIX}${endpoint}`;
