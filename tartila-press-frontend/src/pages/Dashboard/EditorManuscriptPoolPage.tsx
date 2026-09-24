import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

type PoolItem = {
    id: number;
    title: string;
    authors: string[];
    editor_fee: string | null;
    editor_deadline: string | null;
    editor_assignment_note: string | null;
    user: { name: string };
};

export default function EditorManuscriptPoolPage() {
    const navigate = useNavigate();
    const [manuscripts, setManuscripts] = useState<PoolItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [claimingId, setClaimingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        editorApi
            .manuscriptPool()
            .then((response) => setManuscripts(response.data))
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
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Pool Naskah Terbuka
            </h5>

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
                                        Deadline: {manuscript.editor_deadline}
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
