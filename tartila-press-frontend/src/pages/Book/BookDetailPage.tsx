import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ErrorPage from '@/pages/ErrorPage';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/useAuth';
import { useCart } from '@/context/useCart';
import * as bookApi from '@/data/book/bookApi';
import Button from '@/components/Button/Button';
import CartFab from '@/components/cart/CartFab';

type PublicProfileRef = {
    slug: string;
    pen_name: string | null;
    is_published: boolean;
};

type Chapter = {
    id: number;
    chapter_number: number;
    title: string;
    preview_url: string | null;
    manuscript: {
        id: number;
        user: {
            id: number;
            name: string;
            public_profile: PublicProfileRef | null;
        };
    };
};

type Review = {
    id: number;
    rating: number;
    comment: string | null;
    user: { id: number; name: string };
};

type BookDetail = {
    id: number;
    title: string;
    authors_text: string | null;
    isbn: string | null;
    front_cover: string | null;
    back_cover: string | null;
    cover_layout_designer: string | null;
    editor_name: string | null;
    description: string | null;
    price: string;
    discount: number;
    final_price: number;
    preview_url: string | null;
    citation_publisher: string | null;
    citation_publication_date: string | null;
    google_scholar_url: string | null;
    is_chapter_compilation: boolean;
    category: { id: number; name: string } | null;
    field_category: { id: number; name: string } | null;
    chapters: Chapter[];
    reviews: Review[];
    reviews_avg_rating: number | string | null;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function AuthorLink({
    name,
    profile,
}: {
    name: string;
    profile: PublicProfileRef | null;
}) {
    if (profile?.is_published) {
        return (
            <Link
                to={`/penulis/${profile.slug}`}
                className="text-forest-moss-300 hover:text-forest-moss-200"
            >
                {profile.pen_name || name}
            </Link>
        );
    }

    return <span>{name}</span>;
}

export default function BookDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { addToCart, isInCart } = useCart();

    const [book, setBook] = useState<BookDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    const [rating, setRating] = useState<string>('5');
    const [comment, setComment] = useState<string>('');
    const [isSubmittingReview, setIsSubmittingReview] =
        useState<boolean>(false);
    const [reviewMessage, setReviewMessage] = useState<string>('');

    function load() {
        return bookApi
            .get(id ?? '')
            .then((response) => setBook(response.data))
            .catch((error) => {
                if (error instanceof ApiError && error.status === 404) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        Promise.resolve().then(load);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

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
        (book.authors_text ?? '')
            .split(',')
            .map((author) => author.trim())
            .filter(Boolean)
            .forEach((author) => addTag('citation_author', author));
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
            addTag('citation_pdf_url', book.preview_url);
        }

        return () => {
            tags.forEach((tag) => document.head.removeChild(tag));
        };
    }, [book]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-dvh">
                <p className="text-oxford-navy-900">Memuat...</p>
            </div>
        );
    }

    if (notFound || !book) {
        return <ErrorPage />;
    }

    async function handleSubmitReview() {
        setIsSubmittingReview(true);
        setReviewMessage('');

        try {
            await bookApi.upsertReview(book!.id, {
                rating: Number(rating),
                comment: comment || undefined,
            });
            setComment('');
            await load();
        } catch (error) {
            setReviewMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmittingReview(false);
        }
    }

    return (
        <div className="flex flex-col gap-6 my-10 max-w-3xl mx-auto">
            <CartFab />
            <div className="flex flex-col md:flex-row gap-6 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-8">
                {book.front_cover && (
                    <img
                        src={book.front_cover}
                        alt={book.title}
                        className="w-48 h-64 object-cover rounded-lg self-center md:self-start"
                    />
                )}

                <div className="flex flex-col gap-2">
                    {(book.category || book.field_category) && (
                        <p className="text-forest-moss-300 text-sm">
                            {[book.category?.name, book.field_category?.name]
                                .filter(Boolean)
                                .join(' • ')}
                        </p>
                    )}
                    <h1 className="text-white text-3xl font-bold">
                        {book.title}
                    </h1>
                    {book.authors_text && (
                        <p className="text-white/70">{book.authors_text}</p>
                    )}
                    {book.isbn && (
                        <p className="text-white/60 text-sm">
                            ISBN: {book.isbn}
                        </p>
                    )}
                    {book.editor_name && (
                        <p className="text-white/60 text-sm">
                            Editor: {book.editor_name}
                        </p>
                    )}
                    {book.cover_layout_designer && (
                        <p className="text-white/60 text-sm">
                            Desain Sampul & Tata Letak:{' '}
                            {book.cover_layout_designer}
                        </p>
                    )}
                    {book.reviews_avg_rating !== null && (
                        <p className="text-white/70 text-sm">
                            ★ {Number(book.reviews_avg_rating).toFixed(1)} (
                            {book.reviews.length} ulasan)
                        </p>
                    )}

                    <div className="flex flex-row items-center gap-3 mt-2">
                        {book.discount > 0 && (
                            <span className="text-white/50 line-through">
                                {rupiahFormatter.format(Number(book.price))}
                            </span>
                        )}
                        <span className="text-forest-moss-300 text-2xl font-semibold">
                            {rupiahFormatter.format(book.final_price)}
                        </span>
                        {book.discount > 0 && (
                            <span className="text-white/70 text-sm">
                                (diskon {book.discount}%)
                            </span>
                        )}
                    </div>

                    {book.description && (
                        <p className="text-white/80 mt-2">
                            {book.description}
                        </p>
                    )}

                    <div className="flex flex-row flex-wrap gap-3 mt-2">
                        <Button
                            variant="secondary"
                            onClick={() =>
                                navigate(`/dashboard/beli-buku/${book.id}`)
                            }
                        >
                            Beli Sekarang
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={() => addToCart(book.id)}
                            disabled={isInCart(book.id)}
                        >
                            {isInCart(book.id)
                                ? 'Sudah di Keranjang'
                                : '+ Keranjang'}
                        </Button>
                        {book.preview_url && (
                            <a
                                href={book.preview_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Button variant="secondary">
                                    Lihat Preview PDF
                                </Button>
                            </a>
                        )}
                        {book.google_scholar_url && (
                            <a
                                href={book.google_scholar_url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Button variant="outline2">
                                    Google Scholar
                                </Button>
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {book.is_chapter_compilation && book.chapters.length > 0 && (
                <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                    <h2 className="text-white text-xl font-semibold">
                        Daftar Bab
                    </h2>
                    <div className="flex flex-col gap-2">
                        {book.chapters.map((chapter) => (
                            <div
                                key={chapter.id}
                                className="flex flex-row items-center justify-between bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <div>
                                    <Link
                                        to={`/buku/${book.id}/bab/${chapter.id}`}
                                        className="text-white font-semibold hover:text-forest-moss-300"
                                    >
                                        Bab {chapter.chapter_number} —{' '}
                                        {chapter.title}
                                    </Link>
                                    <p className="text-white/60 text-sm">
                                        <AuthorLink
                                            name={chapter.manuscript.user.name}
                                            profile={
                                                chapter.manuscript.user
                                                    .public_profile
                                            }
                                        />
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h2 className="text-white text-xl font-semibold">Ulasan</h2>

                {isAuthenticated && (
                    <div className="flex flex-col gap-2">
                        <select
                            value={rating}
                            onChange={(e) => setRating(e.target.value)}
                            className="w-32 p-2 rounded-lg ring-1 ring-white/30 bg-oxford-navy-900 text-white outline-none"
                        >
                            {[5, 4, 3, 2, 1].map((value) => (
                                <option key={value} value={value}>
                                    {value} Bintang
                                </option>
                            ))}
                        </select>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Tulis ulasan (opsional)..."
                            className="p-3 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white outline-none"
                            rows={3}
                        />
                        {reviewMessage && (
                            <p className="text-red-400 text-sm">
                                {reviewMessage}
                            </p>
                        )}
                        <Button
                            variant="primary"
                            className="self-start"
                            onClick={handleSubmitReview}
                            disabled={isSubmittingReview}
                        >
                            {isSubmittingReview
                                ? 'Mengirim...'
                                : 'Kirim Ulasan'}
                        </Button>
                    </div>
                )}

                {book.reviews.length === 0 ? (
                    <p className="text-white/60 text-sm">Belum ada ulasan.</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {book.reviews.map((review) => (
                            <div
                                key={review.id}
                                className="bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <p className="text-white font-semibold">
                                    {review.user.name} — ★ {review.rating}
                                </p>
                                {review.comment && (
                                    <p className="text-white/70 text-sm">
                                        {review.comment}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Link
                to="/buku"
                className="text-forest-moss-300 text-sm hover:text-forest-moss-200 self-center"
            >
                ← Kembali ke katalog buku
            </Link>
        </div>
    );
}
