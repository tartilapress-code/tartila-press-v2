import { apiUrl, http } from '@/lib/http';

export type BookCategoryItem = { id: number; name: string };

export type PublicProfileRef = {
    slug: string;
    pen_name: string | null;
    is_published: boolean;
};

export type ProfileLinkable = {
    name: string;
    public_profile: PublicProfileRef | null;
};

export type BookSummary = {
    id: number;
    slug: string;
    title: string;
    authors_text: string | null;
    front_cover: string | null;
    price: string;
    discount: number;
    final_price: number;
    is_chapter_compilation: boolean;
    // Bahasa isi buku (kode); kosong bila belum diisi.
    languages: string[];
    editor_name: string | null;
    author_profiles: ProfileLinkable[];
    editor_profile: ProfileLinkable | null;
    category: BookCategoryItem | null;
    field_category: BookCategoryItem | null;
    reviews_avg_rating: number | string | null;
};

export type BookChapterEntry = {
    id: number;
    chapter_number: number;
    title: string;
    preview_url: string | null;
    // Kosong untuk bab yang belum terhubung ke naskah penulis.
    manuscript: {
        id: number;
        user: {
            id: number;
            name: string;
            public_profile: PublicProfileRef | null;
        };
    } | null;
};

export type BookReviewEntry = {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string;
    user: { id: number; name: string };
};

// Bentuk `GET /books/{slug}`: ringkasan buku + rincian, daftar bab (buku
// kompilasi Book Chapter), dan ulasan.
export type BookDetail = BookSummary & {
    isbn: string | null;
    // Nama penulis untuk sitasi, sudah dibersihkan server (tanpa gelar).
    citation_authors: string[];
    back_cover: string | null;
    cover_layout_designer: string | null;
    description: string | null;
    preview_url: string | null;
    citation_publisher: string | null;
    citation_publication_date: string | null;
    google_scholar_url: string | null;
    chapters: BookChapterEntry[];
    reviews: BookReviewEntry[];
};

export type BookListParams = Partial<{
    ids: string;
    search: string;
    book_category_id: number | string;
    field_category_id: number | string;
    sort: 'newest' | 'price_asc' | 'price_desc' | 'rating';
}>;

const toQueryString = (params: BookListParams) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });

    const qs = query.toString();

    return qs ? `?${qs}` : '';
};

export const list = (params: BookListParams = {}) =>
    http.get(`/books${toQueryString(params)}`);

export const get = (id: number | string) => http.get(`/books/${id}`);

// PDF preview disajikan lewat API (berheader CORS) supaya bisa dibaca PDF.js;
// alamat langsung di /storage tidak bisa di-fetch dari origin frontend.
export const previewPdfUrl = (slug: string) => apiUrl(`/books/${slug}/preview`);

// Alamat PDF yang stabil dan berakhiran .pdf, untuk metadata sitasi
// (citation_pdf_url): selalu menyajikan preview terbaru.
export const stablePreviewPdfUrl = (slug: string) =>
    apiUrl(`/books/${slug}/preview.pdf`);

export const upsertReview = (
    id: number | string,
    payload: { rating: number; comment?: string }
) => http.post(`/books/${id}/reviews`, payload);

export const deleteReview = (id: number | string) =>
    http.delete(`/books/${id}/reviews`);

export const listBookCategories = () => http.get('/book-categories');

export const listFieldCategories = () => http.get('/field-categories');
