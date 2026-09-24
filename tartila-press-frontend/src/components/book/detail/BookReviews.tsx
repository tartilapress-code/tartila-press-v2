import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { RiLockLine } from '@remixicon/react';
import StarRating from '@/components/ui/StarRating';
import StarRatingInput from '@/components/ui/StarRatingInput';
import { useAuth } from '@/context/useAuth';
import * as bookApi from '@/data/book/bookApi';
import type { BookReviewEntry } from '@/data/book/bookApi';
import { formatDate } from '@/lib/bookChapterPublic';
import { ApiError } from '@/lib/http';

type Message = { tone: 'error' | 'success'; text: string };

/**
 * Isi seksi Ulasan: ringkasan nilai rata-rata, formulir ulasan (khusus yang
 * sudah login; mengirim ulang menggantikan ulasan sebelumnya), dan daftar
 * ulasan pembaca.
 */
export default function BookReviews({
    bookId,
    reviews,
    average,
    onSubmitted,
}: {
    bookId: number;
    reviews: BookReviewEntry[];
    average: number | null;
    // Dipanggil setelah ulasan tersimpan, untuk memuat ulang data buku.
    onSubmitted: () => Promise<void>;
}) {
    const { isAuthenticated } = useAuth();

    const [rating, setRating] = useState<number>(5);
    const [comment, setComment] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [message, setMessage] = useState<Message | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        try {
            await bookApi.upsertReview(bookId, {
                rating,
                comment: comment.trim() || undefined,
            });
            setComment('');
            await onSubmitted();
            setMessage({ tone: 'success', text: 'Ulasan Anda tersimpan.' });
        } catch (error) {
            setMessage({
                tone: 'error',
                text:
                    error instanceof ApiError
                        ? error.message
                        : 'Terjadi kesalahan. Silakan coba lagi.',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-forest-moss-50 p-5 text-center">
                    {average !== null ? (
                        <>
                            <p className="font-display text-5xl font-bold text-oxford-navy-700">
                                {average.toFixed(1)}
                            </p>
                            <StarRating
                                value={average}
                                starClassName="size-5"
                            />
                            <p className="text-sm text-oxford-navy-900/60">
                                dari {reviews.length} ulasan
                            </p>
                        </>
                    ) : (
                        <>
                            <StarRating value={0} starClassName="size-5" />
                            <p className="text-sm text-oxford-navy-900/60">
                                Belum ada penilaian
                            </p>
                        </>
                    )}
                </div>

                {isAuthenticated ? (
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-3"
                    >
                        <StarRatingInput value={rating} onChange={setRating} />

                        <label className="flex flex-col gap-1.5 text-sm font-semibold text-oxford-navy-700">
                            Ulasan (opsional)
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                placeholder="Ceritakan pendapat Anda tentang buku ini..."
                                className="rounded-lg border border-forest-moss-200 bg-white p-3 text-sm font-normal text-oxford-navy-900 outline-none placeholder:text-oxford-navy-900/40 focus:border-forest-moss-600 focus:ring-2 focus:ring-forest-moss-600/20"
                            />
                        </label>

                        {message && (
                            <p
                                role={
                                    message.tone === 'error'
                                        ? 'alert'
                                        : 'status'
                                }
                                className={`text-sm ${
                                    message.tone === 'error'
                                        ? 'text-red-600'
                                        : 'text-forest-moss-700'
                                }`}
                            >
                                {message.text}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center self-start rounded-lg bg-oxford-navy-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:cursor-pointer hover:bg-oxford-navy-600 disabled:cursor-default disabled:opacity-60"
                        >
                            {isSubmitting ? 'Mengirim...' : 'Kirim Ulasan'}
                        </button>
                    </form>
                ) : (
                    <div className="flex flex-col justify-center gap-3 rounded-xl bg-forest-moss-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="flex items-start gap-2 text-sm text-oxford-navy-900/75">
                            <RiLockLine
                                aria-hidden
                                className="mt-0.5 size-4 shrink-0 text-forest-moss-700"
                            />
                            Masuk untuk menulis ulasan buku ini.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-oxford-navy-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-oxford-navy-600"
                        >
                            Masuk
                        </Link>
                    </div>
                )}
            </div>

            {reviews.length === 0 ? (
                <p className="text-sm text-oxford-navy-900/55">
                    Belum ada ulasan.
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {reviews.map((review) => (
                        <li
                            key={review.id}
                            className="flex gap-3 rounded-xl border border-forest-moss-100 bg-white p-4"
                        >
                            <span
                                aria-hidden
                                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-forest-moss-100 font-display text-lg font-bold text-forest-moss-800"
                            >
                                {review.user.name
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase() || '?'}
                            </span>

                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p className="font-semibold text-oxford-navy-700">
                                        {review.user.name}
                                    </p>
                                    <StarRating value={review.rating} />
                                    <span className="text-xs text-oxford-navy-900/45">
                                        {formatDate(review.created_at)}
                                    </span>
                                </div>

                                {review.comment && (
                                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-oxford-navy-900/70">
                                        {review.comment}
                                    </p>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
