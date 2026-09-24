// Fungsi bantu untuk halaman detail buku.

import type { BookSummary } from '@/data/book/bookApi';

type WithAuthors = Pick<BookSummary, 'author_profiles' | 'authors_text'>;

/** Ada nama penulis yang bisa ditampilkan (dari profil atau teks bebas). */
export function hasAuthors(book: WithAuthors): boolean {
    return book.author_profiles.length > 0 || Boolean(book.authors_text);
}

/** Rata-rata ulasan sebagai angka; null bila belum ada ulasan. */
export function averageRating(
    book: Pick<BookSummary, 'reviews_avg_rating'>
): number | null {
    if (book.reviews_avg_rating === null) {
        return null;
    }

    const value = Number(book.reviews_avg_rating);

    return Number.isFinite(value) ? value : null;
}

/** Nilai berupa alamat web http(s) yang sah (untuk tautan luar dari data isian admin). */
export function isHttpUrl(value: string | null | undefined): value is string {
    if (!value) {
        return false;
    }

    try {
        const { protocol } = new URL(value);

        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/** Nama kategori buku & bidang keilmuan (yang terisi saja). */
export function bookCategoryNames(
    book: Pick<BookSummary, 'category' | 'field_category'>
): string[] {
    return [book.category?.name, book.field_category?.name].filter(
        (name): name is string => Boolean(name)
    );
}
