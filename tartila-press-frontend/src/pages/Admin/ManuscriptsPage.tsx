import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminApi from '@/data/admin/adminApi';

type ManuscriptItem = {
    id: number;
    title: string;
    authors: string[];
    status: string;
    user: { name: string; email: string };
    editor: { name: string } | null;
};

const statusLabels: Record<string, string> = {
    submitted: 'Menunggu Review Admin (Penulis)',
    revision_requested: 'Perlu Revisi Penulis',
    pending_editor_assignment: 'Menunggu Penugasan Editor',
    in_editing: 'Sedang Diedit Editor',
    pending_admin_review_editor: 'Menunggu Review Admin (Editor)',
    editor_revision_requested: 'Perlu Revisi Editor',
    pending_penulis_review: 'Menunggu Review Penulis',
    completed: 'Selesai',
};

export default function ManuscriptsPage() {
    const [manuscripts, setManuscripts] = useState<ManuscriptItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        adminApi
            .listManuscripts()
            .then((response) => setManuscripts(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Kelola Naskah
            </h5>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">Belum ada naskah.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {manuscripts.map((manuscript) => (
                        <Link
                            key={manuscript.id}
                            to={`/dashboard/naskah/${manuscript.id}`}
                            className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4 hover:bg-forest-moss-50"
                        >
                            <div>
                                <p className="text-oxford-navy-900 font-semibold">
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
