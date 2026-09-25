import type { ReactNode } from 'react';
import AuthCard from '@/components/AuthCard';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
    RiCheckboxCircleFill,
    RiErrorWarningFill,
    RiInformationFill,
    RiMailSendLine,
} from '@remixicon/react';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { useResendVerification } from '@/hooks/useResendVerification';

type Result =
    | 'pending'
    | 'success'
    | 'already'
    | 'invalid'
    | 'changed'
    | 'taken'
    | 'change-invalid';

const RESULTS: Result[] = [
    'pending',
    'success',
    'already',
    'invalid',
    'changed',
    'taken',
    'change-invalid',
];

// Hasil yang tampil dengan ikon peringatan (merah), bukan centang/info.
const WARNING_RESULTS: Result[] = ['invalid', 'taken', 'change-invalid'];

const primaryLinkClass =
    'inline-flex items-center font-semibold text-sm rounded-lg px-4 py-3 bg-oxford-navy-700 text-white hover:bg-oxford-navy-600 transition-colors';

function parseResult(value: string | null): Result {
    return RESULTS.find((result) => result === value) ?? 'invalid';
}

/**
 * Tujuan pengalihan dari link di email:
 * - verifikasi email: ?status=success|already|invalid
 * - konfirmasi ganti email: ?status=changed|taken|change-invalid
 * dan halaman "cek email Anda" setelah registrasi (?status=pending).
 */
export default function VerifyEmailPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated, isLoading } = useAuth();
    const { send, isSending, cooldown, message, isError } =
        useResendVerification();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <p className="text-oxford-navy-900">{t('common.loading')}</p>
            </div>
        );
    }

    const isVerified = Boolean(user?.email_verified_at);

    // Sudah terverifikasi tapi masih membuka halaman "cek email" → tampilkan
    // status yang benar, bukan perintah yang sudah tidak relevan.
    let result = parseResult(searchParams.get('status'));
    if (result === 'pending' && isVerified) {
        result = 'already';
    }

    const resendButton = (
        <div className="flex flex-col items-center gap-2">
            <Button
                type="button"
                variant="primary"
                onClick={send}
                disabled={isSending || cooldown > 0}
            >
                {isSending
                    ? t('auth.resend.sending')
                    : cooldown > 0
                      ? t('auth.resend.wait', { seconds: cooldown })
                      : t('auth.verify.resend')}
            </Button>
            {message && (
                <p
                    className={`text-sm ${
                        isError ? 'text-red-700' : 'text-forest-moss-800'
                    }`}
                >
                    {message}
                </p>
            )}
        </div>
    );

    const continueLink = isAuthenticated ? (
        <Link to="/dashboard" className={primaryLinkClass}>
            {t('auth.verify.toDashboard')}
        </Link>
    ) : (
        <Link to="/login" className={primaryLinkClass}>
            {t('auth.verify.login')}
        </Link>
    );

    const content: Record<
        Result,
        { icon: ReactNode; title: string; body: ReactNode; action: ReactNode }
    > = {
        pending: {
            icon: <RiMailSendLine size={40} className="text-forest-moss-800" />,
            title: t('auth.verify.pending.title'),
            body: user?.email ? (
                <Trans
                    t={t}
                    i18nKey="auth.verify.pending.bodyWithEmail"
                    values={{ email: user.email }}
                    components={{ strong: <strong /> }}
                />
            ) : (
                <Trans
                    t={t}
                    i18nKey="auth.verify.pending.body"
                    components={{ strong: <strong /> }}
                />
            ),
            action: isAuthenticated ? (
                <div className="flex flex-col items-center gap-4">
                    {resendButton}
                    <Link
                        to="/"
                        className="text-oxford-navy-600 text-sm hover:text-oxford-navy-500 underline"
                    >
                        {t('auth.verify.pending.continue')}
                    </Link>
                </div>
            ) : (
                continueLink
            ),
        },
        success: {
            icon: (
                <RiCheckboxCircleFill
                    size={40}
                    className="text-forest-moss-800"
                />
            ),
            title: t('auth.verify.success.title'),
            body: t('auth.verify.success.body'),
            action: continueLink,
        },
        already: {
            icon: (
                <RiInformationFill size={40} className="text-forest-moss-800" />
            ),
            title: t('auth.verify.already.title'),
            body: t('auth.verify.already.body'),
            action: continueLink,
        },
        invalid: {
            icon: <RiErrorWarningFill size={40} className="text-red-700" />,
            title: t('auth.verify.invalid.title'),
            body: t('auth.verify.invalid.body'),
            action: isVerified ? (
                continueLink
            ) : isAuthenticated ? (
                resendButton
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-oxford-navy-700 text-sm">
                        {t('auth.verify.invalid.loginFirst')}
                    </p>
                    {continueLink}
                </div>
            ),
        },
        changed: {
            icon: (
                <RiCheckboxCircleFill
                    size={40}
                    className="text-forest-moss-800"
                />
            ),
            title: t('auth.verify.changed.title'),
            body: t('auth.verify.changed.body'),
            action: continueLink,
        },
        taken: {
            icon: <RiErrorWarningFill size={40} className="text-red-700" />,
            title: t('auth.verify.taken.title'),
            body: t('auth.verify.taken.body'),
            action: continueLink,
        },
        'change-invalid': {
            icon: <RiErrorWarningFill size={40} className="text-red-700" />,
            title: t('auth.verify.change-invalid.title'),
            body: t('auth.verify.change-invalid.body'),
            action: continueLink,
        },
    };

    const { icon, title, body, action } = content[result];
    const isWarning = WARNING_RESULTS.includes(result);

    return (
        <AuthCard size="lg">
            <div className="flex flex-col items-center gap-5 text-center">
                <div
                    className={`rounded-full p-4 ${
                        isWarning ? 'bg-red-50' : 'bg-forest-moss-100'
                    }`}
                >
                    {icon}
                </div>
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    {title}
                </h1>
                <p className="text-base leading-relaxed text-oxford-navy-900/70">
                    {body}
                </p>
                {action}
            </div>
        </AuthCard>
    );
}
