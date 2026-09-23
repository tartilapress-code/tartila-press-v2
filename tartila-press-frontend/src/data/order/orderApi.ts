import { http } from '@/lib/http';

export type CreateOrderPayload = {
    type: 'package' | 'custom' | 'book_chapter' | 'book';
    package_id?: number;
    custom_item_ids?: number[];
    book_chapter_id?: number;
    book_ids?: number[];
    editor_id?: number;
    notes?: string;
    recipient_name?: string;
    recipient_phone?: string;
    recipient_address?: string;
};

export const create = (payload: CreateOrderPayload) =>
    http.post('/orders', payload);

export const mine = () => http.get('/orders/mine');

export const confirmReceived = (orderId: number | string) =>
    http.post(`/orders/${orderId}/confirm-received`);

export const uploadPaymentProof = (
    orderId: number | string,
    formData: FormData
) => http.upload(`/orders/${orderId}/payment-proof`, formData);
