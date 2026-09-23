import { http } from '@/lib/http';

export type BookCategoryItem = { id: number; name: string };

export type BookSummary = {
    id: number;
    title: string;
    authors_text: string | null;
    front_cover: string | null;
    price: string;
    discount: number;
    final_price: number;
    is_chapter_compilation: boolean;
    editor_name: string | null;
    category: BookCategoryItem | null;
    field_category: BookCategoryItem | null;
    reviews_avg_rating: number | string | null;
};

export type BookListParams = Partial<{
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

export const upsertReview = (
    id: number | string,
    payload: { rating: number; comment?: string }
) => http.post(`/books/${id}/reviews`, payload);

export const deleteReview = (id: number | string) =>
    http.delete(`/books/${id}/reviews`);

export const listBookCategories = () => http.get('/book-categories');

export const listFieldCategories = () => http.get('/field-categories');
