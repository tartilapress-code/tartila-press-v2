import { http } from '@/lib/http';
import type { IsbnType } from '@/lib/isbnTypes';

export type CreateOrderPayload = {
    type: 'package' | 'custom' | 'book_chapter' | 'book';
    package_id?: number;
    // Jenis ISBN paket yang dipilih pembeli (wajib bila paket menawarkan lebih dari satu).
    isbn_type?: IsbnType;
    custom_item_ids?: number[];
    book_chapter_id?: number;
    book_ids?: number[];
    editor_id?: number;
    // Layanan co-author (paket penerbitan): minta co-author, opsional memilih sendiri.
    wants_coauthor?: boolean;
    coauthor_id?: number;
    voucher_code?: string;
    notes?: string;
    recipient_name?: string;
    recipient_phone?: string;
    recipient_address?: string;
    // Rekening tujuan transfer yang dipilih pembeli (tampil di invoice).
    payment_method_id?: number;
};

export const create = (payload: CreateOrderPayload) =>
    http.post('/orders', payload);

export type CheckVoucherPayload = Pick<
    CreateOrderPayload,
    | 'type'
    | 'package_id'
    | 'isbn_type'
    | 'custom_item_ids'
    | 'book_chapter_id'
    | 'book_ids'
> & { voucher_code: string };

export const checkVoucher = (payload: CheckVoucherPayload) =>
    http.post('/orders/check-voucher', payload);

export const mine = () => http.get('/orders/mine');

export const confirmReceived = (orderId: number | string) =>
    http.post(`/orders/${orderId}/confirm-received`);

export const uploadPaymentProof = (
    orderId: number | string,
    formData: FormData
) => http.upload(`/orders/${orderId}/payment-proof`, formData);

export type OrderMessage = {
    id: number;
    order_id: number;
    user_id: number;
    is_admin: boolean;
    body: string;
    created_at: string;
    user: { id: number; name: string };
};

export const listMessages = (orderId: number | string) =>
    http.get(`/orders/${orderId}/messages`);

export const sendMessage = (orderId: number | string, body: string) =>
    http.post(`/orders/${orderId}/messages`, { body });

export type Invoice = {
    id: number;
    invoice_number: string;
    order_number: string;
    issued_at: string;
    payment_due_at: string | null;
    payment_window_hours: number;
    status: string;
    payment_status: 'unpaid' | 'awaiting_verification' | 'paid' | 'cancelled';
    payment_proof_uploaded_at: string | null;
    paid_at: string | null;
    cancel_reason: string | null;
    seller: {
        name: string;
        address: string | null;
        email: string | null;
        phone: string | null;
    };
    buyer: { name: string; email: string; phone: string | null };
    items: {
        name: string;
        quantity: number;
        unit_price: number;
        discount: number;
        subtotal: number;
    }[];
    subtotal: number;
    discount_total: number;
    voucher_code: string | null;
    voucher_discount: number;
    editor: { name: string; fee: number } | null;
    coauthor?: { name: string | null; fee: number } | null;
    total: number;
    payment_method: {
        bank_name: string;
        account_number: string;
        account_holder_name: string;
    } | null;
    shipment: {
        recipient_name: string;
        recipient_phone: string;
        recipient_address: string;
    } | null;
    notes: string | null;
};

// Invoice pesanan (pembeli pemilik pesanan atau admin).
export const invoice = (orderId: number | string) =>
    http.get(`/orders/${orderId}/invoice`);
