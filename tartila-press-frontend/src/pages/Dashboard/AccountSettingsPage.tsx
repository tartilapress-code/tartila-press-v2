import { useEffect, useState, type FormEvent } from 'react';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import { ApiError } from '@/lib/http';
import { useResendVerification } from '@/hooks/useResendVerification';
import { PASSWORD_HINT, validatePassword } from '@/lib/passwordPolicy';
import * as profileApi from '@/data/profile/profileApi';
import * as roleRequestApi from '@/data/roleRequest/roleRequestApi';
import type { RequestedRole } from '@/data/roleRequest/roleRequestApi';

function Card({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">{title}</h5>
            {children}
        </div>
    );
}

type RoleRequestRecord = {
    id: number;
    requested_role: RequestedRole;
    status: 'pending' | 'approved' | 'rejected';
    note: string | null;
};

const roleLabels: Record<RequestedRole, string> = {
    penulis: 'Penulis',
    editor: 'Editor',
};

function RoleUpgradeRow({ role }: { role: RequestedRole }) {
    const { user } = useAuth();
    const [requests, setRequests] = useState<RoleRequestRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        roleRequestApi
            .mine()
            .then((response) => setRequests(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    const alreadyHasRole = hasAnyRole(user, [role]);
    const latestRequest = requests.find((r) => r.requested_role === role);

    async function handleRequest() {
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await roleRequestApi.create(role);
            setRequests((prev) => [response.data, ...prev]);
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
            <div className="flex flex-row items-center justify-between gap-4">
                <p className="text-oxford-navy-900 font-semibold">
                    {roleLabels[role]}
                </p>

                {isLoading ? null : alreadyHasRole ? (
                    <span className="text-forest-moss-700 text-sm">
                        Sudah aktif
                    </span>
                ) : latestRequest?.status === 'pending' ? (
                    <span className="text-oxford-navy-900/70 text-sm">
                        Menunggu persetujuan
                    </span>
                ) : (
                    <Button
                        type="button"
                        variant="outline2"
                        onClick={handleRequest}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? 'Mengirim...'
                            : `Ajukan jadi ${roleLabels[role]}`}
                    </Button>
                )}
            </div>

            {!isLoading && !alreadyHasRole && latestRequest?.status === 'rejected' && (
                <p className="text-red-600 text-sm">
                    Permintaan sebelumnya ditolak
                    {latestRequest.note ? `: ${latestRequest.note}` : '.'}
                </p>
            )}

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}
        </div>
    );
}

export default function AccountSettingsPage() {
    const { user, logout } = useAuth();
    const {
        send: resendVerification,
        isSending: isResending,
        cooldown: resendCooldown,
        message: resendMessage,
        isError: resendIsError,
    } = useResendVerification();

    const [name, setName] = useState<string>(user?.name ?? '');
    const [nameStatus, setNameStatus] = useState<string>('');
    const [nameSubmitting, setNameSubmitting] = useState<boolean>(false);

    const [emailStatus, setEmailStatus] = useState<string>('');
    const [emailSubmitting, setEmailSubmitting] = useState<boolean>(false);

    const [passwordStatus, setPasswordStatus] = useState<string>('');
    const [passwordError, setPasswordError] = useState<string>('');
    const [passwordSubmitting, setPasswordSubmitting] =
        useState<boolean>(false);

    async function handleNameSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setNameSubmitting(true);
        setNameStatus('');

        try {
            await profileApi.updateProfile({ name });
            setNameStatus('Nama berhasil diperbarui.');
        } catch (error) {
            setNameStatus(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setNameSubmitting(false);
        }
    }

    async function handleEmailSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setEmailSubmitting(true);
        setEmailStatus('');

        // e.currentTarget bernilai null setelah await, jadi ambil form-nya dulu.
        const form = e.currentTarget;
        const formData = new FormData(form);

        try {
            await profileApi.requestEmailChange({
                email: String(formData.get('email')),
                current_password: String(formData.get('current_password')),
            });
            setEmailStatus(
                'Link konfirmasi telah dikirim ke email baru. Buka email tersebut dan klik link-nya. Setelah itu Anda perlu masuk kembali dengan email baru.'
            );
            form.reset();
        } catch (error) {
            setEmailStatus(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setEmailSubmitting(false);
        }
    }

    async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setPasswordSubmitting(true);
        setPasswordStatus('');
        setPasswordError('');

        const formData = new FormData(e.currentTarget);
        const password = String(formData.get('password'));
        const passwordConfirmation = String(
            formData.get('password_confirmation')
        );

        const passwordProblem = validatePassword(password);
        if (passwordProblem) {
            setPasswordError(passwordProblem);
            setPasswordSubmitting(false);
            return;
        }

        if (password !== passwordConfirmation) {
            setPasswordError('Konfirmasi password tidak sesuai.');
            setPasswordSubmitting(false);
            return;
        }

        try {
            await profileApi.changePassword({
                current_password: String(formData.get('current_password')),
                password,
                password_confirmation: passwordConfirmation,
            });

            /*
            |--------------------------------------------------------------------------
            | Backend revokes all Sanctum tokens after a password change,
            | including the one this session is using — so log out locally too.
            |--------------------------------------------------------------------------
            */

            await logout();
        } catch (error) {
            if (error instanceof ApiError) {
                // Pesan per-field lebih jelas daripada ringkasan
                // "... (and N more errors)" dari server.
                const messages = error.errors
                    ? Object.values(error.errors).flat()
                    : [];

                setPasswordError(
                    messages.length > 0 ? messages.join(' ') : error.message
                );
            } else {
                setPasswordError('Terjadi kesalahan. Silakan coba lagi.');
            }
        } finally {
            setPasswordSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Card title="Nama">
                <form
                    onSubmit={handleNameSubmit}
                    className="flex flex-col gap-4"
                >
                    <Input
                        label="Nama Lengkap"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    {nameStatus && (
                        <p className="text-sm text-forest-moss-700">
                            {nameStatus}
                        </p>
                    )}
                    <Button
                        type="submit"
                        variant="primary"
                        className="self-start"
                        disabled={nameSubmitting}
                    >
                        {nameSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </form>
            </Card>

            <Card title="Email">
                <p className="text-oxford-navy-900 text-sm">
                    Email saat ini: <strong>{user?.email}</strong>
                    {' — '}
                    {user?.email_verified_at ? (
                        <span className="text-forest-moss-700">
                            Terverifikasi
                        </span>
                    ) : (
                        <span className="text-red-600">Belum diverifikasi</span>
                    )}
                </p>
                {!user?.email_verified_at && (
                    <div className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
                        <p className="text-oxford-navy-900/80 text-sm">
                            Kirim link verifikasi ke email ini, lalu buka email
                            dan klik tombol verifikasi (cek juga folder spam).
                        </p>
                        <Button
                            type="button"
                            variant="outline2"
                            className="self-start"
                            onClick={resendVerification}
                            disabled={isResending || resendCooldown > 0}
                        >
                            {isResending
                                ? 'Mengirim...'
                                : resendCooldown > 0
                                  ? `Kirim ulang (${resendCooldown} dtk)`
                                  : 'Kirim Email Verifikasi'}
                        </Button>
                        {resendMessage && (
                            <p
                                className={`text-sm ${
                                    resendIsError
                                        ? 'text-red-600'
                                        : 'text-forest-moss-700'
                                }`}
                            >
                                {resendMessage}
                            </p>
                        )}
                    </div>
                )}
                <form
                    onSubmit={handleEmailSubmit}
                    className="flex flex-col gap-4"
                >
                    <Input
                        label="Email Baru"
                        name="email"
                        type="email"
                        required
                    />
                    <Input
                        label="Password Saat Ini"
                        name="current_password"
                        type="password"
                        required
                    />
                    {emailStatus && (
                        <p className="text-sm text-forest-moss-700">
                            {emailStatus}
                        </p>
                    )}
                    <Button
                        type="submit"
                        variant="primary"
                        className="self-start"
                        disabled={emailSubmitting}
                    >
                        {emailSubmitting ? 'Mengirim...' : 'Ganti Email'}
                    </Button>
                </form>
            </Card>

            <Card title="Password">
                <form
                    onSubmit={handlePasswordSubmit}
                    className="flex flex-col gap-4"
                >
                    <Input
                        label="Password Saat Ini"
                        name="current_password"
                        type="password"
                        required
                    />
                    <Input
                        label="Password Baru"
                        name="password"
                        type="password"
                        required
                    />
                    <small className="text-oxford-navy-900/70 -mt-2">
                        {PASSWORD_HINT}
                    </small>
                    <Input
                        label="Konfirmasi Password Baru"
                        name="password_confirmation"
                        type="password"
                        required
                    />
                    {passwordError && (
                        <p className="text-sm text-red-600">
                            {passwordError}
                        </p>
                    )}
                    {passwordStatus && (
                        <p className="text-sm text-forest-moss-700">
                            {passwordStatus}
                        </p>
                    )}
                    <Button
                        type="submit"
                        variant="primary"
                        className="self-start"
                        disabled={passwordSubmitting}
                    >
                        {passwordSubmitting
                            ? 'Menyimpan...'
                            : 'Ganti Password'}
                    </Button>
                </form>
            </Card>

            <Card title="Jadi Penulis / Editor">
                <p className="text-oxford-navy-900/70 text-sm">
                    Ajukan untuk membuka fitur Penulis dan/atau Editor.
                    Permintaan akan ditinjau oleh Admin.
                </p>
                <div className="flex flex-col gap-3">
                    <RoleUpgradeRow role="penulis" />
                    <RoleUpgradeRow role="editor" />
                </div>
            </Card>
        </div>
    );
}
