import type { ReactNode } from 'react';
import AuthCard from '@/components/AuthCard';
import { Link, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated, isLoading } = useAuth();
    const { send, isSending, cooldown, message, isError } =
        useResendVerification();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <p className="text-oxford-navy-900">Memuat...</p>
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
                    ? 'Mengirim...'
                    : cooldown > 0
                      ? `Kirim ulang (${cooldown} dtk)`
                      : 'Kirim Ulang Email Verifikasi'}
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
            Ke Dashboard
        </Link>
    ) : (
        <Link to="/login" className={primaryLinkClass}>
            Masuk
        </Link>
    );

    const content: Record<
        Result,
        { icon: ReactNode; title: string; body: ReactNode; action: ReactNode }
    > = {
        pending: {
            icon: <RiMailSendLine size={40} className="text-forest-moss-800" />,
            title: 'Cek Email Anda',
            body: (
                <>
                    Kami sudah mengirim link verifikasi
                    {user?.email ? (
                        <>
                            {' '}
                            ke <strong>{user.email}</strong>
                        </>
                    ) : null}
                    . Buka email tersebut lalu klik tombol{' '}
                    <strong>Verifikasi Email</strong>. Jika tidak ada di kotak
                    masuk, cek folder spam.
                </>
            ),
            action: isAuthenticated ? (
                <div className="flex flex-col items-center gap-4">
                    {resendButton}
                    <Link
                        to="/"
                        className="text-oxford-navy-600 text-sm hover:text-oxford-navy-500 underline"
                    >
                        Lanjut ke Beranda
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
            title: 'Email Berhasil Diverifikasi',
            body: 'Terima kasih! Akun Anda sekarang sudah terverifikasi dan bisa dipakai sepenuhnya.',
            action: continueLink,
        },
        already: {
            icon: (
                <RiInformationFill size={40} className="text-forest-moss-800" />
            ),
            title: 'Email Sudah Terverifikasi',
            body: 'Email Anda sudah pernah diverifikasi. Tidak ada yang perlu dilakukan lagi.',
            action: continueLink,
        },
        invalid: {
            icon: <RiErrorWarningFill size={40} className="text-red-700" />,
            title: 'Link Tidak Valid',
            body: 'Link verifikasi ini tidak valid atau sudah kedaluwarsa. Minta link yang baru untuk melanjutkan.',
            action: isVerified ? (
                continueLink
            ) : isAuthenticated ? (
                resendButton
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <p className="text-oxford-navy-700 text-sm">
                        Masuk terlebih dahulu untuk mengirim ulang link.
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
            title: 'Email Berhasil Diubah',
            body: 'Email akun Anda sudah diganti dan langsung terverifikasi. Demi keamanan, silakan masuk kembali dengan email baru Anda.',
            action: continueLink,
        },
        taken: {
            icon: <RiErrorWarningFill size={40} className="text-red-700" />,
            title: 'Email Sudah Digunakan',
            body: 'Email baru tersebut sudah dipakai oleh akun lain, jadi tidak bisa dipasang di akun ini. Ajukan penggantian email lagi dengan alamat yang berbeda.',
            action: continueLink,
        },
        'change-invalid': {
            icon: <RiErrorWarningFill size={40} className="text-red-700" />,
            title: 'Link Tidak Valid',
            body: 'Link penggantian email ini tidak valid atau sudah kedaluwarsa. Ajukan penggantian email lagi dari halaman Akun.',
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
