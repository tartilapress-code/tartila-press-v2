import { useState } from 'react';
import * as authApi from '@/data/auth/authApi';
import { ApiError } from '@/lib/http';
import { useCooldown } from '@/hooks/useCooldown';

const COOLDOWN_SECONDS = 60;

/**
 * Kirim ulang email verifikasi, dengan jeda supaya tidak bisa ditekan
 * berulang-ulang (server juga membatasi 3x per menit).
 */
export function useResendVerification() {
    const [isSending, setIsSending] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const { remaining: cooldown, start: startCooldown } = useCooldown();

    async function send() {
        setIsSending(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await authApi.resendVerificationEmail();
            setMessage(
                response?.message ?? 'Email verifikasi berhasil dikirim.'
            );
            startCooldown(COOLDOWN_SECONDS);
        } catch (error) {
            setIsError(true);

            if (error instanceof ApiError && error.status === 429) {
                setMessage(
                    'Terlalu sering meminta email. Tunggu sebentar lalu coba lagi.'
                );
                startCooldown(COOLDOWN_SECONDS);
            } else {
                setMessage(
                    error instanceof ApiError
                        ? error.message
                        : 'Terjadi kesalahan. Silakan coba lagi.'
                );
            }
        } finally {
            setIsSending(false);
        }
    }

    return { send, isSending, cooldown, message, isError };
}
