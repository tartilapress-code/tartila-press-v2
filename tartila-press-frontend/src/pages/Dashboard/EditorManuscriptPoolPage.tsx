import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';

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
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <h5 className="text-white text-xl font-semibold">
                Pool Naskah Terbuka
            </h5>

            {errorMessage && (
                <p className="text-red-400 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-white/70 text-sm">
                    Belum ada naskah yang terbuka untuk diambil.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {manuscripts.map((manuscript) => (
                        <div
                            key={manuscript.id}
                            className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-white font-semibold">
                                    {manuscript.title}
                                </p>
                                <p className="text-white/60 text-sm">
                                    Penulis: {manuscript.authors.join(', ')}
                                </p>
                                {manuscript.editor_fee && (
                                    <p className="text-forest-moss-300 text-sm">
                                        Fee: Rp {manuscript.editor_fee}
                                    </p>
                                )}
                                {manuscript.editor_deadline && (
                                    <p className="text-white/60 text-sm">
                                        Deadline: {manuscript.editor_deadline}
                                    </p>
                                )}
                                {manuscript.editor_assignment_note && (
                                    <p className="text-white/60 text-sm">
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
