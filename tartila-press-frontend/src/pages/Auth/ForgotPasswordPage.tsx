import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
                setErrorMessage(
                    'Terlalu sering meminta link. Tunggu sebentar lalu coba lagi.'
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
                    Cek Email Anda
                </h5>
                <p className="text-oxford-navy-900 text-base leading-relaxed">
                    Jika <strong>{sentTo}</strong> terdaftar, link untuk membuat
                    password baru sudah kami kirim. Link berlaku 60 menit.
                </p>
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada? Cek folder spam dan pastikan penulisan email
                    sudah benar.
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
                        ? 'Mengirim...'
                        : cooldown > 0
                          ? `Kirim ulang (${cooldown} dtk)`
                          : 'Kirim Ulang'}
                </Button>

                <div className="flex flex-row flex-wrap gap-4 justify-center">
                    <button
                        type="button"
                        onClick={() => setSentTo(null)}
                        className={textLinkClass}
                    >
                        Salah alamat email? Ubah
                    </button>
                    <Link to="/login" className={textLinkClass}>
                        Kembali ke Login
                    </Link>
                </div>
            </AuthCard>
        );
    }

    return (
        <AuthCard>
            <h5 className="font-display block text-oxford-navy-700 text-2xl font-bold text-left">
                Lupa Password?
            </h5>
            <p className="text-oxford-navy-900 text-base leading-relaxed">
                Masukkan email akun Anda. Kami akan mengirimkan link untuk
                membuat password baru.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                    <Input
                        label="Email"
                        name="email"
                        type="email"
                        placeholder="nama@email.com"
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
                        {isSubmitting ? 'Mengirim...' : 'Kirim Link Reset'}
                    </Button>
                </div>
            </form>

            <div className="flex flex-row gap-2 justify-center">
                <Link to="/login" className={textLinkClass}>
                    ← Kembali ke Login
                </Link>
            </div>
        </AuthCard>
    );
}
