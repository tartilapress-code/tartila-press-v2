const BASE_URL = import.meta.env.VITE_API_URL;

// Token disimpan per situs (alamat berbeda dari Tartila Press); akun & kata
// sandi tetap sama karena backend-nya satu.
const TOKEN_KEY = 'tartila_book_token';

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

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void =>
    localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/** Alamat lengkap endpoint (untuk pemuat yang tidak memakai `http`, mis. PDF.js). */
export const apiUrl = (path: string): string => `${BASE_URL}${path}`;

function authHeaders(): Record<string, string> {
    const token = getToken();

    return token ? { Authorization: `Bearer ${token}` } : {};
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
    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...authHeaders(),
            ...options.headers,
        },
    });

    return parseJsonOrThrow(response);
}

const withBody = (method: string, data?: unknown): RequestInit => ({
    method,
    body: data === undefined ? undefined : JSON.stringify(data),
});

export const http = {
    get: (path: string) => request(path),
    post: (path: string, data?: unknown) =>
        request(path, withBody('POST', data)),
    put: (path: string, data?: unknown) => request(path, withBody('PUT', data)),
    patch: (path: string, data?: unknown) =>
        request(path, withBody('PATCH', data)),
    delete: (path: string) => request(path, { method: 'DELETE' }),

    /** Multipart: peramban mengisi Content-Type (dengan boundary) sendiri. */
    upload: async (path: string, formData: FormData) => {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: { Accept: 'application/json', ...authHeaders() },
            body: formData,
        });

        return parseJsonOrThrow(response);
    },

    /** Berkas dari endpoint terautentikasi sebagai Blob (tautan biasa tidak membawa token). */
    blob: async (path: string): Promise<Blob> => {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: { Accept: 'application/json', ...authHeaders() },
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null);
            throw new ApiError(
                body?.message ?? 'Gagal mengambil berkas.',
                response.status,
                body?.errors
            );
        }

        return response.blob();
    },
};
