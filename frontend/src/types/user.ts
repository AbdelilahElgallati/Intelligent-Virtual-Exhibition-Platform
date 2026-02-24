// ── User type definitions for IVEP ──────────────────────────────────

export interface ProfessionalInfo {
    job_title?: string;
    industry?: string;
    company?: string;
    experience_level?: string; // Junior / Mid / Senior / Executive
}

export interface EventPreferences {
    types?: string[];       // Webinar / Exhibition / Networking / Workshop
    languages?: string[];
    regions?: string[];
}

export interface EngagementSettings {
    recommendations_enabled: boolean;
    email_notifications: boolean;
}

export interface User {
    _id: string;         // MongoDB id (admin endpoints use this)
    id: string;          // alias used by some endpoints
    email: string;
    full_name?: string;
    username: string;
    role: 'admin' | 'organizer' | 'visitor';
    created_at?: string;
    is_active?: boolean;
    avatar_url?: string;

    // Profile fields
    bio?: string;
    language?: string;
    professional_info?: ProfessionalInfo;
    interests?: string[];
    event_preferences?: EventPreferences;
    networking_goals?: string[];
    engagement_settings?: EngagementSettings;
}

export interface ProfileUpdatePayload {
    full_name?: string;
    bio?: string;
    language?: string;
    avatar_url?: string;
    professional_info?: ProfessionalInfo;
    interests?: string[];
    event_preferences?: EventPreferences;
    networking_goals?: string[];
    engagement_settings?: EngagementSettings;
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
