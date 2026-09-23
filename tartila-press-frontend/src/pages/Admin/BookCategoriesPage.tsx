import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

type Category = { id: number; name: string };

export default function BookCategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [name, setName] = useState<string>('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function load() {
        adminApi
            .listBookCategoriesAdmin()
            .then((response) => setCategories(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
    }, []);

    function resetForm() {
        setEditingId(null);
        setName('');
    }

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            if (editingId) {
                await adminApi.updateBookCategory(editingId, { name });
            } else {
                await adminApi.createBookCategory({ name });
            }
            resetForm();
            load();
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

    async function handleDelete(id: number) {
        await adminApi.deleteBookCategory(id);
        load();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    {editingId ? 'Ubah Kategori Buku' : 'Tambah Kategori Buku'}
                </h5>
                <Input
                    label="Nama Kategori"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
                {statusMessage && (
                    <p className="text-red-400 text-sm">{statusMessage}</p>
                )}
                <div className="flex flex-row gap-2">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim()}
                    >
                        {isSubmitting
                            ? 'Menyimpan...'
                            : editingId
                              ? 'Simpan Perubahan'
                              : 'Tambah Kategori'}
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
                    Daftar Kategori Buku
                </h5>
                {isLoading ? (
                    <p className="text-white/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {categories.map((category) => (
                            <div
                                key={category.id}
                                className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <p className="text-white font-semibold">
                                    {category.name}
                                </p>
                                <div className="flex flex-row gap-2 shrink-0">
                                    <Button
                                        variant="outline2"
                                        onClick={() => {
                                            setEditingId(category.id);
                                            setName(category.name);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline2"
                                        onClick={() =>
                                            handleDelete(category.id)
                                        }
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
