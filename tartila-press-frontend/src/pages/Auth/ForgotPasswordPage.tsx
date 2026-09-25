import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { RiMailSendLine } from '@remixicon/react';
import AuthCard from '@/components/AuthCard';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import * as authApi from '@/data/auth/authApi';
import { ApiError } from '@/lib/http';
import { useCooldown } from '@/hooks/useCooldown';

// Sama dengan jeda per-akun di server (auth.passwords.users.throttle).
const COOLDOWN_SECONDS = 60;

const textLinkClass =
    'text-forest-moss-700 text-sm hover:text-forest-moss-800 underline';

export default function ForgotPasswordPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState<string>('');
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [fieldError, setFieldError] = useState<string>('');
    const { remaining: cooldown, start: startCooldown } = useCooldown();

    async function requestLink(address: string) {
        setIsSubmitting(true);
        setErrorMessage('');
        setFieldError('');

        try {
            await authApi.forgotPassword(address);
            setSentTo(address);
            startCooldown(COOLDOWN_SECONDS);
        } catch (error) {
            if (
                error instanceof ApiError &&
                error.status === 422 &&
                error.errors?.email
            ) {
                setFieldError(error.errors.email[0]);
            } else if (error instanceof ApiError && error.status === 429) {
                setErrorMessage(t('auth.forgot.throttled'));
            } else {
                setErrorMessage(
                    error instanceof ApiError
                        ? error.message
                        : t('common.genericError')
                );
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        void requestLink(email.trim());
    }

    if (sentTo) {
        return (
            <AuthCard>
                <div className="w-fit rounded-full bg-forest-moss-500/20 p-3">
                    <RiMailSendLine
                        size={32}
                        className="text-forest-moss-700"
                    />
                </div>
                <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                    {t('auth.forgot.sentTitle')}
                </h5>
                <p className="text-oxford-navy-900 text-base leading-relaxed">
                    <Trans
                        t={t}
                        i18nKey="auth.forgot.sentBody"
                        values={{ email: sentTo }}
                        components={{ strong: <strong /> }}
                    />
                </p>
                <p className="text-oxford-navy-900/70 text-sm">
                    {t('auth.forgot.sentHint')}
                </p>

                {errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                )}

                <Button
                    type="button"
                    variant="outline2"
                    onClick={() => requestLink(sentTo)}
                    disabled={isSubmitting || cooldown > 0}
                >
                    {isSubmitting
                        ? t('auth.resend.sending')
                        : cooldown > 0
                          ? t('auth.resend.wait', { seconds: cooldown })
                          : t('auth.forgot.resend')}
                </Button>

                <div className="flex flex-row flex-wrap gap-4 justify-center">
                    <button
                        type="button"
                        onClick={() => setSentTo(null)}
                        className={textLinkClass}
                    >
                        {t('auth.forgot.wrongAddress')}
                    </button>
                    <Link to="/login" className={textLinkClass}>
                        {t('auth.forgot.backToLogin')}
                    </Link>
                </div>
            </AuthCard>
        );
    }

    return (
        <AuthCard>
            <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                {t('auth.forgot.title')}
            </h5>
            <p className="text-oxford-navy-900 text-base leading-relaxed">
                {t('auth.forgot.intro')}
            </p>

            <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                    <Input
                        label={t('auth.forgot.emailLabel')}
                        name="email"
                        type="email"
                        placeholder={t('auth.forgot.emailPlaceholder')}
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        errorMessage={fieldError}
                        required
                    />

                    {errorMessage && (
                        <p className="text-red-600 text-sm">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? t('auth.resend.sending')
                            : t('auth.forgot.submit')}
                    </Button>
                </div>
            </form>

            <div className="flex flex-row gap-2 justify-center">
                <Link to="/login" className={textLinkClass}>
                    ← {t('auth.forgot.backToLogin')}
                </Link>
            </div>
        </AuthCard>
    );
}
