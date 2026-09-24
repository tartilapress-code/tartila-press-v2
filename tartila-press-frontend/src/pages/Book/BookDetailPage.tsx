import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    RiChat1Line,
    RiFileList3Line,
    RiInformationLine,
    RiListOrdered,
} from '@remixicon/react';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { scrollToSection } from '@/lib/scroll';
import { useCart } from '@/context/useCart';
import { useScrollSpy } from '@/hooks/useScrollSpy';
import * as bookApi from '@/data/book/bookApi';
import { stablePreviewPdfUrl, type BookDetail } from '@/data/book/bookApi';
import CartFab from '@/components/cart/CartFab';
import BookAuthors from '@/components/book/detail/BookAuthors';
import BookChapterRow from '@/components/book/detail/BookChapterRow';
import BookDetailHero from '@/components/book/detail/BookDetailHero';
import BookFacts, { type BookFact } from '@/components/book/detail/BookFacts';
import BookHowToBuy from '@/components/book/detail/BookHowToBuy';
import BookReviews from '@/components/book/detail/BookReviews';
import PersonLink from '@/components/book/detail/PersonLink';
import SectionTitle from '@/components/ui/SectionTitle';
import SideNavCard, { type SideNavItem } from '@/components/ui/SideNavCard';
import { formatDate } from '@/lib/bookChapterPublic';
import { averageRating, hasAuthors } from '@/lib/bookDetail';

type SectionKey = 'tentang' | 'detail' | 'bab' | 'ulasan';

const sectionMeta: Record<SectionKey, { title: string; icon: ReactNode }> = {
    tentang: { title: 'Tentang Buku', icon: <RiInformationLine /> },
    detail: { title: 'Detail Buku', icon: <RiFileList3Line /> },
    bab: { title: 'Daftar Bab', icon: <RiListOrdered /> },
    ulasan: { title: 'Ulasan', icon: <RiChat1Line /> },
};

// Rincian buku yang terisi, urut seperti lembar spesifikasi.
function buildFacts(book: BookDetail): BookFact[] {
    const facts: BookFact[] = [];
    const published = formatDate(book.citation_publication_date);

    if (hasAuthors(book)) {
        facts.push({ label: 'Penulis', value: <BookAuthors book={book} /> });
    }
    if (book.editor_profile) {
        facts.push({
            label: 'Editor',
            value: <PersonLink person={book.editor_profile} role="editor" />,
        });
    }
    if (book.isbn) {
        facts.push({ label: 'ISBN', value: book.isbn });
    }
    if (book.citation_publisher) {
        facts.push({ label: 'Penerbit', value: book.citation_publisher });
    }
    if (published) {
        facts.push({ label: 'Tanggal Terbit', value: published });
    }
    if (book.category) {
        facts.push({ label: 'Kategori Buku', value: book.category.name });
    }
    if (book.field_category) {
        facts.push({
            label: 'Kategori Keilmuan',
            value: book.field_category.name,
        });
    }
    if (book.cover_layout_designer) {
        facts.push({
            label: 'Desain Sampul & Tata Letak',
            value: book.cover_layout_designer,
        });
    }
    if (book.is_chapter_compilation && book.chapters.length > 0) {
        facts.push({
            label: 'Jumlah Bab',
            value: `${book.chapters.length} bab`,
        });
    }

    return facts;
}

// Satu seksi isi; seksi setelah yang pertama diberi garis pemisah di atasnya.
function Section({
    id,
    isFirst,
    action,
    children,
}: {
    id: SectionKey;
    isFirst: boolean;
    action?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className={`flex scroll-mt-28 flex-col gap-4 ${
                isFirst ? '' : 'border-t border-forest-moss-100 pt-8'
            }`}
        >
            <SectionTitle id={`${id}-title`} action={action}>
                {sectionMeta[id].title}
            </SectionTitle>
            {children}
        </section>
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

export default function BookDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart, isInCart } = useCart();

    const [book, setBook] = useState<BookDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;

        Promise.resolve()
            .then(() => {
                setIsLoading(true);
                setNotFound(false);

                return bookApi.get(id ?? '');
            })
            .then((response) => {
                if (!cancelled) setBook(response.data);
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

    // Judul tab mengikuti buku yang sedang dibuka.
    const bookTitle = book?.title;

    useEffect(() => {
        if (!bookTitle) {
            return;
        }

        const previousTitle = document.title;
        document.title = `${bookTitle} — Tartila Press`;

        return () => {
            document.title = previousTitle;
        };
    }, [bookTitle]);

    // Meta tag sitasi (citation_*) untuk buku yang sedang dibuka, dibaca mis.
    // oleh Zotero. Untuk robot pencari (Google Scholar) versi yang berlaku ada
    // di halaman abstrak dari server (/api/abstrak/{slug}), karena tag yang
    // ditambahkan JavaScript belum tentu terbaca.
    useEffect(() => {
        if (!book) {
            return;
        }

        const tags: HTMLMetaElement[] = [];

        function addTag(name: string, content: string) {
            const tag = document.createElement('meta');
            tag.name = name;
            tag.content = content;
            document.head.appendChild(tag);
            tags.push(tag);
        }

        addTag('citation_title', book.title);
        // Nama penulis sudah dibersihkan server (gelar dibuang, nama ganda
        // disatukan); `??` menjaga bila API yang lebih lama belum mengirimnya.
        (book.citation_authors ?? []).forEach((author) =>
            addTag('citation_author', author)
        );
        if (book.citation_publisher) {
            addTag('citation_publisher', book.citation_publisher);
        }
        if (book.citation_publication_date) {
            // Google Scholar expects YYYY/MM/DD, not the full ISO datetime the API returns.
            addTag(
                'citation_publication_date',
                book.citation_publication_date.slice(0, 10).replace(/-/g, '/')
            );
        }
        if (book.isbn) {
            addTag('citation_isbn', book.isbn);
        }
        if (book.preview_url) {
            // Alamat stabil: tetap valid saat file preview diganti.
            addTag('citation_pdf_url', stablePreviewPdfUrl(book.slug));
        }

        return () => {
            tags.forEach((tag) => document.head.removeChild(tag));
        };
    }, [book]);

    const facts = book ? buildFacts(book) : [];
    const isCompilation = Boolean(
        book?.is_chapter_compilation && book.chapters.length > 0
    );

    const sectionKeys: SectionKey[] = [];
    if (book?.description) sectionKeys.push('tentang');
    if (facts.length > 0) sectionKeys.push('detail');
    if (isCompilation) sectionKeys.push('bab');
    sectionKeys.push('ulasan');

    const activeKey = useScrollSpy(sectionKeys);

    if (isLoading) {
        return <DetailSkeleton />;
    }

    if (notFound || !book) {
        return <ErrorPage />;
    }

    // Memuat ulang buku (mis. setelah ulasan tersimpan) tanpa layar muat.
    async function refreshBook() {
        const response = await bookApi.get(id ?? '');
        setBook(response.data);
    }

    const navItems: SideNavItem[] = sectionKeys.map((key) => ({
        key,
        label: sectionMeta[key].title,
        icon: sectionMeta[key].icon,
        active: activeKey === key,
        onSelect: () => scrollToSection(key),
    }));

    return (
        <>
            <CartFab />

            <div className="-mx-10 -my-2 overflow-x-clip">
                <BookDetailHero
                    book={book}
                    inCart={isInCart(book.id)}
                    onBuy={() => navigate(`/dashboard/beli-buku/${book.slug}`)}
                    onAddToCart={() => addToCart(book.id)}
                    onSeeReviews={() => scrollToSection('ulasan')}
                />

                <div className="mx-auto max-w-[1232px] px-4 pb-20 pt-8 sm:px-8 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 lg:px-10">
                    <aside className="mb-6 lg:mb-0">
                        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
                            <SideNavCard
                                items={navItems}
                                ariaLabel="Navigasi buku"
                            />
                            <BookHowToBuy className="hidden lg:block" />
                        </div>
                    </aside>

                    <div className="flex min-w-0 flex-col gap-8 rounded-2xl border border-forest-moss-100 bg-white p-5 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-7">
                        {sectionKeys.map((key, index) => (
                            <Section
                                key={key}
                                id={key}
                                isFirst={index === 0}
                                action={
                                    key === 'bab' ? (
                                        <span className="shrink-0 text-sm text-oxford-navy-900/55">
                                            {book.chapters.length} bab
                                        </span>
                                    ) : key === 'ulasan' &&
                                      book.reviews.length > 0 ? (
                                        <span className="shrink-0 text-sm text-oxford-navy-900/55">
                                            {book.reviews.length} ulasan
                                        </span>
                                    ) : undefined
                                }
                            >
                                {key === 'tentang' && (
                                    <p className="whitespace-pre-line text-base leading-relaxed text-oxford-navy-900/70">
                                        {book.description}
                                    </p>
                                )}

                                {key === 'detail' && (
                                    <BookFacts facts={facts} />
                                )}

                                {key === 'bab' && (
                                    <ol className="flex flex-col gap-3">
                                        {book.chapters.map((chapter) => (
                                            <BookChapterRow
                                                key={chapter.id}
                                                bookSlug={book.slug}
                                                chapter={chapter}
                                            />
                                        ))}
                                    </ol>
                                )}

                                {key === 'ulasan' && (
                                    <BookReviews
                                        bookId={book.id}
                                        reviews={book.reviews}
                                        average={averageRating(book)}
                                        onSubmitted={refreshBook}
                                    />
                                )}
                            </Section>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
