import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    RiArrowRightSLine,
    RiBookOpenLine,
    RiEditBoxLine,
    RiFileTextLine,
    RiUserLine,
} from '@remixicon/react';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { toContentLanguages } from '@/lib/contentLanguages';
import * as publicProfileApi from '@/data/publicProfile/publicProfileApi';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import ProfileBookCard, {
    type ProfileBookDetail,
} from '@/components/people/ProfileBookCard';
import ProfileHero from '@/components/people/ProfileHero';
import type { PeopleRole } from '@/components/people/roles';
import QuoteCard from '@/components/ui/QuoteCard';
import SectionTitle from '@/components/ui/SectionTitle';
import SideNavCard, { type SideNavItem } from '@/components/ui/SideNavCard';

type Experience = {
    id: number;
    title: string;
    description: string | null;
    year: number | null;
};

type AuthorProfile = {
    slug: string;
    name: string;
    bio: string | null;
    city: string | null;
    profile_photo: string | null;
    roles: string[];
    // Bahasa yang dikuasai; hanya terisi untuk akun editor.
    editor_languages: string[];
    experiences: Experience[];
    books: ProfileBookDetail[];
    edited_books: ProfileBookDetail[];
};

type BookSectionKey = 'karya' | 'diedit';
type SectionKey = 'profil' | BookSectionKey | 'pengalaman';

// Jumlah buku yang tampil sebelum "Lihat Semua".
const BOOK_PREVIEW_COUNT = 6;
const MAX_TOPICS = 8;

// Bidang & jenis karya, diambil dari kategori buku-bukunya (tanpa duplikat).
function collectTopics(books: ProfileBookDetail[]): string[] {
    const names = [
        ...books.map((book) => book.field_category?.name),
        ...books.map((book) => book.category?.name),
    ].filter((name): name is string => Boolean(name));

    return [...new Set(names)].slice(0, MAX_TOPICS);
}

function scrollToSection(id: SectionKey) {
    document
        .getElementById(id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function BooksSection({
    id,
    title,
    books,
    emptyText,
}: {
    id: SectionKey;
    title: string;
    books: ProfileBookDetail[];
    emptyText: string;
}) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<boolean>(false);
    const shown = expanded ? books : books.slice(0, BOOK_PREVIEW_COUNT);
    const canExpand = books.length > BOOK_PREVIEW_COUNT;

    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="flex scroll-mt-28 flex-col gap-4"
        >
            <SectionTitle
                id={`${id}-title`}
                action={
                    canExpand && (
                        <button
                            type="button"
                            onClick={() => setExpanded((value) => !value)}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-forest-moss-700 hover:cursor-pointer hover:text-forest-moss-600"
                        >
                            {expanded
                                ? t('people.profile.collapse')
                                : t('people.profile.seeAll', {
                                      count: books.length,
                                  })}
                            <RiArrowRightSLine
                                aria-hidden
                                className={`size-4 transition-transform ${
                                    expanded ? '-rotate-90' : ''
                                }`}
                            />
                        </button>
                    )
                }
            >
                {title}
            </SectionTitle>

            {books.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/55">{emptyText}</p>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((book) => (
                        <ProfileBookCard key={book.id} book={book} />
                    ))}
                </div>
            )}
        </section>
    );
}

function ProfileSkeleton() {
    return (
        <div className="-mx-10 -my-2 animate-pulse" aria-hidden>
            <div className="bg-forest-moss-50/60">
                <div className="mx-auto flex max-w-[1232px] flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:px-10 lg:pl-20">
                    <div className="size-40 rounded-full bg-oxford-navy-100/60" />
                    <div className="flex flex-col items-center gap-3 sm:items-start">
                        <div className="h-7 w-24 rounded-full bg-oxford-navy-100/60" />
                        <div className="h-10 w-64 rounded bg-oxford-navy-100/60" />
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

export default function AuthorProfilePage() {
    const { t } = useTranslation();
    const { slug } = useParams<{ slug: string }>();
    const { pathname } = useLocation();
    // Halaman ini dipakai bersama oleh /penulis/:slug dan /editor/:slug.
    const role: PeopleRole = pathname.startsWith('/editor')
        ? 'editor'
        : 'penulis';

    const [profile, setProfile] = useState<AuthorProfile | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        Promise.resolve()
            .then(() => {
                setIsLoading(true);
                setNotFound(false);

                if (!slug) {
                    throw new ApiError('Slug tidak ditemukan.', 404);
                }
                return publicProfileApi.getBySlug(slug);
            })
            .then((response) => {
                if (!cancelled) setProfile(response.data.profile);
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
    }, [slug]);

    // Seksi yang ada bergantung pada peran & data; urutan buku mengikuti
    // halaman asal (penulis: karya dulu, editor: buku diedit dulu).
    const isPenulis = profile?.roles.includes('Penulis') ?? false;
    const isEditor = profile?.roles.includes('Editor') ?? false;
    const hasBooks = (profile?.books.length ?? 0) > 0;
    const hasEdited = (profile?.edited_books.length ?? 0) > 0;
    const showKarya = isPenulis || hasBooks || (!isEditor && !hasEdited);
    const showDiedit = isEditor || hasEdited;

    const sectionKeys: SectionKey[] = ['profil'];
    const bookKeys: BookSectionKey[] = [];
    if (showKarya) bookKeys.push('karya');
    if (showDiedit) bookKeys.push('diedit');
    if (role === 'editor') bookKeys.reverse();
    sectionKeys.push(...bookKeys, 'pengalaman');

    const activeKey = useScrollSpy(sectionKeys);

    if (isLoading) {
        return <ProfileSkeleton />;
    }

    if (notFound || !profile) {
        return <ErrorPage />;
    }

    const navMeta: Record<SectionKey, { label: string; icon: ReactNode }> = {
        profil: { label: t('people.profile.nav.profil'), icon: <RiUserLine /> },
        karya: {
            label: t('people.profile.nav.karya'),
            icon: <RiBookOpenLine />,
        },
        diedit: {
            label: t('people.profile.nav.diedit'),
            icon: <RiEditBoxLine />,
        },
        pengalaman: {
            label: t('people.profile.nav.pengalaman'),
            icon: <RiFileTextLine />,
        },
    };

    const navItems: SideNavItem[] = sectionKeys.map((key) => ({
        key,
        label: navMeta[key].label,
        icon: navMeta[key].icon,
        active: activeKey === key,
        onSelect: () => scrollToSection(key),
    }));

    const topics = collectTopics([...profile.books, ...profile.edited_books]);

    const bookSections: Record<BookSectionKey, ReactNode> = {
        karya: (
            <BooksSection
                key="karya"
                id="karya"
                title={t('people.profile.worksTitle')}
                books={profile.books}
                emptyText={t('people.profile.worksEmpty')}
            />
        ),
        diedit: (
            <BooksSection
                key="diedit"
                id="diedit"
                title={t('people.profile.editedTitle')}
                books={profile.edited_books}
                emptyText={t('people.profile.editedEmpty')}
            />
        ),
    };

    return (
        <div className="-mx-10 -my-2 overflow-x-clip">
            <ProfileHero
                role={role}
                profile={{
                    name: profile.name,
                    photo: profile.profile_photo,
                    roles: profile.roles,
                    city: profile.city,
                    bookCount: profile.books.length,
                    editedCount: profile.edited_books.length,
                    languages: toContentLanguages(profile.editor_languages),
                }}
            />

            <div className="mx-auto max-w-[1232px] px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-10">
                <aside className="mb-6 lg:mb-0">
                    <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                        <SideNavCard
                            items={navItems}
                            ariaLabel={t('people.profile.navAria')}
                        />
                        <QuoteCard quote={t(`people.${role}.profileQuote`)} />
                    </div>
                </aside>

                <div className="flex min-w-0 flex-col gap-8 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-7">
                    <section
                        id="profil"
                        aria-labelledby="profil-title"
                        className="flex scroll-mt-28 flex-col gap-4"
                    >
                        <SectionTitle id="profil-title">
                            {t(`people.${role}.aboutTitle`)}
                        </SectionTitle>

                        {profile.bio ? (
                            <p className="whitespace-pre-line text-base leading-relaxed text-oxford-navy-900/70">
                                {profile.bio}
                            </p>
                        ) : (
                            <p className="text-sm text-oxford-navy-900/55">
                                {t('people.profile.noBio', {
                                    name: profile.name,
                                })}
                            </p>
                        )}

                        {topics.length > 0 && (
                            <ul
                                aria-label={t('people.profile.topicsAria')}
                                className="flex flex-wrap gap-2 border-t border-forest-moss-100 pt-4"
                            >
                                {topics.map((topic) => (
                                    <li
                                        key={topic}
                                        className="rounded-full bg-forest-moss-100 px-3.5 py-1.5 text-sm text-forest-moss-800"
                                    >
                                        {topic}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {bookKeys.map((key) => (
                        <div
                            key={key}
                            className="border-t border-forest-moss-100 pt-8"
                        >
                            {bookSections[key]}
                        </div>
                    ))}

                    <section
                        id="pengalaman"
                        aria-labelledby="pengalaman-title"
                        className="flex scroll-mt-28 flex-col gap-4 border-t border-forest-moss-100 pt-8"
                    >
                        <SectionTitle id="pengalaman-title">
                            {t('people.profile.experienceTitle')}
                        </SectionTitle>

                        {profile.experiences.length === 0 ? (
                            <p className="text-sm text-oxford-navy-900/55">
                                {t('people.profile.experienceEmpty')}
                            </p>
                        ) : (
                            <ol className="flex flex-col gap-5 border-l-2 border-forest-moss-200 pl-6">
                                {profile.experiences.map((experience) => (
                                    <li
                                        key={experience.id}
                                        className="relative"
                                    >
                                        <span
                                            aria-hidden
                                            className="absolute -left-[33px] top-1.5 size-3 rounded-full border-2 border-white bg-forest-moss-500 ring-2 ring-forest-moss-200"
                                        />
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <h3 className="font-semibold text-oxford-navy-700">
                                                {experience.title}
                                            </h3>
                                            {experience.year && (
                                                <span className="rounded-full bg-forest-moss-100 px-2.5 py-0.5 text-xs font-medium text-forest-moss-800">
                                                    {experience.year}
                                                </span>
                                            )}
                                        </div>
                                        {experience.description && (
                                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-oxford-navy-900/65">
                                                {experience.description}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
