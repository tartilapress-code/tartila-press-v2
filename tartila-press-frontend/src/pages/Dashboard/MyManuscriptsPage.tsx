import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import IsbnStartButton from '@/components/isbn/IsbnStartButton';
import { useAuth } from '@/context/useAuth';
import * as isbnApi from '@/data/isbn/isbnApi';
import * as manuscriptApi from '@/data/manuscript/manuscriptApi';
import { CHAPTER_STATUS_LABELS } from '@/lib/manuscriptStatus';
import { UnreadDot } from '@/components/notification/UnreadBadge';
import { useUnreadSubjects } from '@/context/useNotifications';

type ManuscriptItem = {
    id: number;
    title: string;
    authors: string[];
    status: string;
    editor: { name: string } | null;
    can_request_isbn: boolean;
    isbn_application: {
        id: number;
        applicant_id: number;
        status: isbnApi.IsbnStatus;
    } | null;
    // Ringkasan proses penerbitan (setelah naskah selesai).
    publication: { current: string; completed: boolean } | null;
};

const statusLabels: Record<string, string> = {
    submitted: 'Menunggu Review Admin',
    revision_requested: 'Perlu Revisi',
    pending_editor_assignment: 'Menunggu Penugasan Editor',
    in_editing: 'Sedang Diedit Editor',
    pending_admin_review_editor: 'Menunggu Review Admin (Editor)',
    editor_revision_requested: 'Editor Sedang Revisi',
    pending_penulis_review: 'Menunggu Review Anda',
    completed: 'Selesai',
    ...CHAPTER_STATUS_LABELS,
};

export default function MyManuscriptsPage() {
    const unreadManuscripts = useUnreadSubjects('manuscript');
    const { user } = useAuth();
    const [manuscripts, setManuscripts] = useState<ManuscriptItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        manuscriptApi
            .mine()
            .then((response) => setManuscripts(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Naskah Saya
            </h5>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada naskah. Submit naskah lewat halaman Pesanan Saya
                    setelah pesanan dikonfirmasi.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {manuscripts.map((manuscript) => (
                        <div
                            key={manuscript.id}
                            className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <Link
                                to={`/dashboard/naskah/${manuscript.id}`}
                                className="flex flex-row items-center justify-between gap-4"
                            >
                                <div>
                                    <p className="flex items-center gap-2 text-oxford-navy-900 font-semibold">
                                        {unreadManuscripts.has(
                                            manuscript.id
                                        ) && <UnreadDot />}
                                        {manuscript.title}
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        {manuscript.authors.join(', ')}
                                    </p>
                                    {manuscript.editor && (
                                        <p className="text-oxford-navy-900/65 text-sm">
                                            Editor: {manuscript.editor.name}
                                        </p>
                                    )}
                                </div>
                                <span className="text-forest-moss-700 text-sm">
                                    {statusLabels[manuscript.status] ??
                                        manuscript.status}
                                </span>
                            </Link>

                            {manuscript.publication && (
                                <Link
                                    to={`/dashboard/naskah/${manuscript.id}`}
                                    className="flex flex-row flex-wrap items-center gap-2 text-xs"
                                >
                                    <span
                                        className={`rounded-full px-2 py-0.5 font-semibold text-white ${manuscript.publication.completed ? 'bg-forest-moss-600' : 'bg-oxford-navy-700'}`}
                                    >
                                        {manuscript.publication.completed
                                            ? 'Penerbitan selesai'
                                            : 'Proses penerbitan'}
                                    </span>
                                    {!manuscript.publication.completed && (
                                        <span className="text-oxford-navy-900/75">
                                            {manuscript.publication.current}
                                        </span>
                                    )}
                                    <span className="text-forest-moss-700 hover:underline">
                                        Lihat riwayat →
                                    </span>
                                </Link>
                            )}

                            {manuscript.can_request_isbn && (
                                <IsbnStartButton
                                    target={{ manuscript_id: manuscript.id }}
                                />
                            )}
                            {manuscript.isbn_application &&
                                manuscript.isbn_application.applicant_id ===
                                    user?.id && (
                                    <div className="flex flex-row flex-wrap items-center gap-3">
                                        <Link
                                            to={`/dashboard/isbn/${manuscript.isbn_application.id}`}
                                            className="bg-oxford-navy-700 hover:bg-oxford-navy-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                                        >
                                            Buka Surat Pengajuan ISBN
                                        </Link>
                                        <span className="text-oxford-navy-900/65 text-xs">
                                            {
                                                isbnApi.STATUS_LABEL[
                                                    manuscript.isbn_application
                                                        .status
                                                ]
                                            }
                                        </span>
                                    </div>
                                )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
