import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as editorApi from '@/data/editor/editorApi';
import { UnreadDot } from '@/components/notification/UnreadBadge';
import { useUnreadSubjects } from '@/context/useNotifications';
import { ApiError } from '@/lib/http';

type ManuscriptItem = {
    id: number;
    title: string;
    authors: string[];
    status: string;
    user: { name: string };
};

const statusLabels: Record<string, string> = {
    in_coauthoring: 'Perlu Disusun',
    coauthor_revision_requested: 'Perlu Revisi',
    pending_admin_review_coauthor: 'Menunggu Review Admin',
    pending_author_review_coauthor: 'Menunggu Persetujuan Penulis',
    pending_editor_assignment: 'Menunggu Editor',
    in_editing: 'Sedang Diedit',
    pending_admin_review_editor: 'Diedit — Review Admin',
    editor_revision_requested: 'Diedit — Revisi Editor',
    pending_penulis_review: 'Tinjauan Akhir Penulis',
    completed: 'Selesai',
};

/** Naskah yang disusun user ini sebagai co-author. */
export default function EditorCoauthorManuscriptsPage() {
    const unreadManuscripts = useUnreadSubjects('manuscript');
    const [manuscripts, setManuscripts] = useState<ManuscriptItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        editorApi
            .myCoauthorManuscripts()
            .then((response) => setManuscripts(response.data))
            .catch((error) =>
                setErrorMessage(
                    error instanceof ApiError
                        ? error.message
                        : 'Terjadi kesalahan. Silakan coba lagi.'
                )
            )
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Naskah Co-author
            </h5>

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada naskah yang Anda susun sebagai co-author.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {manuscripts.map((manuscript) => (
                        <Link
                            key={manuscript.id}
                            to={`/dashboard/naskah/${manuscript.id}`}
                            className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4 hover:bg-forest-moss-50"
                        >
                            <div>
                                <p className="flex items-center gap-2 text-oxford-navy-900 font-semibold">
                                    {unreadManuscripts.has(manuscript.id) && (
                                        <UnreadDot />
                                    )}
                                    {manuscript.title}
                                </p>
                                <p className="text-oxford-navy-900/65 text-sm">
                                    Penulis: {manuscript.authors.join(', ')} (
                                    {manuscript.user.name})
                                </p>
                            </div>
                            <span className="text-forest-moss-700 text-sm">
                                {statusLabels[manuscript.status] ??
                                    manuscript.status}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
