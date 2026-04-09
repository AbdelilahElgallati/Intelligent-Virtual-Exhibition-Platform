"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthTokens } from '@/types/user';
import { authService } from '@/services/auth.service';
import { useRouter } from 'next/navigation';
import { http } from '@/lib/http';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface RegisterResult {
    pendingApproval: boolean;
}

interface AuthContextType {
    user: User | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    register: (userData: any) => Promise<RegisterResult>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simple JWT decode to extract user info (no verification)
function decodeToken(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        const decoded = JSON.parse(jsonPayload);

        // Security check: ensure the token decoded is actually an access token
        if (decoded.type !== 'access') {
            console.warn("Attempted to use non-access token for session");
            return null;
        }
        return decoded;
    } catch (e) {
        return null;
    }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [tokens, setTokens] = useState<AuthTokens | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const syncUserFromLocalStorage = () => {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem('auth_user');
        if (!raw) return;
        try {
            const parsedUser = JSON.parse(raw) as User;
            setUser((prev) => {
                // Preserve existing timezone if localStorage doesn't have it yet.
                if (!parsedUser?.timezone && prev?.timezone) {
                    return { ...parsedUser, timezone: prev.timezone };
                }
                return parsedUser;
            });
        } catch {
            // ignore parse errors
        }
    };

    const detectBrowserTimezone = (): string => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    };

    const ensureAccountTimezone = async (baseUser: User, accessToken?: string): Promise<User> => {
        if (baseUser.timezone) return baseUser;
        try {
            const detectedTimezone = detectBrowserTimezone();
            const updated = await http.put<User>(ENDPOINTS.USERS.ME, { timezone: detectedTimezone }, { token: accessToken });
            return updated;
        } catch {
            return { ...baseUser, timezone: detectBrowserTimezone() };
        }
    };

    useEffect(() => {
        // Restore session on mount
        const storedTokens = localStorage.getItem('auth_tokens');
        const storedUser = localStorage.getItem('auth_user');

        if (storedTokens && storedUser) {
            try {
                setTokens(JSON.parse(storedTokens));
                const parsedUser = JSON.parse(storedUser) as User;
                setUser(parsedUser);
                if (!parsedUser.timezone) {
                    ensureAccountTimezone(parsedUser).then((updatedUser) => {
                        setUser(updatedUser);
                        localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                    });
                }
            } catch (e) {
                console.error('Failed to restore auth state', e);
                localStorage.removeItem('auth_tokens');
                localStorage.removeItem('auth_user');
            }
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handler = () => syncUserFromLocalStorage();
        window.addEventListener('ivep:auth-user-updated', handler);
        window.addEventListener('storage', handler);

        // Best-effort sync after mount (covers cases where localStorage changed without context update).
        syncUserFromLocalStorage();

        return () => {
            window.removeEventListener('ivep:auth-user-updated', handler);
            window.removeEventListener('storage', handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getRoleRedirect = (role: string): string => {
        switch (role) {
            case 'admin': return '/admin';
            case 'organizer': return '/organizer';
            case 'enterprise': return '/enterprise';
            default: return '/';
        }
    };

    const login = async (credentials: any) => {
        setIsLoading(true);
        try {
            const response = await authService.login(credentials);
            const { access_token, refresh_token, token_type } = response;
            const tokens = { access_token, refresh_token, token_type };
            const user = await ensureAccountTimezone(response.user, access_token);

            setTokens(tokens);
            setUser(user);
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(user));

            // Check for redirect path
            const redirectPath = localStorage.getItem('redirectAfterLogin');
            if (redirectPath) {
                localStorage.removeItem('redirectAfterLogin');
                router.push(redirectPath);
            } else {
                router.push(getRoleRedirect(user.role));
            }
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData: any): Promise<RegisterResult> => {
        setIsLoading(true);
        try {
            const response = await authService.register(userData);
            
            // Organizer & enterprise accounts need admin approval before they can use the platform.
            // In these cases, the backend doesn't return user data or tokens.
            if (!response.user) {
                return { pendingApproval: true };
            }

            const { access_token, refresh_token, token_type } = response;
            const user = await ensureAccountTimezone(response.user, access_token);

            // Re-check activation status just in case
            if (user.is_active === false || user.approval_status === 'PENDING_APPROVAL') {
                return { pendingApproval: true };
            }

            const tokens = { access_token, refresh_token, token_type };
            setTokens(tokens);
            setUser(user);
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(user));

            // Check for redirect path
            const redirectPath = localStorage.getItem('redirectAfterLogin');
            if (redirectPath) {
                localStorage.removeItem('redirectAfterLogin');
                router.push(redirectPath);
            } else {
                router.push(getRoleRedirect(user.role));
            }

            return { pendingApproval: false };
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        setTokens(null);
        localStorage.removeItem('auth_tokens');
        localStorage.removeItem('auth_user');
        authService.logout();
        router.push('/');
    };

    const refreshUser = async () => {
        try {
            const freshUser = await authService.getMe();
            const normalized = await ensureAccountTimezone(freshUser);
            setUser(normalized);
            localStorage.setItem('auth_user', JSON.stringify(normalized));
        } catch (error) {
            console.error('Failed to refresh user', error);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                tokens,
                isAuthenticated: !!user,
                isLoading,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
