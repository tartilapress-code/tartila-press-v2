import { useEffect, useState, type FormEvent } from 'react';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';

const textareaClass = `
    w-full p-3 outline-none rounded-xl ring-1 ring-white/30 placeholder:text-white
    focus:ring-1 focus:ring-oxford-navy-500 focus:bg-oxford-navy-900/70`;

export default function EditorProfilePage() {
    const [fee, setFee] = useState<string>('0');
    const [bio, setBio] = useState<string>('');
    const [isAvailable, setIsAvailable] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    useEffect(() => {
        editorApi
            .getMyProfile()
            .then((response) => {
                const profile = response.data;
                if (profile) {
                    setFee(profile.fee?.toString() ?? '0');
                    setBio(profile.bio ?? '');
                    setIsAvailable(Boolean(profile.is_available));
                }
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await editorApi.upsertMyProfile({
                fee,
                bio,
                is_available: isAvailable,
            });
            setStatusMessage('Profil editor berhasil disimpan.');
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    return (
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <div>
                <h5 className="text-white text-xl font-semibold">
                    Profil Editor
                </h5>
                <p className="text-white/70 text-sm">
                    Atur fee tambahan Anda saat dipilih langsung oleh penulis,
                    dan status ketersediaan.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                    label="Fee Tambahan (Rp)"
                    name="fee"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                />

                <div className="flex flex-col gap-2">
                    <label className="text-white">Bio</label>
                    <textarea
                        className={textareaClass}
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    />
                </div>

                <label className="flex flex-row items-center gap-2 text-white">
                    <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={(e) => setIsAvailable(e.target.checked)}
                    />
                    Tersedia untuk dipilih penulis
                </label>

                {statusMessage && (
                    <p className="text-sm text-forest-moss-300">
                        {statusMessage}
                    </p>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    className="self-start"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </Button>
            </form>
        </div>
    );
}
