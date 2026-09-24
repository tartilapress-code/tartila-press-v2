import { createContext } from 'react';
import type { LoginPayload, RegisterPayload } from '@/data/auth/authApi';

export type Role = {
    name: string;
    display_name: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    roles?: Role[];
};

export type AuthContextValue = {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (payload: LoginPayload) => Promise<void>;
    register: (payload: RegisterPayload) => Promise<void>;
    logout: () => Promise<void>;
    /** Muat ulang data user dari server (mis. setelah email diverifikasi). */
    refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function hasAnyRole(
    user: AuthUser | null,
    roleNames: string[]
): boolean {
    return Boolean(
        user?.roles?.some((role) => roleNames.includes(role.name))
    );
}
