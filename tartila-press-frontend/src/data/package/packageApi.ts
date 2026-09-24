import { http } from '@/lib/http';

/** Paket di katalog publik: cukup untuk kartu, perbandingan, dan hitungan hemat. */
export type PackageSummary = {
    id: number;
    name: string;
    category: string | null;
    photo: string | null;
    price: string;
    discount: number;
    final_price: number;
    facilities: string[] | null;
    services: string[] | null;
};

export const list = () => http.get('/packages');

export const get = (id: number | string) => http.get(`/packages/${id}`);
