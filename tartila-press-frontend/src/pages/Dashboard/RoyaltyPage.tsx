import { useEffect, useState } from 'react';
import * as royaltyApi from '@/data/royalty/royaltyApi';

type ExternalSale = {
    id: number;
    marketplace_name: string;
    original_price: string;
    quantity_sold: number;
    royalty_amount: number;
};

type RoyaltyBook = {
    id: number;
    title: string;
    price: string;
    royalty_percentage: string;
    quantity_sold: number;
    royalty_amount: number;
    external_quantity_sold: number;
    external_royalty_amount: number;
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
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <h5 className="text-white text-xl font-semibold">Royalti Saya</h5>
            <p className="text-white/60 text-sm">
                Buku terjual dihitung dari pesanan buku fisik yang sudah
                selesai, ditambah penjualan luar sistem yang dicatat admin.
            </p>

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
            ) : books.length === 0 ? (
                <p className="text-white/70 text-sm">
                    Belum ada buku Anda dengan royalti aktif.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {books.map((book) => (
                        <div
                            key={book.id}
                            className="flex flex-col gap-3 bg-oxford-navy-900/40 rounded-lg p-4"
                        >
                            <div>
                                <p className="text-white font-semibold">
                                    {book.title}
                                </p>
                                <p className="text-white/60 text-sm">
                                    Royalti: {book.royalty_percentage}% dari
                                    harga{' '}
                                    {rupiahFormatter.format(
                                        Number(book.price)
                                    )}
                                </p>
                            </div>

                            <div className="flex flex-row flex-wrap gap-6">
                                <div>
                                    <p className="text-white/50 text-xs">
                                        Total Buku Terjual
                                    </p>
                                    <p className="text-white font-semibold">
                                        {book.total_quantity_sold}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-white/50 text-xs">
                                        Total Royalti Didapat
                                    </p>
                                    <p className="text-forest-moss-300 font-semibold">
                                        {rupiahFormatter.format(
                                            book.total_royalty_amount
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-white/50 text-xs">
                                        Lewat Tartila Press
                                    </p>
                                    <p className="text-white/80 text-sm">
                                        {book.quantity_sold} buku —{' '}
                                        {rupiahFormatter.format(
                                            book.royalty_amount
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-white/50 text-xs">
                                        Luar Sistem
                                    </p>
                                    <p className="text-white/80 text-sm">
                                        {book.external_quantity_sold} buku —{' '}
                                        {rupiahFormatter.format(
                                            book.external_royalty_amount
                                        )}
                                    </p>
                                </div>
                            </div>

                            {book.external_sales.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <p className="text-white/80 text-sm font-semibold">
                                        Penjualan Luar Sistem
                                    </p>
                                    {book.external_sales.map((sale) => (
                                        <div
                                            key={sale.id}
                                            className="flex flex-row items-center justify-between gap-3 text-sm bg-oxford-navy-900/40 rounded-lg px-3 py-2"
                                        >
                                            <span className="text-white/80">
                                                {sale.marketplace_name}
                                            </span>
                                            <span className="text-white/60">
                                                {rupiahFormatter.format(
                                                    Number(
                                                        sale.original_price
                                                    )
                                                )}{' '}
                                                × {sale.quantity_sold}
                                            </span>
                                            <span className="text-forest-moss-300 font-semibold">
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
    );
}
