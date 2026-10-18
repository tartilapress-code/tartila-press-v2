import { http } from '@/lib/http';
import { queryString } from '@/lib/pagination';

export type RecommendationItem = {
    id: number;
    title: string;
    subtitle: string | null;
    image: string | null;
    position?: number;
    // false = tidak tampil di publik (nonaktif/habis/belum terbit); slot tetap tersimpan.
    visible?: boolean;
};

export type RecommendationSection = {
    section: string;
    label: string;
    limit: number;
    // Editor dikelola di Kelola Editor ("Promosikan"); di sini hanya ditampilkan.
    managed_elsewhere: boolean;
    items: RecommendationItem[];
};

export const list = (): Promise<{ data: RecommendationSection[] }> =>
    http.get('/admin/recommendations');

export const options = (
    section: string,
    search?: string
): Promise<{ data: RecommendationItem[] }> =>
    http.get(
        `/admin/recommendations/${section}/options${queryString({ search })}`
    );

export const save = (
    section: string,
    itemIds: number[]
): Promise<{ data: RecommendationItem[]; message: string }> =>
    http.put(`/admin/recommendations/${section}`, { item_ids: itemIds });
