const BASE_URL = import.meta.env.VITE_API_URL;

const TOKEN_KEY = 'tartila_token';

export class ApiError extends Error {
    status: number;
    errors?: Record<string, string[]>;

    constructor(
        message: string,
        status: number,
        errors?: Record<string, string[]>
    ) {
        super(message);
        this.status = status;
        this.errors = errors;
    }
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/** Alamat lengkap sebuah endpoint API, untuk pemuat yang tidak memakai `http` (mis. PDF.js). */
export function apiUrl(path: string): string {
    return `${BASE_URL}${path}`;
}

async function parseJsonOrThrow(response: globalThis.Response) {
    const body = await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(
            body?.message ?? 'Terjadi kesalahan. Silakan coba lagi.',
            response.status,
            body?.errors
        );
    }

    return body;
}

async function request(path: string, options: RequestInit = {}) {
    const token = getToken();

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    return parseJsonOrThrow(response);
}

export const http = {
    get: (path: string) => request(path),

    post: (path: string, data?: unknown) =>
        request(path, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }),

    patch: (path: string, data?: unknown) =>
        request(path, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        }),

    delete: (path: string) => request(path, { method: 'DELETE' }),

    /**
     * Multipart upload — browser sets the Content-Type (with boundary)
     * itself, so it must not be set manually here.
     */
    upload: async (path: string, formData: FormData) => {
        const token = getToken();

        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });

        return parseJsonOrThrow(response);
    },

    /**
     * Download a file from an authenticated endpoint as a Blob, since a
     * plain <a href> navigation can't attach the Bearer token.
     */
    downloadBlob: async (path: string): Promise<Blob> => {
        const token = getToken();

        const response = await fetch(`${BASE_URL}${path}`, {
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new ApiError(
                body?.message ?? 'Gagal mengunduh file.',
                response.status,
                body?.errors
            );
        }

        return response.blob();
    },
};
