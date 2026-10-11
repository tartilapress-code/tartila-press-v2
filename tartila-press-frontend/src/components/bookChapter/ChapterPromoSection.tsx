import { useEffect, useState } from 'react';
import PromoteProjectButton from '@/components/bookChapter/PromoteProjectButton';
import Pagination from '@/components/ui/Pagination';
import * as adminApi from '@/data/admin/adminApi';
import type { PageMeta } from '@/lib/pagination';

type ProjectRow = {
    id: number;
    title: string;
    is_active: boolean;
    field_category: { name: string } | null;
    chapters: { manuscript_id: number | null; order_id: number | null }[];
};

const isOpen = (chapter: ProjectRow['chapters'][number]) =>
    chapter.manuscript_id === null && chapter.order_id === null;

/**
 * Konten Sosmed › Promosi Book Chapter: admin mencari judul proyek lalu
 * mengunduh gambar promosi (bidang, judul, judul bab, jumlah slot). Gambar
 * dibuat dari data terbaru setiap kali tombol diklik.
 */
export default function ChapterPromoSection({
    className = '',
}: {
    className?: string;
}) {
    const [query, setQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [meta, setMeta] = useState<PageMeta | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        const timeout = setTimeout(() => {
            setIsLoading(true);
            adminApi
                .listBookChapterProjectsAdmin({
                    search: query.trim(),
                    page,
                    per_page: 8,
                })
                .then((response) => {
                    if (cancelled) return;
                    setProjects(response.data);
                    setMeta(response.meta ?? null);
                })
                .catch(() => {
                    if (!cancelled) setProjects([]);
                })
                .finally(() => {
                    if (!cancelled) setIsLoading(false);
                });
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [query, page]);

    return (
        <section
            aria-labelledby="chapter-promo-title"
            className={`flex flex-col gap-4 rounded-2xl bg-white p-6 ring-1 ring-forest-moss-100 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ${className}`}
        >
            <div className="flex flex-col gap-1">
                <h5
                    id="chapter-promo-title"
                    className="font-display text-lg font-bold text-oxford-navy-700"
                >
                    Promosi Book Chapter
                </h5>
                <p className="text-sm text-oxford-navy-900/70">
                    Cari judul proyek, lalu klik tombolnya: gambar (bidang,
                    judul, judul bab, dan jumlah slot) dibuat dari data terbaru
                    dan langsung diunduh. Jika slot berubah, klik lagi untuk
                    gambar yang baru.
                </p>
            </div>

            <input
                type="search"
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                }}
                placeholder="Cari judul proyek Book Chapter..."
                aria-label="Cari judul proyek Book Chapter"
                className="rounded-lg border border-oxford-navy-900/15 bg-white p-2.5 text-sm text-oxford-navy-900 outline-none focus:border-forest-moss-500"
            />

            {isLoading ? (
                <p className="text-sm text-oxford-navy-900/70">Memuat...</p>
            ) : projects.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/60">
                    Tidak ada proyek Book Chapter yang cocok.
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {projects.map((project) => {
                        const open = project.chapters.filter(isOpen).length;

                        return (
                            <li
                                key={project.id}
                                className="flex flex-col gap-3 rounded-lg bg-forest-moss-50 p-3 ring-1 ring-forest-moss-100 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold text-oxford-navy-900">
                                        {project.title}
                                        {!project.is_active && (
                                            <span className="ml-1 text-xs font-normal text-oxford-navy-900/55">
                                                (belum publish)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-sm text-oxford-navy-900/65">
                                        {project.field_category?.name ??
                                            'Tanpa bidang'}{' '}
                                        · {open} dari {project.chapters.length}{' '}
                                        slot tersedia
                                    </p>
                                </div>
                                <PromoteProjectButton
                                    withEditor={false}
                                    load={() =>
                                        adminApi.bookChapterProjectPromo(
                                            project.id
                                        )
                                    }
                                    className="sm:items-end sm:text-right"
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            <Pagination meta={meta} onPageChange={setPage} />
        </section>
    );
}
