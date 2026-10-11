import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as isbnApi from '@/data/isbn/isbnApi';
import { ApiError } from '@/lib/http';

/**
 * Tombol "Terbitkan ISBN": membuka (atau membuat) surat permohonan ISBN untuk
 * naskah / proyek Book Chapter lalu pindah ke halaman tinjau & tanda tangan.
 * Kalau Data Pribadi belum lengkap, pesan dan tautan ke Data Pribadi tampil.
 */
export default function IsbnStartButton({
    target,
}: {
    target: { manuscript_id: number } | { book_id: number };
}) {
    const navigate = useNavigate();
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');

    async function handleClick() {
        setIsBusy(true);
        setMessage('');

        try {
            const response = await isbnApi.open(target);
            navigate(`/dashboard/isbn/${response.data.id}`);
        } catch (caught) {
            setMessage(
                caught instanceof ApiError
                    ? caught.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <Button
                variant="primary"
                className="self-start"
                onClick={handleClick}
                disabled={isBusy}
            >
                {isBusy ? 'Membuka...' : 'Terbitkan ISBN'}
            </Button>
            {message && <p className="text-red-600 text-sm">{message}</p>}
            {message.includes('Data Pribadi') && (
                <Link
                    to="/dashboard/data-pribadi"
                    className="text-forest-moss-700 text-sm underline self-start"
                >
                    Lengkapi Data Pribadi
                </Link>
            )}
        </div>
    );
}
