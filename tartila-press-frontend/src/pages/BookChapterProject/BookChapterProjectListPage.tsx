import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as bookChapterProjectApi from '@/data/bookChapterProject/bookChapterProjectApi';

type Category = { id: number; name: string };

type ChapterSlot = {
    id: number;
    manuscript_id: number | null;
    order_id: number | null;
};

type ProjectSummary = {
    id: number;
    title: string;
    front_cover: string | null;
    estimated_publish_date: string | null;
    submission_deadline: string | null;
    category: Category | null;
    field_category: Category | null;
    owner_editor: { id: number; name: string } | null;
    chapters: ChapterSlot[];
};

const monthYearFormatter = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
});

function formatMonthYear(date: string | null): string | null {
    if (!date) return null;
    return monthYearFormatter.format(new Date(date));
}

function openSlotCount(chapters: ChapterSlot[]): number {
    return chapters.filter((c) => !c.manuscript_id && !c.order_id).length;
}

export default function BookChapterProjectListPage() {
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        bookChapterProjectApi
            .list()
            .then((response) => setProjects(response.data))
            .catch(() => setProjects([]))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-6 my-10">
            <div className="flex flex-col gap-2 text-center">
                <h1 className="text-oxford-navy-900 text-3xl font-bold">
                    Book Chapter
                </h1>
                <p className="text-oxford-navy-900/70">
                    Gabung jadi salah satu penulis di buku kolaborasi
                    Tartila Press — pilih bab yang masih terbuka.
                </p>
            </div>

            {isLoading ? (
                <p className="text-oxford-navy-900 text-center">Memuat...</p>
            ) : projects.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-center">
                    Belum ada proyek Book Chapter yang terbuka saat ini.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Link
                            key={project.id}
                            to={`/buku-bab/${project.id}`}
                            className="
                            flex flex-col gap-3 rounded-xl border border-forest-moss-400 overflow-hidden
                            bg-oxford-navy-900 hover:-translate-y-1 duration-200
                            "
                        >
                            <div className="h-48 w-full bg-oxford-navy-700">
                                {project.front_cover ? (
                                    <img
                                        src={project.front_cover}
                                        alt={project.title}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-white/40 text-sm">
                                        Tanpa Sampul
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-1 p-4 pt-0">
                                {(project.category || project.field_category) && (
                                    <p className="text-forest-moss-300 text-xs">
                                        {[
                                            project.category?.name,
                                            project.field_category?.name,
                                        ]
                                            .filter(Boolean)
                                            .join(' • ')}
                                    </p>
                                )}
                                <h5 className="text-white font-semibold line-clamp-2">
                                    {project.title}
                                </h5>

                                {formatMonthYear(
                                    project.estimated_publish_date
                                ) && (
                                    <p className="text-white/60 text-sm">
                                        Perkiraan terbit:{' '}
                                        {formatMonthYear(
                                            project.estimated_publish_date
                                        )}
                                    </p>
                                )}

                                {project.submission_deadline && (
                                    <p className="text-white/60 text-sm">
                                        Batas naskah:{' '}
                                        {new Date(
                                            project.submission_deadline
                                        ).toLocaleDateString('id-ID')}
                                    </p>
                                )}

                                {project.owner_editor && (
                                    <p className="text-white/60 text-sm">
                                        Editor: {project.owner_editor.name}
                                    </p>
                                )}

                                <p className="text-forest-moss-300 text-sm font-semibold mt-1">
                                    {openSlotCount(project.chapters)} slot bab
                                    terbuka
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
