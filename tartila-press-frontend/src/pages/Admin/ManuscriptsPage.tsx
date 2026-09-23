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
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <h5 className="text-white text-xl font-semibold">
                Kelola Naskah
            </h5>

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
            ) : manuscripts.length === 0 ? (
                <p className="text-white/70 text-sm">Belum ada naskah.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {manuscripts.map((manuscript) => (
                        <Link
                            key={manuscript.id}
                            to={`/dashboard/naskah/${manuscript.id}`}
                            className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4 hover:bg-oxford-navy-900/60"
                        >
                            <div>
                                <p className="text-white font-semibold">
                                    {manuscript.title}
                                </p>
                                <p className="text-white/60 text-sm">
                                    {manuscript.user.name} (
                                    {manuscript.user.email})
                                </p>
                                {manuscript.editor && (
                                    <p className="text-white/60 text-sm">
                                        Editor: {manuscript.editor.name}
                                    </p>
                                )}
                            </div>
                            <span className="text-forest-moss-300 text-sm">
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
