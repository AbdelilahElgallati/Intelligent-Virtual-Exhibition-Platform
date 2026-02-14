import { http } from '@/lib/http';
import { AuthResponse, AuthTokens } from '@/types/user';

export const authService = {
    async login(credentials: any): Promise<AuthResponse> {
        // In a real scenario, this would call GET /auth/login or POST /auth/login
        // For now, let's assume the backend expects POST /auth/login
        return http.post<AuthResponse>('/auth/login', credentials);
    },

    async register(userData: any): Promise<AuthResponse> {
        return http.post<AuthResponse>('/auth/register', userData);
    },

    async refresh(refreshToken: string): Promise<AuthTokens> {
        return http.post<AuthTokens>('/auth/refresh', { refresh_token: refreshToken });
    },

    async logout(): Promise<void> {
        // Placeholder for actual logout logic if needed by backend
        // return http.post('/auth/logout', {});
        return Promise.resolve();
    },
};
