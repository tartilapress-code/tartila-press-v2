import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthCard from '@/components/AuthCard';
import Button from '@/components/Button/Button';
import Input from '@/components/Input/Input';
import * as authApi from '@/data/auth/authApi';
import { ApiError } from '@/lib/http';
import { PASSWORD_HINT, validatePassword } from '@/lib/passwordPolicy';

function InvalidLinkPanel({ message }: { message: string }) {
    return (
        <AuthCard>
            <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                Link Tidak Valid
            </h5>
            <p className="text-oxford-navy-900 text-base leading-relaxed">
                {message}
            </p>
            <Link
                to="/lupa-password"
                className="inline-flex items-center justify-center font-semibold text-sm rounded-lg px-4 py-3 bg-oxford-navy-700 text-white hover:bg-oxford-navy-600 transition-colors"
            >
                Minta Link Baru
            </Link>
        </AuthCard>
    );
}

/**
 * Tujuan link di email reset password:
 * /reset-password?token=...&email=...
 */
export default function ResetPasswordPage() {
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
    const [tokenProblem, setTokenProblem] = useState<string>('');

    if (!token || !email) {
        return (
            <InvalidLinkPanel message="Link reset password ini tidak lengkap. Minta link yang baru untuk melanjutkan." />
        );
    }

    if (tokenProblem) {
        return (
            <InvalidLinkPanel
                message={`${tokenProblem} Minta link yang baru untuk melanjutkan.`}
            />
        );
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
            setFieldErrors({ password: [problem] });
            return;
        }

        if (password !== passwordConfirmation) {
            setFieldErrors({
                password_confirmation: ['Konfirmasi password tidak sesuai.'],
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
                state: {
                    notice: 'Password berhasil diubah. Silakan login dengan password baru Anda.',
                },
            });
        } catch (error) {
            if (error instanceof ApiError && error.status === 422) {
                if (error.errors) {
                    setFieldErrors(error.errors);
                } else {
                    setTokenProblem(error.message);
                }
            } else if (error instanceof ApiError && error.status === 429) {
                setErrorMessage(
                    'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
                );
            } else {
                setErrorMessage(
                    error instanceof ApiError
                        ? error.message
                        : 'Terjadi kesalahan. Silakan coba lagi.'
                );
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <AuthCard>
            <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                Buat Password Baru
            </h5>
            <p className="text-oxford-navy-900 text-base leading-relaxed">
                Untuk akun <strong className="break-all">{email}</strong>
            </p>

            <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                    <Input
                        label="Password Baru"
                        name="password"
                        type="password"
                        placeholder="********"
                        autoComplete="new-password"
                        errorMessage={fieldErrors.password?.[0] ?? ''}
                        required
                    />
                    <small className="text-oxford-navy-900/70 -mt-2">
                        {PASSWORD_HINT}
                    </small>

                    <Input
                        label="Konfirmasi Password Baru"
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
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Password Baru'}
                    </Button>
                </div>
            </form>
        </AuthCard>
    );
}
