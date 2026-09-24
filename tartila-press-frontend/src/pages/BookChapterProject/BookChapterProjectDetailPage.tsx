import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    RiCheckboxCircleFill,
    RiGiftLine,
    RiInformationLine,
    RiListOrdered,
    RiLockLine,
} from '@remixicon/react';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import * as bookChapterProjectApi from '@/data/bookChapterProject/bookChapterProjectApi';
import ChapterHowItWorks from '@/components/bookChapter/ChapterHowItWorks';
import ChapterProjectHero from '@/components/bookChapter/ChapterProjectHero';
import ChapterSlotRow from '@/components/bookChapter/ChapterSlotRow';
import SectionTitle from '@/components/ui/SectionTitle';
import SideNavCard, { type SideNavItem } from '@/components/ui/SideNavCard';
import {
    isPast,
    summarizeSlots,
    type ChapterProject,
} from '@/lib/bookChapterPublic';

type SectionKey = 'tentang' | 'fasilitas' | 'bab';

function scrollToSection(id: SectionKey) {
    document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Daftar centang untuk layanan/fasilitas yang termasuk dalam paket.
function IncludedList({ title, items }: { title: string; items: string[] }) {
    return (
        <div>
            <h3 className="mb-2.5 text-sm font-semibold text-oxford-navy-700">
                {title}
            </h3>
            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-oxford-navy-900/75"
                    >
                        <RiCheckboxCircleFill
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0 text-forest-moss-600"
                        />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function DetailSkeleton() {
    return (
        <div className="-mx-10 -my-2 animate-pulse" aria-hidden>
            <div className="bg-forest-moss-50/60">
                <div className="mx-auto flex max-w-[1232px] flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:px-10 lg:pl-16">
                    <div className="aspect-[148/210] w-44 rounded bg-oxford-navy-100/60" />
                    <div className="flex flex-col items-center gap-3 sm:items-start">
                        <div className="h-7 w-32 rounded-full bg-oxford-navy-100/60" />
                        <div className="h-10 w-72 rounded bg-oxford-navy-100/60" />
                        <div className="h-4 w-56 rounded bg-oxford-navy-100/60" />
                    </div>
                </div>
            </div>
            <div className="mx-auto max-w-[1232px] px-4 py-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-10">
                <div className="mb-6 h-40 rounded-2xl bg-oxford-navy-100/40 lg:mb-0" />
                <div className="h-96 rounded-2xl bg-oxford-navy-100/40" />
            </div>
        </div>
    );
}

export default function BookChapterProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [project, setProject] = useState<ChapterProject | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        Promise.resolve()
            .then(() => {
                setIsLoading(true);
                setNotFound(false);

                return bookChapterProjectApi.get(id ?? '');
            })
            .then((response) => {
                if (!cancelled) setProject(response.data);
            })
            .catch((error) => {
                if (cancelled) return;

                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    // Yang didapat penulis: HKI/ISBN + layanan & fasilitas yang dicentang.
    // Proyek lama yang belum dicentang memakai daftar teks bebasnya.
    const checkedServices = [
        ...(project?.includes_hki ? ['HKI'] : []),
        ...(project?.includes_isbn_print ? ['ISBN Cetak'] : []),
        ...(project?.includes_isbn_electronic ? ['e-ISBN'] : []),
        ...(project?.package_services ?? []),
    ];
    const checkedFacilities = project?.package_facilities ?? [];
    const hasChecked =
        checkedServices.length > 0 || checkedFacilities.length > 0;
    const includedServices = hasChecked
        ? checkedServices
        : (project?.services ?? []);
    const includedFacilities = hasChecked
        ? checkedFacilities
        : (project?.facilities ?? []);
    const hasIncluded =
        includedServices.length > 0 || includedFacilities.length > 0;

    // Deskripsi hanya dikirim server untuk pengunjung yang sudah login.
    const hasAbout = Boolean(project?.about || project?.description);
    const showTentang = hasAbout || !isAuthenticated;

    const sectionKeys: SectionKey[] = [];
    if (showTentang) sectionKeys.push('tentang');
    if (hasIncluded) sectionKeys.push('fasilitas');
    sectionKeys.push('bab');

    const activeKey = useScrollSpy(sectionKeys);

    if (isLoading) {
        return <DetailSkeleton />;
    }

    if (notFound || !project) {
        return <ErrorPage />;
    }

    const deadlinePassed = isPast(project.submission_deadline);
    const { total, open } = summarizeSlots(project.chapters);

    function handleBuySlot(chapterId: number) {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        navigate(`/dashboard/beli-slot-bab/${project!.id}/${chapterId}`);
    }

    const navMeta: Record<SectionKey, { label: string; icon: ReactNode }> = {
        tentang: { label: 'Tentang', icon: <RiInformationLine /> },
        fasilitas: { label: 'Yang Didapat', icon: <RiGiftLine /> },
        bab: { label: 'Daftar Bab', icon: <RiListOrdered /> },
    };

    const navItems: SideNavItem[] = sectionKeys.map((key) => ({
        key,
        label: navMeta[key].label,
        icon: navMeta[key].icon,
        active: activeKey === key,
        onSelect: () => scrollToSection(key),
    }));

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ChapterProjectHero
                project={project}
                deadlinePassed={deadlinePassed}
                onPickChapter={() => scrollToSection('bab')}
            />

            <div className="mx-auto max-w-[1232px] px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-10">
                <aside className="mb-6 lg:mb-0">
                    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                        <SideNavCard
                            items={navItems}
                            ariaLabel="Navigasi proyek"
                        />
                        <ChapterHowItWorks className="hidden lg:block" />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-col gap-8 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-7">
                    {showTentang && (
                        <section
                            id="tentang"
                            aria-labelledby="tentang-title"
                            className="flex scroll-mt-28 flex-col gap-4"
                        >
                            <SectionTitle id="tentang-title">
                                Tentang Proyek
                            </SectionTitle>

                            {!isAuthenticated && (
                                <div className="flex flex-col gap-3 rounded-xl bg-forest-moss-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="flex items-start gap-2 text-sm text-oxford-navy-900/75">
                                        <RiLockLine
                                            aria-hidden
                                            className="mt-0.5 size-4 shrink-0 text-forest-moss-700"
                                        />
                                        Masuk untuk melihat deskripsi lengkap
                                        proyek dan SOP tiap bab.
                                    </p>
                                    <Link
                                        to="/login"
                                        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-oxford-navy-600"
                                    >
                                        Masuk
                                    </Link>
                                </div>
                            )}

                            {project.about && (
                                <p className="whitespace-pre-line text-base leading-relaxed text-oxford-navy-900/70">
                                    {project.about}
                                </p>
                            )}
                            {project.description && (
                                <p className="whitespace-pre-line text-base leading-relaxed text-oxford-navy-900/70">
                                    {project.description}
                                </p>
                            )}
                        </section>
                    )}

                    {hasIncluded && (
                        <section
                            id="fasilitas"
                            aria-labelledby="fasilitas-title"
                            className={`flex scroll-mt-28 flex-col gap-4 ${
                                showTentang
                                    ? 'border-t border-forest-moss-100 pt-8'
                                    : ''
                            }`}
                        >
                            <SectionTitle id="fasilitas-title">
                                Yang Anda Dapatkan
                            </SectionTitle>
                            <div className="grid gap-6 sm:grid-cols-2">
                                {includedServices.length > 0 && (
                                    <IncludedList
                                        title="Layanan"
                                        items={includedServices}
                                    />
                                )}
                                {includedFacilities.length > 0 && (
                                    <IncludedList
                                        title="Fasilitas"
                                        items={includedFacilities}
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    <section
                        id="bab"
                        aria-labelledby="bab-title"
                        className={`flex scroll-mt-28 flex-col gap-4 ${
                            showTentang || hasIncluded
                                ? 'border-t border-forest-moss-100 pt-8'
                                : ''
                        }`}
                    >
                        <SectionTitle
                            id="bab-title"
                            action={
                                <span className="shrink-0 text-sm text-oxford-navy-900/55">
                                    {open} dari {total} slot terbuka
                                </span>
                            }
                        >
                            Daftar Bab
                        </SectionTitle>

                        {deadlinePassed && (
                            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                                Pembelian slot ditutup karena batas pengumpulan
                                naskah sudah lewat.
                            </p>
                        )}

                        {project.chapters.length === 0 ? (
                            <p className="text-sm text-oxford-navy-900/55">
                                Belum ada bab pada proyek ini.
                            </p>
                        ) : (
                            <ol className="flex flex-col gap-3">
                                {project.chapters.map((chapter) => (
                                    <ChapterSlotRow
                                        key={chapter.id}
                                        chapter={chapter}
                                        canBuy={
                                            chapter.slot_status === 'open' &&
                                            !deadlinePassed
                                        }
                                        showSop={isAuthenticated}
                                        onBuy={() => handleBuySlot(chapter.id)}
                                    />
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
