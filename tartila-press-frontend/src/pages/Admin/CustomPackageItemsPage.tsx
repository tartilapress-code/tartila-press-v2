import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import Badge from '@/components/Badge';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

type ItemRecord = {
    id: number;
    type: 'facility' | 'service';
    name: string;
    price: string;
    discount: number;
    final_price: number;
    book_chapter_cost: string | null;
    description: string | null;
    is_active: boolean;
};

type ItemForm = {
    type: 'facility' | 'service';
    name: string;
    price: string;
    discount: string;
    book_chapter_cost: string;
    description: string;
};

const emptyForm: ItemForm = {
    type: 'facility',
    name: '',
    price: '',
    discount: '0',
    book_chapter_cost: '',
    description: '',
};

const typeOptions = [
    { value: 'facility', label: 'Fasilitas' },
    { value: 'service', label: 'Layanan' },
];

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function CustomPackageItemsPage() {
    const [items, setItems] = useState<ItemRecord[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [form, setForm] = useState<ItemForm>(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function loadItems() {
        adminApi
            .listCustomItems()
            .then((response) => setItems(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        loadItems();
    }, []);

    function resetForm() {
        setEditingId(null);
        setForm(emptyForm);
        setStatusMessage('');
    }

    function startEdit(item: ItemRecord) {
        setEditingId(item.id);
        setForm({
            type: item.type,
            name: item.name,
            price: String(Number(item.price)),
            discount: String(item.discount),
            book_chapter_cost:
                item.book_chapter_cost === null
                    ? ''
                    : String(Number(item.book_chapter_cost)),
            description: item.description ?? '',
        });
        setStatusMessage('');
    }

    async function handleSubmit() {
        const discount =
            form.discount.trim() === '' ? 0 : Number(form.discount);

        if (!Number.isInteger(discount) || discount < 0 || discount > 100) {
            setStatusMessage(
                'Diskon harus berupa angka bulat antara 0 dan 100.'
            );
            return;
        }

        setIsSubmitting(true);
        setStatusMessage('');

        const payload = {
            type: form.type,
            name: form.name,
            price: form.price,
            discount,
            book_chapter_cost:
                form.book_chapter_cost.trim() === ''
                    ? null
                    : form.book_chapter_cost,
            description: form.description.trim() || null,
        };

        try {
            if (editingId) {
                await adminApi.updateCustomItem(editingId, payload);
            } else {
                await adminApi.createCustomItem(payload);
            }
            resetForm();
            loadItems();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleToggleActive(item: ItemRecord) {
        await adminApi.updateCustomItem(item.id, {
            is_active: !item.is_active,
        });
        loadItems();
    }

    async function handleDelete(id: number) {
        await adminApi.deleteCustomItem(id);

        if (editingId === id) {
            resetForm();
        }

        loadItems();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    {editingId
                        ? 'Ubah Item Paket Custom'
                        : 'Tambah Item Paket Custom'}
                </h5>

                <Select
                    name="type"
                    label="Tipe"
                    option_data={typeOptions}
                    value={form.type}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            type: e.target.value as 'facility' | 'service',
                        })
                    }
                />
                <Input
                    label="Nama"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                />
                <Input
                    label="Harga"
                    value={form.price}
                    onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                    }
                    required
                />
                <Input
                    label="Diskon (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={form.discount}
                    onChange={(e) =>
                        setForm({ ...form, discount: e.target.value })
                    }
                />
                <Input
                    label="Biaya khusus Book Chapter (Rp) — opsional"
                    type="number"
                    min="0"
                    value={form.book_chapter_cost}
                    onChange={(e) =>
                        setForm({ ...form, book_chapter_cost: e.target.value })
                    }
                />
                <small className="text-oxford-navy-900/65 -mt-2">
                    Biaya item ini bila dicentang pada proyek Book Chapter
                    (dipotong dari total harga bab). Kosongkan = gratis.
                </small>

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-oxford-navy-900">Deskripsi</label>
                    <textarea
                        className="w-full p-3 outline-none rounded-xl ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 focus:ring-1 focus:ring-oxford-navy-500"
                        rows={4}
                        value={form.description}
                        onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                        }
                    />
                    <small className="text-oxford-navy-900/65">
                        Penjelasan singkat yang tampil di bawah nama item saat
                        user merakit paket custom.
                    </small>
                </div>

                {statusMessage && (
                    <p className="text-red-600 text-sm">{statusMessage}</p>
                )}

                <div className="flex flex-row gap-2">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting
                            ? 'Menyimpan...'
                            : editingId
                              ? 'Simpan Perubahan'
                              : 'Tambah'}
                    </Button>
                    {editingId && (
                        <Button variant="outline2" onClick={resetForm}>
                            Batal
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Daftar Item
                </h5>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <div className="flex flex-col gap-1">
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {item.name}{' '}
                                        {!item.is_active && (
                                            <span className="text-red-600 text-xs">
                                                (nonaktif)
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex flex-row flex-wrap items-center gap-2 text-oxford-navy-900/65 text-sm">
                                        <span>
                                            {item.type === 'facility'
                                                ? 'Fasilitas'
                                                : 'Layanan'}
                                            {' — '}
                                        </span>
                                        {item.discount > 0 ? (
                                            <>
                                                <span className="line-through text-oxford-navy-900/45">
                                                    {rupiahFormatter.format(
                                                        Number(item.price)
                                                    )}
                                                </span>
                                                <span className="text-forest-moss-700">
                                                    {rupiahFormatter.format(
                                                        item.final_price
                                                    )}
                                                </span>
                                                <Badge variant="primary">
                                                    Diskon {item.discount}%
                                                </Badge>
                                            </>
                                        ) : (
                                            <span>
                                                {rupiahFormatter.format(
                                                    Number(item.price)
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-oxford-navy-900/55 text-xs">
                                        Book Chapter:{' '}
                                        {item.book_chapter_cost === null
                                            ? 'gratis'
                                            : rupiahFormatter.format(
                                                  Number(item.book_chapter_cost)
                                              )}
                                    </p>
                                    {item.description && (
                                        <p className="text-oxford-navy-900/55 text-sm whitespace-pre-line line-clamp-3">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-row flex-wrap gap-2 sm:shrink-0">
                                    <Button
                                        variant="outline2"
                                        onClick={() => startEdit(item)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() => handleToggleActive(item)}
                                    >
                                        {item.is_active
                                            ? 'Nonaktifkan'
                                            : 'Aktifkan'}
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() => handleDelete(item.id)}
                                    >
                                        Hapus
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
