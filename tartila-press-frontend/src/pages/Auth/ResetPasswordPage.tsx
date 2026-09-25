import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import AuthCard from '@/components/AuthCard';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import * as authApi from '@/data/auth/authApi';
import { ApiError } from '@/lib/http';
import { validatePassword } from '@/lib/passwordPolicy';
import type { LoginNotice } from '@/pages/Login/LoginPage';

function InvalidLinkPanel({ message }: { message: string }) {
    const { t } = useTranslation();

    return (
        <AuthCard>
            <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                {t('auth.reset.invalidTitle')}
            </h5>
            <p className="text-oxford-navy-900 text-base leading-relaxed">
                {message}
            </p>
            <Link
                to="/lupa-password"
                className="inline-flex items-center justify-center font-semibold text-sm rounded-lg px-4 py-3 bg-oxford-navy-700 text-white hover:bg-oxford-navy-600 transition-colors"
            >
                {t('auth.reset.askNew')}
            </Link>
        </AuthCard>
    );
}

/**
 * Tujuan link di email reset password:
 * /reset-password?token=...&email=...
 */
export default function ResetPasswordPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const token = searchParams.get('token') ?? '';
    const email = searchParams.get('email') ?? '';

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>(
        {}
    );
    // Token ditolak server (dipakai / kedaluwarsa) → link perlu diminta ulang.
    const [tokenRejected, setTokenRejected] = useState<boolean>(false);

    if (!token || !email) {
        return <InvalidLinkPanel message={t('auth.reset.incomplete')} />;
    }

    if (tokenRejected) {
        return <InvalidLinkPanel message={t('auth.reset.rejected')} />;
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setErrorMessage('');
        setFieldErrors({});

        const formData = new FormData(e.currentTarget);
        const password = String(formData.get('password') ?? '');
        const passwordConfirmation = String(
            formData.get('password_confirmation') ?? ''
        );

        const problem = validatePassword(password);
        if (problem) {
            setFieldErrors({ password: [t(problem)] });
            return;
        }

        if (password !== passwordConfirmation) {
            setFieldErrors({
                password_confirmation: [t('auth.password.mismatch')],
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await authApi.resetPassword({
                token,
                email,
                password,
                password_confirmation: passwordConfirmation,
            });

            navigate('/login', {
                replace: true,
                state: { notice: 'passwordReset' } satisfies {
                    notice: LoginNotice;
                },
            });
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                if (error.errors) {
                    setFieldErrors(error.errors);
                } else {
                    setTokenRejected(true);
                }
            } else if (error instanceof ApiError && error.status === 429) {
                setErrorMessage(t('auth.reset.throttled'));
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

    return (
        <AuthCard>
            <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                {t('auth.reset.title')}
            </h5>
            <p className="text-oxford-navy-900 text-base leading-relaxed">
                <Trans
                    t={t}
                    i18nKey="auth.reset.forAccount"
                    values={{ email }}
                    components={{ strong: <strong className="break-all" /> }}
                />
            </p>

            <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                    <Input
                        label={t('auth.reset.passwordLabel')}
                        name="password"
                        type="password"
                        placeholder="********"
                        autoComplete="new-password"
                        errorMessage={fieldErrors.password?.[0] ?? ''}
                        required
                    />
                    <small className="text-oxford-navy-900/70 -mt-2">
                        {t('auth.password.hint')}
                    </small>

                    <Input
                        label={t('auth.reset.confirmLabel')}
                        name="password_confirmation"
                        type="password"
                        placeholder="********"
                        autoComplete="new-password"
                        errorMessage={
                            fieldErrors.password_confirmation?.[0] ?? ''
                        }
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
                            ? t('auth.reset.submitting')
                            : t('auth.reset.submit')}
                    </Button>
                </div>
            </form>
        </AuthCard>
    );
}
