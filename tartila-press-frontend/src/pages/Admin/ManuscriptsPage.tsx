import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Select from '@/components/Select/Select';
import { SearchField } from '@/components/ui/FilterControls';
import Pagination from '@/components/ui/Pagination';
import * as adminApi from '@/data/admin/adminApi';
import type { PageMeta } from '@/lib/pagination';
import { CHAPTER_STATUS_LABELS } from '@/lib/manuscriptStatus';
import { UnreadDot } from '@/components/notification/UnreadBadge';
import DifficultyBadge from '@/components/manuscript/DifficultyBadge';
import { useUnreadSubjects } from '@/context/useNotifications';

type ManuscriptItem = {
    id: number;
    title: string;
    authors: string[];
    status: string;
    user: { name: string; email: string };
    editor: { name: string } | null;
    difficulty: string | null;
    open_for_claim: boolean;
};

const statusLabels: Record<string, string> = {
    submitted: 'Menunggu Review Admin (Penulis)',
    revision_requested: 'Perlu Revisi Penulis',
    pending_coauthor_assignment: 'Menunggu Penugasan Co-author',
    in_coauthoring: 'Sedang Disusun Co-author',
    pending_admin_review_coauthor: 'Menunggu Review Admin (Co-author)',
    coauthor_revision_requested: 'Perlu Revisi Co-author',
    pending_author_review_coauthor:
        'Menunggu Persetujuan Penulis (Susunan Co-author)',
    pending_editor_assignment: 'Menunggu Penugasan Editor',
    in_editing: 'Sedang Diedit Editor',
    pending_admin_review_editor: 'Menunggu Review Admin (Editor)',
    editor_revision_requested: 'Perlu Revisi Editor',
    pending_penulis_review: 'Menunggu Review Penulis',
    completed: 'Selesai',
    ...CHAPTER_STATUS_LABELS,
};

export default function ManuscriptsPage() {
    const unreadManuscripts = useUnreadSubjects('manuscript');
    const [manuscripts, setManuscripts] = useState<ManuscriptItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [search, setSearch] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);

    // Pencarian, status & halaman dikerjakan server.
    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(() => {
            adminApi
                .listManuscripts({ search: search.trim(), status, page })
                .then((response) => {
                    if (cancelled) return;
                    setManuscripts(response.data);
                    setMeta(response.meta ?? null);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [search, status, page]);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Kelola Naskah
                    {meta && (
                        <span className="ml-2 font-sans text-sm font-normal text-oxford-navy-900/60">
                            ({meta.total})
                        </span>
                    )}
                </h5>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <SearchField
                        value={search}
                        onChange={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
                        placeholder="Cari judul atau pengirim"
                        ariaLabel="Cari naskah"
                        className="sm:w-72"
                    />
                    <div className="sm:w-64">
                        <Select
                            name="status_filter"
                            label="Status"
                            option_data={[
                                { value: '', label: 'Semua Status' },
                                ...Object.entries(statusLabels).map(
                                    ([value, label]) => ({ value, label })
                                ),
                            ]}
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada naskah.
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
                                    {manuscript.user.name} (
                                    {manuscript.user.email})
                                </p>
                                {manuscript.editor && (
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        Editor: {manuscript.editor.name}
                                    </p>
                                )}
                                {(manuscript.difficulty ||
                                    manuscript.open_for_claim) && (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <DifficultyBadge
                                            difficulty={manuscript.difficulty}
                                        />
                                        {manuscript.open_for_claim && (
                                            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-forest-moss-800 ring-1 ring-forest-moss-200">
                                                Di pool editor
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <span className="text-forest-moss-700 text-sm">
                                {statusLabels[manuscript.status] ??
                                    manuscript.status}
                            </span>
                        </Link>
                    ))}
                </div>
            )}

            <Pagination meta={meta} onPageChange={setPage} />
        </div>
    );
}
