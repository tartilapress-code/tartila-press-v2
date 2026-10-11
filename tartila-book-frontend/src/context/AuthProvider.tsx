import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { notificationSummary } from '@/data/readerApi';
import { AuthContext, type AuthUser } from '@/context/auth';
import { ApiError, clearToken, getToken, http, setToken } from '@/lib/http';

const UNREAD_POLL_MS = 60_000;

/** Login memakai akun Tartila Press (backend sama); token disimpan di situs ini. */
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [unread, setUnread] = useState<number>(0);

    useEffect(() => {
        if (!getToken()) {
            // Tidak ada sesi: langsung selesai memuat.
            Promise.resolve().then(() => setIsLoading(false));

            return;
        }

        http.get('/auth/me')
            .then((response) => setUser(response.data.user))
            .catch(() => clearToken())
            .finally(() => setIsLoading(false));
    }, []);

    const refreshUnread = useCallback(async () => {
        try {
            const response = await notificationSummary();
            setUnread(response.data.unread_total);
        } catch {
            // Gagal sesaat: biarkan angka lama.
        }
    }, []);

    const userId = user?.id ?? null;

    useEffect(() => {
        if (userId === null) {
            return;
        }

        const first = window.setTimeout(refreshUnread, 0);
        const timer = window.setInterval(refreshUnread, UNREAD_POLL_MS);

        return () => {
            window.clearTimeout(first);
            window.clearInterval(timer);
        };
    }, [userId, refreshUnread]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await http.post('/auth/login', { email, password });
        setToken(response.data.access_token);
        setUser(response.data.user);
    }, []);

    const logout = useCallback(async () => {
        try {
            await http.post('/auth/logout');
        } catch (error) {
            if (!(error instanceof ApiError)) {
                throw error;
            }
        } finally {
            clearToken();
            setUser(null);
            setUnread(0);
        }
    }, []);

    const value = useMemo(
        () => ({
            user,
            isLoading,
            isAdmin: Boolean(
                user?.roles?.some((role) => role.name === 'admin')
            ),
            login,
            logout,
            unread: userId === null ? 0 : unread,
            refreshUnread,
        }),
        [user, isLoading, login, logout, unread, userId, refreshUnread]
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}
