"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthTokens } from '@/types/user';
import { authService } from '@/services/auth.service';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    user: User | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: any) => Promise<void>;
    register: (userData: any) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

    useEffect(() => {
        // Restore session on mount
        const storedTokens = localStorage.getItem('auth_tokens');
        const storedUser = localStorage.getItem('auth_user');

        if (storedTokens && storedUser) {
            try {
                setTokens(JSON.parse(storedTokens));
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error('Failed to restore auth state', e);
                localStorage.removeItem('auth_tokens');
                localStorage.removeItem('auth_user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (credentials: any) => {
        setIsLoading(true);
        try {
            const response = await authService.login(credentials);
            const { user, access_token, refresh_token, token_type } = response;
            const tokens = { access_token, refresh_token, token_type };

            setTokens(tokens);
            setUser(user);
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(response.user));

            // Check for redirect path
            const redirectPath = localStorage.getItem('redirectAfterLogin');
            if (redirectPath) {
                localStorage.removeItem('redirectAfterLogin');
                router.push(redirectPath);
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Login failed', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (userData: any) => {
        setIsLoading(true);
        try {
            const response = await authService.register(userData);
            const { user, access_token, refresh_token, token_type } = response;
            const tokens = { access_token, refresh_token, token_type };

            setTokens(tokens);
            setUser(user);
            localStorage.setItem('auth_tokens', JSON.stringify(tokens));
            localStorage.setItem('auth_user', JSON.stringify(response.user));

            // Check for redirect path
            const redirectPath = localStorage.getItem('redirectAfterLogin');
            if (redirectPath) {
                localStorage.removeItem('redirectAfterLogin');
                router.push(redirectPath);
            } else {
                router.push('/');
            }
        } catch (error) {
            console.error('Registration failed', error);
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
