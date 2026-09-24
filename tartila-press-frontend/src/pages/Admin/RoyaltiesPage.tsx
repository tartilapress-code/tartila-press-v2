import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import type {
    RoyaltySummary,
    ExternalSale,
    ExternalSalePayload,
} from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

type SaleFormState = {
    marketplace_name: string;
    original_price: string;
    discount_percentage: string;
    discounted_price: string;
    quantity_sold: string;
};

const emptySaleForm: SaleFormState = {
    marketplace_name: '',
    original_price: '',
    discount_percentage: '',
    discounted_price: '',
    quantity_sold: '',
};

function saleFormToPayload(form: SaleFormState): ExternalSalePayload {
    return {
        marketplace_name: form.marketplace_name,
        original_price: form.original_price,
        discount_percentage:
            form.discount_percentage === ''
                ? null
                : Number(form.discount_percentage),
        discounted_price:
            form.discounted_price === '' ? null : form.discounted_price,
        quantity_sold: Number(form.quantity_sold) || 0,
    };
}

function ExternalSaleRow({
    sale,
    onSaved,
}: {
    sale: ExternalSale;
    onSaved: () => void;
}) {
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [form, setForm] = useState<SaleFormState>({
        marketplace_name: sale.marketplace_name,
        original_price: sale.original_price,
        discount_percentage:
            sale.discount_percentage === null
                ? ''
                : String(sale.discount_percentage),
        discounted_price: sale.discounted_price ?? '',
        quantity_sold: String(sale.quantity_sold),
    });
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleSave() {
        setIsSaving(true);
        setError('');

        try {
            await adminApi.updateExternalSale(sale.id, saleFormToPayload(form));
            setIsEditing(false);
            onSaved();
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal menyimpan penjualan.'
            );
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        await adminApi.deleteExternalSale(sale.id);
        onSaved();
    }

    if (isEditing) {
        return (
            <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <Input
                        label="Nama Lapak"
                        value={form.marketplace_name}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                marketplace_name: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Harga Asli"
                        value={form.original_price}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                original_price: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Diskon (%)"
                        value={form.discount_percentage}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                discount_percentage: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Harga Setelah Diskon"
                        value={form.discounted_price}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                discounted_price: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Jumlah Terjual"
                        value={form.quantity_sold}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                quantity_sold: e.target.value,
                            })
                        }
                    />
                </div>
                {error && <p className="text-red-600 text-xs">{error}</p>}
                <div className="flex flex-row gap-2">
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                    <Button
                        variant="outline2"
                        onClick={() => setIsEditing(false)}
                        disabled={isSaving}
                    >
                        Batal
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-row items-center justify-between gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-3">
            <div className="text-oxford-navy-900/80 text-sm flex flex-col">
                <p className="text-oxford-navy-900 font-semibold">
                    {sale.marketplace_name}
                </p>
                <p>
                    Harga asli{' '}
                    {rupiahFormatter.format(Number(sale.original_price))}
                    {sale.discount_percentage
                        ? ` — diskon ${sale.discount_percentage}%`
                        : ''}
                    {sale.discounted_price
                        ? ` (jadi ${rupiahFormatter.format(Number(sale.discounted_price))})`
                        : ''}
                </p>
                <p>Jumlah terjual: {sale.quantity_sold}</p>
            </div>
            <div className="flex flex-row gap-2 shrink-0">
                <button
                    onClick={() => setIsEditing(true)}
                    className="text-forest-moss-700 text-xs hover:text-forest-moss-800 font-semibold"
                >
                    Ubah
                </button>
                <button
                    onClick={handleDelete}
                    className="text-red-600 text-xs hover:text-red-700 font-semibold"
                >
                    Hapus
                </button>
            </div>
        </div>
    );
}

function ExternalSalesManager({
    book,
    onSaved,
}: {
    book: RoyaltySummary;
    onSaved: () => void;
}) {
    const [form, setForm] = useState<SaleFormState>(emptySaleForm);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    async function handleAdd() {
        setIsSubmitting(true);
        setError('');

        try {
            await adminApi.createExternalSale(book.id, saleFormToPayload(form));
            setForm(emptySaleForm);
            onSaved();
        } catch (err) {
            setError(
                err instanceof ApiError
                    ? err.message
                    : 'Gagal mencatat penjualan.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-4">
            <p className="text-oxford-navy-900 font-semibold text-sm">
                Penjualan Luar Sistem
            </p>

            {book.external_sales.length === 0 ? (
                <p className="text-oxford-navy-900/65 text-sm">
                    Belum ada penjualan luar sistem tercatat.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {book.external_sales.map((sale) => (
                        <ExternalSaleRow
                            key={sale.id}
                            sale={sale}
                            onSaved={onSaved}
                        />
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-2 border-t border-forest-moss-100 pt-3">
                <p className="text-oxford-navy-900/80 text-sm">Tambah Penjualan Baru</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <Input
                        label="Nama Lapak"
                        value={form.marketplace_name}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                marketplace_name: e.target.value,
                            })
                        }
                        required
                    />
                    <Input
                        label="Harga Asli"
                        value={form.original_price}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                original_price: e.target.value,
                            })
                        }
                        required
                    />
                    <Input
                        label="Diskon (%)"
                        value={form.discount_percentage}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                discount_percentage: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Harga Setelah Diskon"
                        value={form.discounted_price}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                discounted_price: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Jumlah Terjual"
                        value={form.quantity_sold}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                quantity_sold: e.target.value,
                            })
                        }
                        required
                    />
                </div>
                {error && <p className="text-red-600 text-xs">{error}</p>}
                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleAdd}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Tambah'}
                </Button>
            </div>
        </div>
    );
}

export default function RoyaltiesPage() {
    const [royalties, setRoyalties] = useState<RoyaltySummary[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    function load() {
        adminApi
            .listRoyalties()
            .then((response) => setRoyalties(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Royalti</h5>
            <p className="text-oxford-navy-900/65 text-sm">
                Buku yang sudah diberi nilai royalti (atur lewat halaman
                Buku). Jumlah terjual dihitung otomatis dari pesanan yang
                sudah selesai, ditambah penjualan luar sistem yang dicatat
                manual di sini.
            </p>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : royalties.length === 0 ? (
                <p className="text-oxford-navy-900/70 text-sm">
                    Belum ada buku dengan nilai royalti. Atur Royalti (%)
                    lewat halaman Buku terlebih dahulu.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {royalties.map((book) => (
                        <div
                            key={book.id}
                            className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div className="flex flex-row items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {book.title}
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        {book.author?.name ??
                                            book.authors_text}{' '}
                                        — Royalti {book.royalty_percentage}%
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        Harga:{' '}
                                        {rupiahFormatter.format(
                                            Number(book.price)
                                        )}
                                    </p>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="text-oxford-navy-900/70">
                                        Jumlah Order:{' '}
                                        {book.total_orders_count}
                                    </p>
                                    <p className="text-oxford-navy-900/70">
                                        Jumlah Selesai:{' '}
                                        {book.completed_orders_count}
                                    </p>
                                    <p className="text-oxford-navy-900/70">
                                        Total Terjual:{' '}
                                        {book.total_quantity_sold}
                                    </p>
                                    <p className="text-forest-moss-700 font-semibold">
                                        Total Royalti:{' '}
                                        {rupiahFormatter.format(
                                            book.total_royalty_amount
                                        )}
                                    </p>
                                </div>
                            </div>

                            <Button
                                variant="outline2"
                                className="self-start"
                                onClick={() =>
                                    setExpandedId(
                                        expandedId === book.id
                                            ? null
                                            : book.id
                                    )
                                }
                            >
                                {expandedId === book.id
                                    ? 'Tutup Detail'
                                    : 'Detail & Penjualan Luar Sistem'}
                            </Button>

                            {expandedId === book.id && (
                                <ExternalSalesManager
                                    book={book}
                                    onSaved={load}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
