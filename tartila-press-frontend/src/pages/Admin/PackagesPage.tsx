import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

type PackageItem = {
    id: number;
    name: string;
    photo: string | null;
    category: string | null;
    price: string;
    discount: number;
    description: string | null;
    facilities: string[] | null;
    services: string[] | null;
    terms: string[] | null;
    is_active: boolean;
};

type FormState = {
    name: string;
    photo: string;
    category: string;
    price: string;
    discount: string;
    description: string;
    facilities: string[];
    services: string[];
    terms: string[];
};

const emptyForm: FormState = {
    name: '',
    photo: '',
    category: '',
    price: '',
    discount: '0',
    description: '',
    facilities: [],
    services: [],
    terms: [],
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
            <label className="text-white">{label}</label>
            <div className="flex flex-row gap-2">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="flex-1 p-2 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white outline-none"
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
                        className="flex flex-row items-center justify-between text-white/80 text-sm bg-oxford-navy-900/40 rounded px-3 py-1"
                    >
                        {item}
                        <button
                            type="button"
                            onClick={() =>
                                onChange(items.filter((_, i) => i !== index))
                            }
                            className="text-red-400 hover:text-red-300"
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
            price: pkg.price,
            discount: String(pkg.discount),
            description: pkg.description ?? '',
            facilities: pkg.facilities ?? [],
            services: pkg.services ?? [],
            terms: pkg.terms ?? [],
        });
    }

    function resetForm() {
        setEditingId(null);
        setForm(emptyForm);
    }

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        const payload = {
            name: form.name,
            photo: form.photo || undefined,
            category: form.category || undefined,
            price: form.price,
            discount: Number(form.discount) || 0,
            description: form.description || undefined,
            facilities: form.facilities,
            services: form.services,
            terms: form.terms,
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
            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    {editingId ? 'Ubah Paket' : 'Tambah Paket'}
                </h5>

                <Input
                    label="Nama Paket"
                    value={form.name}
                    onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                    }
                    required
                />
                <ImageInput
                    label="Foto"
                    value={form.photo}
                    onChange={(value) =>
                        setForm({ ...form, photo: value })
                    }
                    folder="packages"
                />
                <Input
                    label="Kategori"
                    value={form.category}
                    onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                    }
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
                    value={form.discount}
                    onChange={(e) =>
                        setForm({ ...form, discount: e.target.value })
                    }
                />
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
                    onChange={(items) =>
                        setForm({ ...form, services: items })
                    }
                />
                <ListEditor
                    label="Ketentuan"
                    items={form.terms}
                    onChange={(items) => setForm({ ...form, terms: items })}
                />

                {statusMessage && (
                    <p className="text-red-400 text-sm">{statusMessage}</p>
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

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Daftar Paket
                </h5>

                {isLoading ? (
                    <p className="text-white/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {packages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <div>
                                    <p className="text-white font-semibold">
                                        {pkg.name}{' '}
                                        {!pkg.is_active && (
                                            <span className="text-red-400 text-xs">
                                                (nonaktif)
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-white/60 text-sm">
                                        Rp {pkg.price} — diskon{' '}
                                        {pkg.discount}%
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
                                        onClick={() =>
                                            handleToggleActive(pkg)
                                        }
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
