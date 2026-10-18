import { http } from '@/lib/http';
import { queryString, type PageParams } from '@/lib/pagination';

export type ArticleFieldCategory = { id: number; name: string };

export type ArticlePublicProfileRef = {
    slug: string;
    pen_name: string | null;
    is_published: boolean;
    city: string | null;
    profile_photo: string | null;
};

export type ArticleAuthor = {
    id: number;
    name: string;
    public_profile: ArticlePublicProfileRef | null;
};

export type Article = {
    id: number;
    is_recommended?: boolean;
    slug: string;
    title: string;
    photo: string | null;
    body: string;
    status: 'pending' | 'approved' | 'rejected';
    published_at: string | null;
    created_at: string;
    field_category: ArticleFieldCategory | null;
    user: ArticleAuthor;
    likes_count: number;
    liked_by_me?: boolean;
    comments?: ArticleComment[];
};

export type ArticleComment = {
    id: number;
    body: string;
    created_at: string;
    user: { id: number; name: string };
};

export type CreateArticlePayload = {
    title: string;
    photo?: string;
    field_category_id: number | string;
    body: string;
};

// Per halaman (bawaan 12). highlight=1: meta.highlights = terbaru & terpopuler.
export const list = (
    params: Partial<{
        search: string;
        category: string;
        highlight: 1;
    }> &
        PageParams = {}
) => http.get(`/articles${queryString(params)}`);

export const get = (slug: string) => http.get(`/articles/${slug}`);

export const mine = () => http.get('/articles/mine');

export const create = (payload: CreateArticlePayload) =>
    http.post('/articles', payload);

export const like = (slug: string) => http.post(`/articles/${slug}/like`);

export const unlike = (slug: string) => http.delete(`/articles/${slug}/like`);

export const listComments = (slug: string) =>
    http.get(`/articles/${slug}/comments`);

export const createComment = (slug: string, body: string) =>
    http.post(`/articles/${slug}/comments`, { body });

export const deleteComment = (slug: string, commentId: number) =>
    http.delete(`/articles/${slug}/comments/${commentId}`);

export const adminList = (status?: string) =>
    http.get(`/admin/articles${status ? `?status=${status}` : ''}`);

export const adminApprove = (id: number) =>
    http.post(`/admin/articles/${id}/approve`);

export const adminReject = (id: number) =>
    http.post(`/admin/articles/${id}/reject`);
