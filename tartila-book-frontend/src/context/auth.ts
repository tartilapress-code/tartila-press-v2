import { createContext, useContext } from 'react';

export type AuthUser = {
    id: number;
    name: string;
    email: string;
    roles?: { name: string; display_name: string }[];
};

export type AuthContextValue = {
    user: AuthUser | null;
    isLoading: boolean;
    isAdmin: boolean;
    // Akun mitra (penerbit mitra): dashboard unggah ebook sendiri.
    isPartner: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    // Notifikasi Tartila Book belum dibaca.
    unread: number;
    refreshUnread: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const value = useContext(AuthContext);

    if (!value) {
        throw new Error('useAuth harus dipakai di dalam AuthProvider.');
    }

    return value;
}
