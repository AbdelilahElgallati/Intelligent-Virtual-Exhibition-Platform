export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const API_PREFIX = '/api/v1';

export const getApiUrl = (endpoint: string) => `${API_BASE_URL}${API_PREFIX}${endpoint}`;
