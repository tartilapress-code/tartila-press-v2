import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { RiMailSendLine } from '@remixicon/react';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { useResendVerification } from '@/hooks/useResendVerification';

/**
 * Pengingat untuk akun yang emailnya belum diverifikasi. Saat tab kembali
 * difokuskan, status dimuat ulang — jadi kalau user membuka link verifikasi
 * di tab/perangkat lain, banner hilang sendiri.
 */
export default function EmailVerificationBanner() {
    const { t } = useTranslation();
    const { user, isAuthenticated, refreshUser } = useAuth();
    const { send, isSending, cooldown, message, isError } =
        useResendVerification();

    const isUnverified =
        isAuthenticated && user !== null && !user.email_verified_at;

    useEffect(() => {
        if (!isUnverified) {
            return;
        }

        window.addEventListener('focus', refreshUser);

        return () => window.removeEventListener('focus', refreshUser);
    }, [isUnverified, refreshUser]);

    if (!isUnverified) {
        return null;
    }

    return (
        <div
            role="status"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-forest-moss-100 border-b border-forest-moss-200 px-4 sm:px-10 py-3"
        >
            <div className="flex flex-row items-start gap-3">
                <RiMailSendLine
                    size={22}
                    className="text-forest-moss-800 shrink-0 mt-0.5"
                />
                <p className="text-oxford-navy-900 text-sm sm:text-base">
                    <Trans
                        t={t}
                        i18nKey="auth.banner.text"
                        components={{ strong: <strong /> }}
                    />
                </p>
            </div>

            <div className="flex flex-row flex-wrap items-center gap-3 shrink-0">
                {message && (
                    <span
                        className={`text-sm ${
                            isError ? 'text-red-700' : 'text-forest-moss-800'
                        }`}
                    >
                        {message}
                    </span>
                )}
                <Button
                    type="button"
                    variant="primary"
                    className="py-2"
                    onClick={send}
                    disabled={isSending || cooldown > 0}
                >
                    {isSending
                        ? t('auth.resend.sending')
                        : cooldown > 0
                          ? t('auth.resend.wait', { seconds: cooldown })
                          : t('auth.banner.resend')}
                </Button>
            </div>
        </div>
    );
}
