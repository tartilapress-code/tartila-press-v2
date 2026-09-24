import { useEffect, useState } from 'react';
import {
    RiArrowUpDownLine,
    RiLayoutGridLine,
    RiRestartLine,
} from '@remixicon/react';
import * as bookChapterProjectApi from '@/data/bookChapterProject/bookChapterProjectApi';
import ChapterHowItWorks from '@/components/bookChapter/ChapterHowItWorks';
import ChapterProjectCard, {
    ChapterProjectCardSkeleton,
} from '@/components/bookChapter/ChapterProjectCard';
import { SearchField, SelectField } from '@/components/ui/FilterControls';
import ListHero from '@/components/ui/ListHero';
import QuoteCard from '@/components/ui/QuoteCard';
import SectionTitle from '@/components/ui/SectionTitle';
import {
    categoryNames,
    openPrice,
    summarizeSlots,
    type ChapterProject,
} from '@/lib/bookChapterPublic';

type SortMode = 'newest' | 'deadline' | 'price' | 'slots';

const SKELETON_COUNT = 6;

const sortOptions = [
    { value: 'newest', label: 'Terbaru' },
    { value: 'deadline', label: 'Deadline Terdekat' },
    { value: 'price', label: 'Harga Terendah' },
    { value: 'slots', label: 'Slot Terbanyak' },
];

// Urutan "terbaru" mengikuti urutan dari server; lainnya diurutkan di sini.
function sortProjects(projects: ChapterProject[], mode: SortMode) {
    if (mode === 'newest') {
        return projects;
    }

    const deadline = (p: ChapterProject) =>
        p.submission_deadline
            ? new Date(p.submission_deadline).getTime()
            : Infinity;
    const price = (p: ChapterProject) =>
        openPrice(p.chapters)?.from ?? Infinity;
    const openSlots = (p: ChapterProject) => summarizeSlots(p.chapters).open;

    return [...projects].sort((a, b) => {
        if (mode === 'deadline') return deadline(a) - deadline(b);
        if (mode === 'price') return price(a) - price(b);

        return openSlots(b) - openSlots(a);
    });
}

/**
 * Halaman daftar Book Chapter: hero, kartu "Cara Kerja", dan daftar proyek
 * yang masih punya slot bab terbuka lengkap dengan pencarian, kategori,
 * dan urutan.
 */
export default function BookChapterProjectListPage() {
    const [projects, setProjects] = useState<ChapterProject[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [query, setQuery] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [sort, setSort] = useState<SortMode>('newest');

    useEffect(() => {
        let cancelled = false;

        bookChapterProjectApi
            .list()
            .then((response) => {
                if (!cancelled) setProjects(response.data);
            })
            .catch(() => {
                if (!cancelled) setProjects([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const categories = [
        ...new Set(projects.flatMap((project) => categoryNames(project))),
    ].sort((a, b) => a.localeCompare(b, 'id'));

    const needle = query.trim().toLocaleLowerCase('id');
    const matched = projects.filter((project) => {
        const inCategory =
            category === '' || categoryNames(project).includes(category);
        const inText =
            needle === '' ||
            project.title.toLocaleLowerCase('id').includes(needle) ||
            (project.owner_editor?.name ?? '')
                .toLocaleLowerCase('id')
                .includes(needle);

        return inCategory && inText;
    });
    const visible = sortProjects(matched, sort);
    const hasFilters = query.trim() !== '' || category !== '';

    function resetFilters() {
        setQuery('');
        setCategory('');
    }

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ListHero
                badge="Book Chapter"
                title={{
                    before: 'Tulis ',
                    accent: 'Satu Bab',
                    after: ', Terbit Bersama.',
                }}
                text="Gabung jadi salah satu penulis di buku kolaborasi Tartila Press. Pilih proyek, beli slot bab yang masih terbuka, dan karyamu terbit bersama dalam satu buku."
                script={['Menulis Bersama,', 'Terbit Bersama']}
            />

            <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:px-10">
                <aside className="order-last lg:order-none">
                    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                        <ChapterHowItWorks />
                        <QuoteCard quote="Setiap suara punya tempat di dalam satu buku yang ditulis bersama." />
                    </div>
                </aside>

                <section
                    aria-labelledby="chapter-list-title"
                    className="flex min-w-0 flex-col gap-6 rounded-2xl border border-forest-moss-100 bg-white p-4 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-6"
                >
                    <div className="flex flex-col gap-4">
                        <SectionTitle id="chapter-list-title">
                            Proyek Terbuka
                            {!isLoading && projects.length > 0 && (
                                <span className="font-sans text-sm font-normal text-oxford-navy-900/50">
                                    {visible.length} proyek
                                </span>
                            )}
                        </SectionTitle>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_13rem_13rem]">
                            <SearchField
                                value={query}
                                onChange={setQuery}
                                placeholder="Cari judul proyek atau editor..."
                                ariaLabel="Cari judul proyek atau editor"
                                className="sm:col-span-2 xl:col-span-1"
                            />
                            <SelectField
                                value={category}
                                onChange={setCategory}
                                options={[
                                    { value: '', label: 'Semua Kategori' },
                                    ...categories.map((name) => ({
                                        value: name,
                                        label: name,
                                    })),
                                ]}
                                ariaLabel="Filter kategori"
                                icon={<RiLayoutGridLine />}
                            />
                            <SelectField
                                value={sort}
                                onChange={(value) => setSort(value as SortMode)}
                                options={sortOptions}
                                ariaLabel="Urutkan proyek"
                                icon={<RiArrowUpDownLine />}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: SKELETON_COUNT }).map(
                                (_, index) => (
                                    <ChapterProjectCardSkeleton key={index} />
                                )
                            )}
                        </div>
                    ) : projects.length === 0 ? (
                        <p className="rounded-xl bg-forest-moss-50 px-6 py-14 text-center text-sm text-oxford-navy-900/65">
                            Belum ada proyek Book Chapter yang terbuka saat ini.
                        </p>
                    ) : visible.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl bg-forest-moss-50 px-6 py-14 text-center">
                            <p className="text-sm text-oxford-navy-900/70">
                                Tidak ada proyek yang cocok dengan pencarian
                                ini.
                            </p>
                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-lg border border-oxford-navy-700 px-4 py-2 text-sm font-semibold text-oxford-navy-700 transition-colors hover:cursor-pointer hover:bg-oxford-navy-700 hover:text-white"
                                >
                                    <RiRestartLine
                                        aria-hidden
                                        className="size-4"
                                    />
                                    Reset Filter
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {visible.map((project) => (
                                <ChapterProjectCard
                                    key={project.id}
                                    project={project}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
