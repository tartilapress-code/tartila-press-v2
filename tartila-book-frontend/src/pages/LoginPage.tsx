import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '@/components/Button';
import Logo from '@/components/Logo';
import { useAuth } from '@/context/auth';
import { describeApiError } from '@/lib/apiErrors';

const PRESS_URL = import.meta.env.VITE_PRESS_URL as string;

/** Masuk dengan akun Tartila Press (email & kata sandi yang sama). */
export default function LoginPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);

    // Hanya alamat di situs ini yang boleh jadi tujuan setelah masuk.
    const next = params.get('next');
    const target =
        next && next.startsWith('/') && !next.startsWith('//') ? next : '/rak';

    if (user) {
        return <Navigate to={target} replace />;
    }

    async function submit(event: FormEvent) {
        event.preventDefault();
        setIsBusy(true);
        setError('');

        try {
            await login(email.trim(), password);
            navigate(target, { replace: true });
        } catch (caught) {
            setError(describeApiError(caught, 'Email atau kata sandi salah.'));
        } finally {
            setIsBusy(false);
        }
    }

    const field =
        'h-12 w-full rounded-xl border border-oxford-navy-900/15 bg-white px-4 text-[15px] text-oxford-navy-900 outline-none focus:border-forest-moss-500';

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-6 py-10">
            <div className="card-shadow flex flex-col gap-5 rounded-2xl bg-white p-7 ring-1 ring-forest-moss-100">
                <Logo hideSlogan />
                <div>
                    <h1 className="font-display text-2xl font-bold text-oxford-navy-700">
                        Masuk
                    </h1>
                    <p className="mt-1 text-sm text-oxford-navy-900/70">
                        Gunakan akun yang sama dengan Tartila Press.
                    </p>
                </div>

                <form onSubmit={submit} className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-oxford-navy-900">
                        Email
                        <input
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={field}
                        />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-oxford-navy-900">
                        Kata sandi
                        <input
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={field}
                        />
                    </label>

                    {error && (
                        <p
                            role="alert"
                            className="rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
                        >
                            {error}
                        </p>
                    )}

                    <Button type="submit" disabled={isBusy} className="h-12">
                        {isBusy ? 'Memproses...' : 'Masuk'}
                    </Button>
                </form>

                <p className="text-center text-sm text-oxford-navy-900/70">
                    Belum punya akun?{' '}
                    <a
                        href={`${PRESS_URL}/register`}
                        className="font-semibold text-forest-moss-700 underline"
                    >
                        Daftar di Tartila Press
                    </a>
                    <br />
                    <a
                        href={`${PRESS_URL}/lupa-password`}
                        className="text-forest-moss-700 underline"
                    >
                        Lupa kata sandi?
                    </a>
                </p>
            </div>
            <Link
                to="/"
                className="text-center text-sm text-forest-moss-700 underline"
            >
                Kembali ke beranda
            </Link>
        </div>
    );
}
