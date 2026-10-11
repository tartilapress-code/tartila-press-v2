import { ApiError } from '@/lib/http';

/**
 * Pesan yang bisa dibaca untuk permintaan yang gagal: pesan validasi dari
 * server (maksimal tiga), kalau tidak ada pesan umum, kalau tidak ada lagi
 * pesan cadangan.
 */
export function describeApiError(
    error: unknown,
    fallback = 'Terjadi kesalahan. Silakan coba lagi.'
): string {
    if (!(error instanceof ApiError)) {
        return fallback;
    }

    const details = [...new Set(Object.values(error.errors ?? {}).flat())];

    if (details.length > 0) {
        return details.slice(0, 3).join(' • ');
    }

    return error.message || fallback;
}
