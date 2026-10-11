import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import DifficultyBadge from '@/components/manuscript/DifficultyBadge';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

// Deadline dikirim sebagai tanggal (tengah malam UTC); tampilkan apa adanya.
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

type PoolItem = {
    id: number;
    title: string;
    authors: string[];
    editor_fee: string | null;
    editor_deadline: string | null;
    editor_assignment_note: string | null;
    difficulty: string | null;
    // Kriteria editor: umum atau bidang tertentu.
    pool_criteria: {
        general: boolean;
        field_categories: { id: number; name: string }[];
    };
    user: { name: string };
};

export default function EditorManuscriptPoolPage() {
    const navigate = useNavigate();
    const [manuscripts, setManuscripts] = useState<PoolItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [claimingId, setClaimingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    // Bidang keahlian editor ini (diatur admin).
    const [myFields, setMyFields] = useState<string[]>([]);

    useEffect(() => {
        editorApi
            .manuscriptPool()
            .then((response) => {
                setManuscripts(response.data);
                setMyFields(response.meta?.my_field_categories ?? []);
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function handleClaim(id: number) {
        setClaimingId(id);
        setErrorMessage('');

        try {
            await editorApi.claimManuscript(id);
            navigate(`/dashboard/naskah/${id}`);
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
            setClaimingId(null);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Pool Naskah Terbuka
                </h5>
                {!isLoading && (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Bidang keahlian Anda:{' '}
                        <strong>
                            {myFields.length > 0
                                ? myFields.join(', ')
                                : 'belum diatur (hanya naskah umum)'}
                        </strong>
                        . Naskah yang khusus bidang tertentu hanya tampil untuk
                        editor dengan bidang itu; bidang keahlian diatur admin.
                    </p>
                )}
            </div>

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada naskah yang terbuka untuk diambil.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {manuscripts.map((manuscript) => (
                        <div
                            key={manuscript.id}
                            className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-oxford-navy-900 font-semibold">
                                    {manuscript.title}
                                </p>
                                <div className="my-1 flex flex-wrap gap-2">
                                    <DifficultyBadge
                                        difficulty={manuscript.difficulty}
                                    />
                                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-oxford-navy-800 ring-1 ring-forest-moss-200">
                                        {manuscript.pool_criteria.general
                                            ? 'Umum'
                                            : `Bidang: ${manuscript.pool_criteria.field_categories
                                                  .map((item) => item.name)
                                                  .join(', ')}`}
                                    </span>
                                </div>
                                <p className="text-oxford-navy-900/65 text-sm">
                                    Penulis: {manuscript.authors.join(', ')}
                                </p>
                                {manuscript.editor_fee && (
                                    <p className="text-forest-moss-700 text-sm">
                                        Harga pengerjaan:{' '}
                                        {rupiahFormatter.format(
                                            Number(manuscript.editor_fee)
                                        )}
                                    </p>
                                )}
                                {manuscript.editor_deadline && (
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        Deadline:{' '}
                                        {dateFormatter.format(
                                            new Date(manuscript.editor_deadline)
                                        )}
                                    </p>
                                )}
                                {manuscript.editor_assignment_note && (
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        Catatan:{' '}
                                        {manuscript.editor_assignment_note}
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="primary"
                                onClick={() => handleClaim(manuscript.id)}
                                disabled={claimingId === manuscript.id}
                            >
                                Ambil Naskah Ini
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
