import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as authApi from '@/data/auth/authApi';
import type { LoginPayload, RegisterPayload } from '@/data/auth/authApi';
import { ApiError, clearToken, getToken, setToken } from '@/lib/http';
import { AuthContext, type AuthUser } from '@/context/AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const token = getToken();

        Promise.resolve()
            .then(() => {
                if (!token) {
                    return null;
                }

                return authApi.me().then((response) => response.data.user);
            })
            .then((hydratedUser) => setUser(hydratedUser))
            .catch(() => clearToken())
            .finally(() => setIsLoading(false));
    }, []);

    async function login(payload: LoginPayload) {
        const response = await authApi.login(payload);
        setToken(response.data.access_token);
        setUser(response.data.user);
    }

    async function register(payload: RegisterPayload) {
        const response = await authApi.register(payload);
        setToken(response.data.access_token);
        setUser(response.data.user);
    }

    async function logout() {
        try {
            await authApi.logout();
        } catch (error) {
            if (!(error instanceof ApiError)) {
                throw error;
            }
        } finally {
            clearToken();
            setUser(null);
        }
    }

    const refreshUser = useCallback(async () => {
        try {
            const response = await authApi.me();
            setUser(response.data.user);
        } catch {
            // Gagal sesaat (jaringan/token) — biarkan data user yang ada.
        }
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: user !== null,
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
}
