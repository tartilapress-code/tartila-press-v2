import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';
import { ISBN_TYPES, type IsbnType } from '@/lib/isbnTypes';

const ISBN_LABEL: Record<IsbnType, string> = {
    print: 'ISBN Cetak',
    electronic: 'ISBN Digital',
    both: 'ISBN Cetak + Digital',
};

type IsbnPriceForm = Record<IsbnType, { on: boolean; price: string }>;

const emptyIsbn = (): IsbnPriceForm => ({
    print: { on: true, price: '' },
    electronic: { on: false, price: '' },
    both: { on: false, price: '' },
});

type PackageItem = {
    id: number;
    name: string;
    photo: string | null;
    category: string | null;
    price: string;
    isbn_prices: Partial<Record<IsbnType, number>> | null;
    discount: number;
    description: string | null;
    facilities: string[] | null;
    services: string[] | null;
    terms: string[] | null;
    is_active: boolean;
    free_copies: number;
};

type FormState = {
    name: string;
    photo: string;
    category: string;
    isbn: IsbnPriceForm;
    discount: string;
    description: string;
    facilities: string[];
    services: string[];
    terms: string[];
    free_copies: string;
};

const emptyForm: FormState = {
    name: '',
    photo: '',
    category: '',
    isbn: emptyIsbn(),
    discount: '0',
    description: '',
    facilities: [],
    services: [],
    terms: [],
    free_copies: '0',
};

function ListEditor({
    label,
    items,
    onChange,
}: {
    label: string;
    items: string[];
    onChange: (items: string[]) => void;
}) {
    const [draft, setDraft] = useState<string>('');

    function addItem() {
        if (!draft.trim()) {
            return;
        }
        onChange([...items, draft.trim()]);
        setDraft('');
    }

    return (
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-oxford-navy-900">
                {label}
            </label>
            <div className="flex flex-row gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 outline-none"
                    placeholder={`Tambah ${label.toLowerCase()}...`}
                />
                <Button type="button" variant="outline2" onClick={addItem}>
                    Tambah
                </Button>
            </div>
            <ul className="flex flex-col gap-1">
                {items.map((item, index) => (
                    <li
                        key={`${item}-${index}`}
                        className="flex flex-row items-center justify-between text-oxford-navy-900/80 text-sm bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded px-3 py-1"
                    >
                        {item}
                        <button
                            type="button"
                            onClick={() =>
                                onChange(items.filter((_, i) => i !== index))
                            }
                            className="text-red-600 hover:text-red-700"
                        >
                            Hapus
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function PackagesPage() {
    const [packages, setPackages] = useState<PackageItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function loadPackages() {
        adminApi
            .listPackages()
            .then((response) => setPackages(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        loadPackages();
    }, []);

    function startEdit(pkg: PackageItem) {
        setEditingId(pkg.id);
        setForm({
            name: pkg.name,
            photo: pkg.photo ?? '',
            category: pkg.category ?? '',
            isbn: ISBN_TYPES.reduce((form, type) => {
                const price = pkg.isbn_prices?.[type];

                form[type] = {
                    on: price !== undefined,
                    price: price !== undefined ? String(price) : '',
                };

                return form;
            }, emptyIsbn()),
            discount: String(pkg.discount),
            description: pkg.description ?? '',
            facilities: pkg.facilities ?? [],
            services: pkg.services ?? [],
            terms: pkg.terms ?? [],
            free_copies: String(pkg.free_copies ?? 0),
        });
    }

    function resetForm() {
        setEditingId(null);
        setForm({ ...emptyForm, isbn: emptyIsbn() });
    }

    async function handleSubmit() {
        setStatusMessage('');

        // Admin wajib memilih minimal satu jenis ISBN beserta harganya.
        const chosen = ISBN_TYPES.filter((type) => form.isbn[type].on);

        if (chosen.length === 0) {
            setStatusMessage('Pilih minimal satu jenis ISBN untuk paket ini.');
            return;
        }

        const missing = chosen.find(
            (type) => form.isbn[type].price.trim() === ''
        );

        if (missing) {
            setStatusMessage(`Isi harga untuk ${ISBN_LABEL[missing]}.`);
            return;
        }

        setIsSubmitting(true);

        const payload = {
            name: form.name,
            photo: form.photo || undefined,
            category: form.category || undefined,
            isbn_prices: Object.fromEntries(
                chosen.map((type) => [type, Number(form.isbn[type].price)])
            ),
            discount: Number(form.discount) || 0,
            description: form.description || undefined,
            facilities: form.facilities,
            services: form.services,
            terms: form.terms,
            free_copies: Math.max(0, Math.floor(Number(form.free_copies) || 0)),
        };

        try {
            if (editingId) {
                await adminApi.updatePackage(editingId, payload);
            } else {
                await adminApi.createPackage(payload);
            }
            resetForm();
            loadPackages();
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

    async function handleToggleActive(pkg: PackageItem) {
        await adminApi.updatePackage(pkg.id, { is_active: !pkg.is_active });
        loadPackages();
    }

    async function handleDelete(id: number) {
        await adminApi.deletePackage(id);
        loadPackages();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    {editingId ? 'Ubah Paket' : 'Tambah Paket'}
                </h5>

                <Input
                    label="Nama Paket"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                />
                <ImageInput
                    label="Foto"
                    value={form.photo}
                    onChange={(value) => setForm({ ...form, photo: value })}
                    folder="packages"
                />
                <Input
                    label="Kategori"
                    value={form.category}
                    onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                    }
                />
                <fieldset className="flex flex-col gap-3 rounded-xl bg-forest-moss-50/60 p-4 ring-1 ring-forest-moss-100">
                    <legend className="px-1 text-sm font-semibold text-oxford-navy-900">
                        Jenis ISBN & harga (wajib pilih minimal satu)
                    </legend>
                    <p className="text-xs text-oxford-navy-900/65">
                        Centang jenis ISBN yang ditawarkan paket ini dan isi
                        harga tiap jenis. Harga ISBN Cetak adalah harga yang
                        tampil bawaan; pembeli memilih jenis ISBN saat memesan.
                        Jenis ISBN menentukan MOU dan jenis royalti (cetak =
                        buku fisik, digital = ebook).
                    </p>
                    {ISBN_TYPES.map((type) => (
                        <div
                            key={type}
                            className="flex flex-row flex-wrap items-center gap-3"
                        >
                            <label className="flex w-52 items-center gap-2 text-sm font-medium text-oxford-navy-900">
                                <input
                                    type="checkbox"
                                    checked={form.isbn[type].on}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            isbn: {
                                                ...form.isbn,
                                                [type]: {
                                                    ...form.isbn[type],
                                                    on: e.target.checked,
                                                },
                                            },
                                        })
                                    }
                                />
                                {ISBN_LABEL[type]}
                            </label>
                            <input
                                type="number"
                                min="0"
                                aria-label={`Harga ${ISBN_LABEL[type]}`}
                                disabled={!form.isbn[type].on}
                                value={form.isbn[type].price}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        isbn: {
                                            ...form.isbn,
                                            [type]: {
                                                ...form.isbn[type],
                                                price: e.target.value,
                                            },
                                        },
                                    })
                                }
                                placeholder="Harga (Rp)"
                                className="w-48 rounded-lg bg-transparent p-2 text-oxford-navy-900 outline-none ring-1 ring-forest-moss-200 disabled:opacity-40"
                            />
                        </div>
                    ))}
                </fieldset>
                <Input
                    label="Diskon (%)"
                    value={form.discount}
                    onChange={(e) =>
                        setForm({ ...form, discount: e.target.value })
                    }
                />
                <Input
                    label="Eksemplar buku gratis (N)"
                    type="number"
                    min="0"
                    value={form.free_copies}
                    onChange={(e) =>
                        setForm({ ...form, free_copies: e.target.value })
                    }
                />
                <small className="text-oxford-navy-900/65 -mt-2">
                    Jumlah buku cetak yang diberikan paket ini. Dipakai di
                    Keuangan: biaya cetak = 20% harga jual × (3 + N).
                </small>
                <Input
                    label="Keterangan"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />

                <ListEditor
                    label="Fasilitas"
                    items={form.facilities}
                    onChange={(items) =>
                        setForm({ ...form, facilities: items })
                    }
                />
                <ListEditor
                    label="Layanan"
                    items={form.services}
                    onChange={(items) => setForm({ ...form, services: items })}
                />
                <ListEditor
                    label="Ketentuan"
                    items={form.terms}
                    onChange={(items) => setForm({ ...form, terms: items })}
                />

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
                              : 'Tambah Paket'}
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
                    Daftar Paket
                </h5>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {packages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <div>
                                    <p className="text-oxford-navy-900 font-semibold">
                                        {pkg.name}{' '}
                                        {!pkg.is_active && (
                                            <span className="text-red-600 text-xs">
                                                (nonaktif)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-oxford-navy-900/65 text-sm">
                                        {ISBN_TYPES.filter(
                                            (type) =>
                                                pkg.isbn_prices?.[type] !==
                                                undefined
                                        )
                                            .map(
                                                (type) =>
                                                    `${ISBN_LABEL[type]} Rp ${pkg.isbn_prices?.[type]}`
                                            )
                                            .join(' · ') ||
                                            `Rp ${pkg.price}`}{' '}
                                        — diskon {pkg.discount}%
                                    </p>
                                </div>
                                <div className="flex flex-row gap-2 shrink-0">
                                    <Button
                                        variant="outline2"
                                        onClick={() => startEdit(pkg)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() => handleToggleActive(pkg)}
                                    >
                                        {pkg.is_active
                                            ? 'Nonaktifkan'
                                            : 'Aktifkan'}
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() => handleDelete(pkg.id)}
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
