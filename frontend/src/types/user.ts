export interface User {
    id: string;
    email: string;
    full_name?: string;
    username: string;
    role: 'admin' | 'organizer' | 'visitor';
    created_at?: string;
    is_active?: boolean;
    avatar_url?: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token?: string;
    token_type: string;
}

export interface AuthResponse {
    user: User;
    access_token: string;
    refresh_token: string;
    token_type: string;
}
