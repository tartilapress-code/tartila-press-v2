import { http } from '@/lib/http';

/** Item satuan (fasilitas/layanan) yang bisa dirakit menjadi paket custom. */
export type CustomItem = {
    id: number;
    type: 'facility' | 'service';
    name: string;
    price: string;
    discount: number;
    final_price: number;
    description: string | null;
};

export const list = () => http.get('/custom-package-items');
