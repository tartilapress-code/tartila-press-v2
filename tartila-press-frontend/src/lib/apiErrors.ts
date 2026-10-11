import { ApiError } from '@/lib/http';

/**
 * A readable message for a failed request: the server's validation messages
 * (up to three, de-duplicated) when it sent any, else its general message,
 * else the fallback.
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
