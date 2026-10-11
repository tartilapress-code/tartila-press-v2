import { http } from '@/lib/http';

export type PaymentMethod = {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder_name: string;
};

// Rekening aktif tujuan transfer.
export const list = () => http.get('/payment-methods');
