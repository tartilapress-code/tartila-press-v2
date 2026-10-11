import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MyMouList from '@/components/mou/MyMouList';
import * as royaltyApi from '@/data/royalty/royaltyApi';

type ExternalSale = {
    id: number;
    marketplace_name: string;
    format: 'physical' | 'ebook';
    original_price: string;
    quantity_sold: number;
    royalty_amount: number;
};

type RoyaltyBook = {
    id: number;
    title: string;
    price: string;
    role: 'author' | 'editor';
    package_label: string;
    authors_count: number;
    chapters_count: number | null;
    total_chapters: number | null;
    royalty_percentage: number;
    ebook_royalty_percentage: number;
    // Royalti mengikuti MOU distribusi buku yang sudah ditandatangani.
    mou_id: number | null;
    quantity_sold: number;
    voucher_deduction: number;
    royalty_amount: number;
    external_quantity_sold: number;
    external_royalty_amount: number;
    // Sumber ketiga: ebook di Tartila Book (pembelian + bacaan).
    reader_orders: number;
    reader_read_events: number;
    reader_share_percent: number;
    reader_purchase_royalty: number;
    reader_read_royalty: number;
    reader_royalty_amount: number;
    total_quantity_sold: number;
    total_royalty_amount: number;
    external_sales: ExternalSale[];
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function RoyaltyPage() {
    const [books, setBooks] = useState<RoyaltyBook[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        royaltyApi
            .mine()
            .then((response) => setBooks(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-6">
            <MyMouList />
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Royalti Saya
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Daftar buku Anda yang sudah terbit beserta royalti yang
                    didapat. Buku dengan MOU distribusi memakai royalti buku
                    fisik dan ebook sesuai MOU. Buku lama tanpa MOU: paket
                    penerbit biasa 25%; Book Chapter 25% dibagi jumlah bab,
                    sesuai bab yang Anda tulis (editor proyek mendapat 5%). Buku
                    terjual dihitung dari pesanan buku fisik yang sudah selesai,
                    ditambah penjualan luar sistem yang dicatat admin. Sumber
                    ketiga adalah ebook di Tartila Book: royalti dari pembelian
                    ebook dan dari jumlah bacaan halaman oleh pembaca lain.
                    Royalti ebook dihitung dari pengaturan yang berlaku saat
                    ini.
                </p>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : books.length === 0 ? (
                    <p className="text-oxford-navy-900/70 text-sm">
                        Belum ada buku Anda yang sudah terbit.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {books.map((book) => (
                            <div
                                key={`${book.id}-${book.role}`}
                                className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <div>
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {book.title}
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        {book.role === 'editor'
                                            ? 'Editor proyek'
                                            : 'Penulis'}{' '}
                                        — {book.package_label}
                                        {book.chapters_count !== null
                                            ? ` (${book.chapters_count} dari ${book.total_chapters} bab)`
                                            : book.role === 'author' &&
                                                book.authors_count > 1
                                              ? ` (${book.authors_count} penulis)`
                                              : ''}
                                        . Royalti buku fisik{' '}
                                        {book.royalty_percentage}%
                                        {book.ebook_royalty_percentage !==
                                            book.royalty_percentage &&
                                            `, ebook ${book.ebook_royalty_percentage}%`}{' '}
                                        dari harga{' '}
                                        {rupiahFormatter.format(
                                            Number(book.price)
                                        )}
                                    </p>
                                    {book.mou_id && (
                                        <Link
                                            to={`/dashboard/mou/${book.mou_id}`}
                                            className="text-forest-moss-700 text-xs hover:underline"
                                        >
                                            Sesuai MOU distribusi buku →
                                        </Link>
                                    )}
                                </div>

                                <div className="flex flex-row flex-wrap gap-6">
                                    <div>
                                        <p className="text-oxford-navy-900/55 text-xs">
                                            Total Buku Terjual
                                        </p>
                                        <p className="text-oxford-navy-900 font-semibold">
                                            {book.total_quantity_sold}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-oxford-navy-900/55 text-xs">
                                            Total Royalti Didapat
                                        </p>
                                        <p className="text-forest-moss-700 font-semibold">
                                            {rupiahFormatter.format(
                                                book.total_royalty_amount
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-oxford-navy-900/55 text-xs">
                                            Lewat Tartila Press
                                        </p>
                                        <p className="text-oxford-navy-900/80 text-sm">
                                            {book.quantity_sold} buku —{' '}
                                            {rupiahFormatter.format(
                                                book.royalty_amount
                                            )}
                                        </p>
                                        {book.voucher_deduction > 0 && (
                                            <p className="text-oxford-navy-900/55 text-xs">
                                                Sudah dipotong voucher{' '}
                                                {rupiahFormatter.format(
                                                    book.voucher_deduction
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-oxford-navy-900/55 text-xs">
                                            Luar Sistem
                                        </p>
                                        <p className="text-oxford-navy-900/80 text-sm">
                                            {book.external_quantity_sold} buku —{' '}
                                            {rupiahFormatter.format(
                                                book.external_royalty_amount
                                            )}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-oxford-navy-900/55 text-xs">
                                            Ebook Tartila Book
                                        </p>
                                        <p className="text-oxford-navy-900/80 text-sm">
                                            {book.reader_orders} pembelian,{' '}
                                            {book.reader_read_events} bacaan —{' '}
                                            {rupiahFormatter.format(
                                                book.reader_royalty_amount
                                            )}
                                        </p>
                                        {book.reader_royalty_amount > 0 && (
                                            <p className="text-oxford-navy-900/55 text-xs">
                                                Pembelian{' '}
                                                {rupiahFormatter.format(
                                                    book.reader_purchase_royalty
                                                )}{' '}
                                                + bacaan{' '}
                                                {rupiahFormatter.format(
                                                    book.reader_read_royalty
                                                )}
                                                {book.reader_share_percent <
                                                    100 &&
                                                    ` (bagian Anda ${book.reader_share_percent}%)`}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {book.external_sales.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <p className="text-oxford-navy-900/80 text-sm font-semibold">
                                            Penjualan Luar Sistem
                                        </p>
                                        {book.external_sales.map((sale) => (
                                            <div
                                                key={sale.id}
                                                className="flex flex-row items-center justify-between gap-3 text-sm bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg px-3 py-2"
                                            >
                                                <span className="text-oxford-navy-900/80">
                                                    {sale.marketplace_name}
                                                    <span className="ml-1 text-oxford-navy-900/55 text-xs">
                                                        (
                                                        {sale.format === 'ebook'
                                                            ? 'ebook'
                                                            : 'buku fisik'}
                                                        )
                                                    </span>
                                                </span>
                                                <span className="text-oxford-navy-900/65">
                                                    {rupiahFormatter.format(
                                                        Number(
                                                            sale.original_price
                                                        )
                                                    )}{' '}
                                                    × {sale.quantity_sold}
                                                </span>
                                                <span className="text-forest-moss-700 font-semibold">
                                                    {rupiahFormatter.format(
                                                        sale.royalty_amount
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
