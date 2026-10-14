import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    coauthor_fee: string | null;
    coauthor_deadline: string | null;
    coauthor_assignment_note: string | null;
    difficulty: string | null;
    pool_criteria: {
        general: boolean;
        field_categories: { id: number; name: string }[];
    };
    user: { name: string };
};

/** Pool naskah untuk co-author: hanya editor yang mencentang co-author dan bidangnya cocok. */
export default function EditorCoauthorPoolPage() {
    const navigate = useNavigate();
    const [manuscripts, setManuscripts] = useState<PoolItem[]>([]);
    const [royaltyPercent, setRoyaltyPercent] = useState<number>(5);
    // Editor dalam pemantauan admin tidak bisa mengambil naskah dari pool.
    const [isMonitored, setIsMonitored] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [claimingId, setClaimingId] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        editorApi
            .coauthorPool()
            .then((response) => {
                setManuscripts(response.data);
                setRoyaltyPercent(Number(response.meta?.royalty_percent ?? 5));
                setIsMonitored(Boolean(response.meta?.under_monitoring));
            })
            .catch((error) =>
                setErrorMessage(
                    error instanceof ApiError
                        ? error.message
                        : 'Terjadi kesalahan. Silakan coba lagi.'
                )
            )
            .finally(() => setIsLoading(false));
    }, []);

    async function handleClaim(id: number) {
        setClaimingId(id);
        setErrorMessage('');

        try {
            await editorApi.claimCoauthorManuscript(id);
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
                    Pool Co-author
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Naskah mentah penulis yang membutuhkan co-author untuk
                    menyusunnya. Jika Anda mengambilnya, nama Anda tercatat
                    sebagai penulis terakhir buku dengan royalti tetap{' '}
                    <strong>{royaltyPercent}%</strong> (buku cetak dan ebook)
                    dan Anda ikut menandatangani MOU. Syarat: centang co-author
                    di{' '}
                    <Link
                        to="/dashboard/profil-editor"
                        className="font-semibold text-forest-moss-700 underline"
                    >
                        Profil Editor
                    </Link>
                    ; bidang keahlian diatur admin.
                </p>
            </div>

            {isMonitored && (
                <p
                    role="note"
                    className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                >
                    Akun Anda sedang dalam pemantauan admin, jadi belum bisa
                    mengambil naskah dari pool.
                </p>
            )}

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada naskah yang terbuka untuk co-author.
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
                                {manuscript.coauthor_fee && (
                                    <p className="text-forest-moss-700 text-sm">
                                        Fee co-author:{' '}
                                        {rupiahFormatter.format(
                                            Number(manuscript.coauthor_fee)
                                        )}
                                    </p>
                                )}
                                {manuscript.coauthor_deadline && (
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        Deadline:{' '}
                                        {dateFormatter.format(
                                            new Date(
                                                manuscript.coauthor_deadline
                                            )
                                        )}
                                    </p>
                                )}
                                {manuscript.coauthor_assignment_note && (
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        Catatan:{' '}
                                        {manuscript.coauthor_assignment_note}
                                    </p>
                                )}
                            </div>
                            <Button
                                variant="primary"
                                onClick={() => handleClaim(manuscript.id)}
                                disabled={
                                    claimingId === manuscript.id || isMonitored
                                }
                            >
                                Ambil sebagai Co-author
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
