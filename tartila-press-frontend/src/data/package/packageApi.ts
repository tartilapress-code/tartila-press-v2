import { http } from '@/lib/http';
import type { IsbnOption, IsbnType } from '@/lib/isbnTypes';

/** Paket di katalog publik: cukup untuk kartu, perbandingan, dan hitungan hemat. */
export type PackageSummary = {
    id: number;
    // Dipin admin sebagai rekomendasi (tampil paling atas).
    is_recommended?: boolean;
    name: string;
    category: string | null;
    photo: string | null;
    price: string;
    discount: number;
    final_price: number;
    facilities: string[] | null;
    services: string[] | null;
    // Harga per jenis ISBN; `price`/`final_price` = harga bawaan (ISBN cetak bila ditawarkan).
    isbn_options: IsbnOption[];
    default_isbn_type: IsbnType;
};

export const list = () => http.get('/packages');

export const get = (id: number | string) => http.get(`/packages/${id}`);
