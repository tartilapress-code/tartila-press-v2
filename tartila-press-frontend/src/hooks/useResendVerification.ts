import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as authApi from '@/data/auth/authApi';
import { ApiError } from '@/lib/http';
import { useCooldown } from '@/hooks/useCooldown';

const COOLDOWN_SECONDS = 60;

// Yang disimpan hanya jenis hasilnya; kalimatnya dibuat saat tampil supaya
// ikut berganti kalau bahasa diubah. `server`: pesan apa adanya dari server.
type Outcome =
    | { kind: 'sent' | 'throttled' | 'unexpected' }
    | { kind: 'server'; text: string };

/**
 * Kirim ulang email verifikasi, dengan jeda supaya tidak bisa ditekan
 * berulang-ulang (server juga membatasi 3x per menit).
 */
export function useResendVerification() {
    const { t } = useTranslation();
    const [isSending, setIsSending] = useState<boolean>(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const { remaining: cooldown, start: startCooldown } = useCooldown();

    async function send() {
        setIsSending(true);
        setOutcome(null);

        try {
            await authApi.resendVerificationEmail();
            setOutcome({ kind: 'sent' });
            startCooldown(COOLDOWN_SECONDS);
        } catch (error) {
            if (error instanceof ApiError && error.status === 429) {
                setOutcome({ kind: 'throttled' });
                startCooldown(COOLDOWN_SECONDS);
            } else if (error instanceof ApiError) {
                setOutcome({ kind: 'server', text: error.message });
            } else {
                setOutcome({ kind: 'unexpected' });
            }
        } finally {
            setIsSending(false);
        }
    }

    let message = '';
    if (outcome?.kind === 'sent') {
        message = t('auth.resend.sent');
    } else if (outcome?.kind === 'throttled') {
        message = t('auth.resend.throttled');
    } else if (outcome?.kind === 'unexpected') {
        message = t('common.genericError');
    } else if (outcome?.kind === 'server') {
        message = outcome.text;
    }

    const isError = outcome !== null && outcome.kind !== 'sent';

    return { send, isSending, cooldown, message, isError };
}
