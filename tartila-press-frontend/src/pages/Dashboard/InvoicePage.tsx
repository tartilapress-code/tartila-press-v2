import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    RiCheckboxCircleLine,
    RiCloseCircleLine,
    RiFileCopyLine,
    RiPrinterLine,
    RiTimeLine,
    RiUploadCloud2Line,
} from '@remixicon/react';
import logo from '@/assets/logo/logo.png';
import Button from '@/components/Button/Button';
import * as orderApi from '@/data/order/orderApi';
import type { Invoice } from '@/data/order/orderApi';
import { ApiError } from '@/lib/http';

const rupiah = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
});

const dateOnly = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
});

const formatDateTime = (value: string | null) =>
    value ? `${dateTime.format(new Date(value))} WIB` : '-';

const STATUS_BADGE: Record<
    Invoice['payment_status'],
    { label: string; className: string }
> = {
    unpaid: {
        label: 'Belum dibayar',
        className: 'bg-amber-100 text-amber-900 ring-amber-300',
    },
    awaiting_verification: {
        label: 'Menunggu verifikasi',
        className: 'bg-sky-100 text-sky-900 ring-sky-300',
    },
    paid: {
        label: 'Lunas',
        className:
            'bg-forest-moss-100 text-forest-moss-900 ring-forest-moss-300',
    },
    cancelled: {
        label: 'Dibatalkan',
        className: 'bg-red-100 text-red-800 ring-red-300',
    },
};

// "23 jam 10 menit" dari selisih milidetik.
function remaining(ms: number) {
    const minutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(minutes / 60);

    return hours > 0
        ? `${hours} jam ${minutes % 60} menit`
        : `${minutes % 60} menit`;
}

/**
 * Invoice pesanan: muncul tepat setelah pesanan dibuat dan bisa dibuka lagi
 * dari Pesanan Saya. Berisi data penerbit & pembeli, nomor & tanggal invoice,
 * item yang dibeli, rekening tujuan, batas bayar 1×24 jam, serta unggah bukti
 * transfer. Bisa dicetak atau disimpan sebagai PDF lewat dialog cetak.
 */
export default function InvoicePage() {
    const { id } = useParams<{ id: string }>();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadError, setUploadError] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [now, setNow] = useState<number>(() => Date.now());

    const load = useCallback(
        () =>
            orderApi
                .invoice(id ?? '')
                .then((response) => setInvoice(response.data))
                .catch((caught) =>
                    setError(
                        caught instanceof ApiError
                            ? caught.message
                            : 'Invoice tidak dapat dimuat.'
                    )
                )
                .finally(() => setIsLoading(false)),
        [id]
    );

    useEffect(() => {
        void load();
    }, [load]);

    // Hitung mundur batas bayar (diperbarui tiap 30 detik).
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30000);

        return () => clearInterval(timer);
    }, []);

    async function handleProof(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file || !invoice) return;

        setIsUploading(true);
        setUploadError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            await orderApi.uploadPaymentProof(invoice.id, formData);
            await load();
        } catch (caught) {
            setUploadError(
                caught instanceof ApiError
                    ? caught.message
                    : 'Gagal mengunggah bukti transfer.'
            );
            await load();
        } finally {
            setIsUploading(false);
        }
    }

    async function copyAccount(accountNumber: string) {
        try {
            await navigator.clipboard.writeText(accountNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    }

    if (isLoading) {
        return (
            <p className="text-oxford-navy-900/70 text-sm">Memuat invoice...</p>
        );
    }

    if (!invoice) {
        return (
            <p className="text-red-600 text-sm">
                {error || 'Invoice tidak ditemukan.'}
            </p>
        );
    }

    const badge = STATUS_BADGE[invoice.payment_status];
    const dueMs = invoice.payment_due_at
        ? new Date(invoice.payment_due_at).getTime() - now
        : null;
    const isUnpaid = invoice.payment_status === 'unpaid';

    return (
        <div className="flex flex-col gap-4">
            {/* Aksi (tidak ikut tercetak) */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
                <Button variant="primary" onClick={() => window.print()}>
                    <span className="inline-flex items-center gap-2">
                        <RiPrinterLine aria-hidden className="size-4" />
                        Cetak / Simpan PDF
                    </span>
                </Button>
                <Link to="/dashboard/pesanan">
                    <Button variant="outline2">Ke Pesanan Saya</Button>
                </Link>
            </div>

            {isUnpaid && dueMs !== null && (
                <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 print:hidden"
                >
                    <RiTimeLine
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0"
                    />
                    <p>
                        Selesaikan pembayaran sebelum{' '}
                        <strong>
                            {formatDateTime(invoice.payment_due_at)}
                        </strong>
                        {dueMs > 0 && <> (sisa {remaining(dueMs)})</>}. Jika
                        tidak ada konfirmasi pembayaran (bukti transfer) sampai
                        batas waktu {invoice.payment_window_hours} jam, pesanan
                        dibatalkan otomatis.
                    </p>
                </div>
            )}

            <article className="print-area flex flex-col gap-6 rounded-2xl bg-white p-6 ring-1 ring-forest-moss-100 shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] sm:p-8">
                {/* Kepala invoice */}
                <header className="flex flex-col justify-between gap-4 border-b border-forest-moss-100 pb-5 sm:flex-row">
                    <div className="flex items-start gap-3">
                        <img src={logo} alt="" className="size-12 shrink-0" />
                        <div className="text-sm text-oxford-navy-900/80">
                            <p className="font-display text-lg font-bold text-oxford-navy-700">
                                {invoice.seller.name}
                            </p>
                            {invoice.seller.address && (
                                <p>{invoice.seller.address}</p>
                            )}
                            {invoice.seller.email && (
                                <p>{invoice.seller.email}</p>
                            )}
                            {invoice.seller.phone && (
                                <p>{invoice.seller.phone}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 text-sm sm:items-end sm:text-right">
                        <p className="font-display text-2xl font-bold tracking-wide text-oxford-navy-700">
                            INVOICE
                        </p>
                        <p className="font-mono font-semibold text-oxford-navy-900">
                            {invoice.invoice_number}
                        </p>
                        <span
                            className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 sm:self-end ${badge.className}`}
                        >
                            {badge.label}
                        </span>
                    </div>
                </header>

                {/* Pembeli & tanggal */}
                <section className="grid gap-4 text-sm sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/55">
                            Ditagihkan kepada
                        </p>
                        <p className="font-semibold text-oxford-navy-900">
                            {invoice.buyer.name}
                        </p>
                        <p className="text-oxford-navy-900/75">
                            {invoice.buyer.email}
                        </p>
                        {invoice.buyer.phone && (
                            <p className="text-oxford-navy-900/75">
                                {invoice.buyer.phone}
                            </p>
                        )}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
                        <dt className="text-oxford-navy-900/60">Tanggal</dt>
                        <dd className="text-oxford-navy-900">
                            {dateOnly.format(new Date(invoice.issued_at))}
                        </dd>
                        <dt className="text-oxford-navy-900/60">No. Pesanan</dt>
                        <dd className="font-mono text-oxford-navy-900">
                            {invoice.order_number}
                        </dd>
                        {invoice.payment_due_at && (
                            <>
                                <dt className="text-oxford-navy-900/60">
                                    Batas bayar
                                </dt>
                                <dd className="text-oxford-navy-900">
                                    {formatDateTime(invoice.payment_due_at)}
                                </dd>
                            </>
                        )}
                        {invoice.paid_at && (
                            <>
                                <dt className="text-oxford-navy-900/60">
                                    Dibayar
                                </dt>
                                <dd className="text-oxford-navy-900">
                                    {formatDateTime(invoice.paid_at)}
                                </dd>
                            </>
                        )}
                    </dl>
                </section>

                {/* Item */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-forest-moss-200 text-oxford-navy-900/65">
                                <th className="py-2 pr-3 font-medium">
                                    Paket / Produk
                                </th>
                                <th className="py-2 pr-3 text-right font-medium">
                                    Jumlah
                                </th>
                                <th className="py-2 pr-3 text-right font-medium">
                                    Harga
                                </th>
                                <th className="py-2 text-right font-medium">
                                    Subtotal
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items.map((item, index) => (
                                <tr
                                    key={index}
                                    className="border-b border-forest-moss-50 align-top"
                                >
                                    <td className="py-2 pr-3 text-oxford-navy-900">
                                        {item.name}
                                    </td>
                                    <td className="py-2 pr-3 text-right">
                                        {item.quantity}
                                    </td>
                                    <td className="py-2 pr-3 text-right whitespace-nowrap">
                                        {rupiah.format(item.unit_price)}
                                    </td>
                                    <td className="py-2 text-right whitespace-nowrap">
                                        {rupiah.format(item.subtotal)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Rincian & rekening */}
                <section className="grid gap-6 sm:grid-cols-2">
                    <div className="flex flex-col gap-2 rounded-xl bg-forest-moss-50 p-4 text-sm ring-1 ring-forest-moss-100">
                        <p className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/55">
                            Transfer ke rekening
                        </p>
                        {invoice.payment_method ? (
                            <>
                                <p className="font-semibold text-oxford-navy-900">
                                    {invoice.payment_method.bank_name}
                                </p>
                                <p className="flex items-center gap-2 font-mono text-base text-oxford-navy-900">
                                    {invoice.payment_method.account_number}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            copyAccount(
                                                invoice.payment_method!
                                                    .account_number
                                            )
                                        }
                                        aria-label="Salin nomor rekening"
                                        className="rounded p-1 text-forest-moss-700 hover:cursor-pointer hover:bg-forest-moss-100 print:hidden"
                                    >
                                        <RiFileCopyLine
                                            aria-hidden
                                            className="size-4"
                                        />
                                    </button>
                                    {copied && (
                                        <span className="font-sans text-xs text-forest-moss-700 print:hidden">
                                            Tersalin
                                        </span>
                                    )}
                                </p>
                                <p className="text-oxford-navy-900/75">
                                    a.n.{' '}
                                    {invoice.payment_method.account_holder_name}
                                </p>
                            </>
                        ) : (
                            <p className="text-oxford-navy-900/75">
                                Rekening tujuan diinformasikan admin.
                            </p>
                        )}
                    </div>

                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 self-start text-sm">
                        <dt className="text-oxford-navy-900/65">Subtotal</dt>
                        <dd className="text-right">
                            {rupiah.format(invoice.subtotal)}
                        </dd>
                        {invoice.discount_total > 0 && (
                            <>
                                <dt className="text-oxford-navy-900/65">
                                    Diskon
                                </dt>
                                <dd className="text-right">
                                    − {rupiah.format(invoice.discount_total)}
                                </dd>
                            </>
                        )}
                        {invoice.voucher_discount > 0 && (
                            <>
                                <dt className="text-oxford-navy-900/65">
                                    Voucher {invoice.voucher_code}
                                </dt>
                                <dd className="text-right">
                                    − {rupiah.format(invoice.voucher_discount)}
                                </dd>
                            </>
                        )}
                        {invoice.editor && (
                            <>
                                <dt className="text-oxford-navy-900/65">
                                    Fee editor ({invoice.editor.name})
                                </dt>
                                <dd className="text-right">
                                    {rupiah.format(invoice.editor.fee)}
                                </dd>
                            </>
                        )}
                        {invoice.coauthor && (
                            <>
                                <dt className="text-oxford-navy-900/65">
                                    Fee co-author ({invoice.coauthor.name})
                                </dt>
                                <dd className="text-right">
                                    {rupiah.format(invoice.coauthor.fee)}
                                </dd>
                            </>
                        )}
                        <dt className="border-t border-forest-moss-200 pt-2 font-semibold text-oxford-navy-900">
                            Total bayar
                        </dt>
                        <dd className="border-t border-forest-moss-200 pt-2 text-right text-lg font-bold text-oxford-navy-700">
                            {rupiah.format(invoice.total)}
                        </dd>
                    </dl>
                </section>

                {invoice.shipment && (
                    <section className="text-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-oxford-navy-900/55">
                            Dikirim ke
                        </p>
                        <p className="text-oxford-navy-900">
                            {invoice.shipment.recipient_name} ·{' '}
                            {invoice.shipment.recipient_phone}
                        </p>
                        <p className="text-oxford-navy-900/75">
                            {invoice.shipment.recipient_address}
                        </p>
                    </section>
                )}

                <footer className="border-t border-forest-moss-100 pt-4 text-xs text-oxford-navy-900/65">
                    Pembayaran paling lambat {invoice.payment_window_hours} jam
                    setelah pesanan dibuat. Jika tidak ada konfirmasi pembayaran
                    (bukti transfer) sampai batas waktu, pesanan dibatalkan
                    otomatis. Invoice ini sah tanpa tanda tangan.
                </footer>
            </article>

            {/* Status & unggah bukti (tidak ikut tercetak) */}
            <div className="flex flex-col gap-2 print:hidden">
                {isUnpaid && (
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg bg-oxford-navy-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-oxford-navy-800">
                        <RiUploadCloud2Line aria-hidden className="size-5" />
                        {isUploading
                            ? 'Mengunggah...'
                            : 'Unggah bukti transfer'}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={isUploading}
                            onChange={handleProof}
                        />
                    </label>
                )}
                {invoice.payment_status === 'awaiting_verification' && (
                    <p className="flex items-center gap-2 text-sm text-sky-900">
                        <RiCheckboxCircleLine aria-hidden className="size-5" />
                        Bukti transfer diterima{' '}
                        {formatDateTime(invoice.payment_proof_uploaded_at)},
                        menunggu verifikasi admin.
                    </p>
                )}
                {invoice.payment_status === 'cancelled' && (
                    <p className="flex items-center gap-2 text-sm text-red-700">
                        <RiCloseCircleLine aria-hidden className="size-5" />
                        {invoice.cancel_reason || 'Pesanan dibatalkan.'}
                    </p>
                )}
                {uploadError && (
                    <p className="text-sm text-red-600">{uploadError}</p>
                )}
            </div>
        </div>
    );
}
