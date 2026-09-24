import { useState } from 'react';
import loginField from '@/data/login/login.json';
import Button from '../../components/Button/Button';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ArrowBack from '../../components/ArrowBack';
import AuthCard from '@/components/AuthCard';
import Input from '../../components/Input/Input';
import { useAuth } from '@/context/useAuth';
import { ApiError } from '@/lib/http';
import type { LoginPayload } from '@/data/auth/authApi';

export default function Login(): React.ReactNode {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Pesan dari halaman sebelumnya, mis. "Password berhasil diubah".
    const notice = (location.state as { notice?: string } | null)?.notice;

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        setIsSubmitting(true);
        setErrorMessage('');

        const formData = new FormData(e.currentTarget);
        const payload = Object.fromEntries(
            formData.entries()
        ) as unknown as LoginPayload;

        try {
            await login(payload);
            navigate('/');
        } catch (error) {
            if (error instanceof ApiError) {
                setErrorMessage(error.message);
            } else {
                setErrorMessage('Terjadi kesalahan. Silakan coba lagi.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AuthCard>
            <ArrowBack />
            <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                    Masuk ke akun Anda
                </h1>
                <p className="text-sm leading-relaxed text-oxford-navy-900/65">
                    Kelola naskah, pesanan, dan buku Anda di Tartila Press.
                </p>
            </div>
            {notice && (
                <p className="rounded-xl bg-forest-moss-100 px-4 py-3 text-sm text-forest-moss-800">
                    {notice}
                </p>
            )}
            <form onSubmit={handleLoginSubmit}>
                <div className="flex flex-col gap-4">
                    {loginField.map((field) => (
                        <Input
                            key={field.id}
                            id={field.id}
                            name={field.name}
                            type={field.type}
                            label={field.label}
                            placeholder={field.placeholder}
                            required={field.required}
                        />
                    ))}

                    <Link
                        to="/lupa-password"
                        className="self-end text-sm text-forest-moss-700 underline hover:text-forest-moss-800"
                    >
                        Lupa password?
                    </Link>

                    {errorMessage && (
                        <p className="text-sm text-red-600">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Memproses...' : 'Login'}
                    </Button>
                </div>
            </form>

            <div className="flex flex-row justify-center gap-2 text-sm">
                <p className="text-oxford-navy-900/65">Belum punya akun?</p>
                <Link
                    to="/register"
                    className="font-semibold text-forest-moss-700 hover:text-forest-moss-800 hover:underline"
                >
                    Daftar
                </Link>
            </div>
        </AuthCard>
    );
}
