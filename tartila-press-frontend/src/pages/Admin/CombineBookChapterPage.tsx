import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ContentLanguageField from '@/components/language/ContentLanguageField';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import type { BookPayload } from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';
import type { ContentLanguage } from '@/lib/contentLanguages';

type Category = { id: number; name: string };

type ManuscriptItem = {
    id: number;
    title: string;
    status: string;
    user: { id: number; name: string };
    book: unknown | null;
    book_chapter: unknown | null;
};

type FormState = {
    title: string;
    isbn: string;
    front_cover: string;
    back_cover: string;
    description: string;
    book_category_id: string;
    field_category_id: string;
    languages: ContentLanguage[];
    price: string;
    discount: string;
};

const emptyForm: FormState = {
    title: '',
    isbn: '',
    front_cover: '',
    back_cover: '',
    description: '',
    book_category_id: '',
    field_category_id: '',
    languages: [],
    price: '',
    discount: '0',
};

export default function CombineBookChapterPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [manuscripts, setManuscripts] = useState<ManuscriptItem[]>([]);
    const [bookCategories, setBookCategories] = useState<Category[]>([]);
    const [fieldCategories, setFieldCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    useEffect(() => {
        Promise.all([
            adminApi.listManuscripts('completed'),
            adminApi.listBookCategoriesAdmin(),
            adminApi.listFieldCategoriesAdmin(),
        ])
            .then(([manuscriptRes, bookCategoryRes, fieldCategoryRes]) => {
                setManuscripts(
                    manuscriptRes.data.filter(
                        (manuscript: ManuscriptItem) =>
                            !manuscript.book && !manuscript.book_chapter
                    )
                );
                setBookCategories(bookCategoryRes.data);
                setFieldCategories(fieldCategoryRes.data);
            })
            .finally(() => setIsLoading(false));
    }, []);

    function toggleSelect(id: number) {
        setSelectedIds((previous) => {
            if (previous.includes(id)) {
                return previous.filter((item) => item !== id);
            }
            return [...previous, id];
        });
    }

    function moveUp(index: number) {
        if (index === 0) return;
        setSelectedIds((previous) => {
            const next = [...previous];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            return next;
        });
    }

    function moveDown(index: number) {
        setSelectedIds((previous) => {
            if (index === previous.length - 1) return previous;
            const next = [...previous];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            return next;
        });
    }

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        const payload: BookPayload & { manuscript_ids: number[] } = {
            title: form.title,
            isbn: form.isbn || undefined,
            front_cover: form.front_cover || undefined,
            back_cover: form.back_cover || undefined,
            description: form.description || undefined,
            book_category_id: form.book_category_id || undefined,
            field_category_id: form.field_category_id || undefined,
            languages: form.languages,
            price: form.price,
            discount: Number(form.discount) || 0,
            manuscript_ids: selectedIds,
        };

        try {
            await adminApi.combineBookChapters(payload);
            navigate('/admin/books');
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

    const selectedManuscripts = selectedIds
        .map((id) => manuscripts.find((manuscript) => manuscript.id === id))
        .filter((manuscript): manuscript is ManuscriptItem => !!manuscript);

    return (
        <div className="flex flex-col gap-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Gabungkan Naskah jadi Book Chapter
            </h5>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h6 className="text-oxford-navy-900 font-semibold">
                    1. Pilih Naskah (status selesai, belum diterbitkan)
                </h6>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : manuscripts.length === 0 ? (
                    <p className="text-oxford-navy-900/65 text-sm">
                        Tidak ada naskah selesai yang tersedia untuk
                        digabungkan.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {manuscripts.map((manuscript) => (
                            <label
                                key={manuscript.id}
                                className="flex flex-row items-center gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.includes(
                                        manuscript.id
                                    )}
                                    onChange={() =>
                                        toggleSelect(manuscript.id)
                                    }
                                />
                                <span className="text-oxford-navy-900 text-sm">
                                    {manuscript.title} — {manuscript.user.name}
                                </span>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {selectedManuscripts.length > 0 && (
                <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h6 className="text-oxford-navy-900 font-semibold">
                        2. Urutan Bab
                    </h6>
                    {selectedManuscripts.map((manuscript, index) => (
                        <div
                            key={manuscript.id}
                            className="flex flex-row items-center justify-between bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3"
                        >
                            <span className="text-oxford-navy-900 text-sm">
                                Bab {index + 1} — {manuscript.title}
                            </span>
                            <div className="flex flex-row gap-2">
                                <Button
                                    variant="outline2"
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                >
                                    ↑
                                </Button>
                                <Button
                                    variant="outline2"
                                    onClick={() => moveDown(index)}
                                    disabled={
                                        index ===
                                        selectedManuscripts.length - 1
                                    }
                                >
                                    ↓
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h6 className="text-oxford-navy-900 font-semibold">
                    3. Metadata Buku Gabungan
                </h6>

                <Input
                    label="Judul Buku"
                    value={form.title}
                    onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                    }
                    required
                />
                <Input
                    label="ISBN"
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                />
                <ImageInput
                    label="Sampul Depan"
                    value={form.front_cover}
                    onChange={(value) =>
                        setForm({ ...form, front_cover: value })
                    }
                    folder="covers"
                />
                <ImageInput
                    label="Sampul Belakang"
                    value={form.back_cover}
                    onChange={(value) =>
                        setForm({ ...form, back_cover: value })
                    }
                    folder="covers"
                />
                <Input
                    label="Deskripsi"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />
                <Select
                    name="book_category_id"
                    label="Kategori Buku"
                    option_data={[
                        { value: '', label: 'Tanpa Kategori' },
                        ...bookCategories.map((category) => ({
                            value: String(category.id),
                            label: category.name,
                        })),
                    ]}
                    value={form.book_category_id}
                    onChange={(e) =>
                        setForm({ ...form, book_category_id: e.target.value })
                    }
                />
                <Select
                    name="field_category_id"
                    label="Kategori Keilmuan"
                    option_data={[
                        { value: '', label: 'Tanpa Kategori' },
                        ...fieldCategories.map((category) => ({
                            value: String(category.id),
                            label: category.name,
                        })),
                    ]}
                    value={form.field_category_id}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            field_category_id: e.target.value,
                        })
                    }
                />
                <ContentLanguageField
                    label={t('contentLanguages.field.bookLabel')}
                    hint={t('contentLanguages.field.bookHint')}
                    value={form.languages}
                    onChange={(languages) => setForm({ ...form, languages })}
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

                {statusMessage && (
                    <p className="text-red-600 text-sm">{statusMessage}</p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleSubmit}
                    disabled={
                        isSubmitting ||
                        selectedIds.length < 2 ||
                        !form.title ||
                        !form.price
                    }
                >
                    {isSubmitting ? 'Menyimpan...' : 'Buat Buku Book Chapter'}
                </Button>
            </div>
        </div>
    );
}
