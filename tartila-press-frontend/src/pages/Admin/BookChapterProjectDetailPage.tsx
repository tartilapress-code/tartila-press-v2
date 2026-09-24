import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import BookChapterCostPanel from '@/components/bookChapter/BookChapterCostPanel';
import ChapterRowEditor, {
    type ChapterPatch,
    type EditableChapter,
} from '@/components/bookChapter/ChapterRowEditor';
import PackageOptionsField from '@/components/bookChapter/PackageOptionsField';
import * as adminApi from '@/data/admin/adminApi';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';
import {
    calculateBookChapterCost,
    emptyPackageOptions,
    toNumber,
    type BookChapterCostSettings,
    type PackageItem,
    type PackageOptions,
} from '@/lib/bookChapterCost';

type Category = { id: number; name: string };

type ProjectDetail = {
    id: number;
    title: string;
    price: string;
    discount: number;
    description: string | null;
    front_cover: string | null;
    back_cover: string | null;
    is_active: boolean;
    owner_editor: { id: number; name: string } | null;
    book_category_id: number | null;
    field_category_id: number | null;
    includes_hki: boolean;
    includes_isbn_print: boolean;
    includes_isbn_electronic: boolean;
    package_items: PackageItem[];
    chapters: EditableChapter[];
};

type EditorItem = { user_id: number; name: string };

type Notice = { kind: 'ok' | 'error'; text: string };

function errorText(error: unknown): string {
    return error instanceof ApiError
        ? error.message
        : 'Terjadi kesalahan. Silakan coba lagi.';
}

export default function BookChapterProjectDetailPage() {
    const { id } = useParams<{ id: string }>();

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [bookCategories, setBookCategories] = useState<Category[]>([]);
    const [fieldCategories, setFieldCategories] = useState<Category[]>([]);
    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [settings, setSettings] = useState<BookChapterCostSettings | null>(
        null
    );
    const [activeItems, setActiveItems] = useState<PackageItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [options, setOptions] = useState<PackageOptions>(emptyPackageOptions);

    const [form, setForm] = useState({
        title: '',
        price: '',
        discount: '0',
        description: '',
        front_cover: '',
        back_cover: '',
        book_category_id: '',
        field_category_id: '',
        owner_editor_id: '',
    });

    const [newChapterTitle, setNewChapterTitle] = useState<string>('');
    const [chapterNotice, setChapterNotice] = useState<string>('');

    function applyProject(data: ProjectDetail) {
        setProject(data);
        setForm({
            title: data.title,
            price: String(Number(data.price)),
            discount: String(data.discount),
            description: data.description ?? '',
            front_cover: data.front_cover ?? '',
            back_cover: data.back_cover ?? '',
            book_category_id: data.book_category_id
                ? String(data.book_category_id)
                : '',
            field_category_id: data.field_category_id
                ? String(data.field_category_id)
                : '',
            owner_editor_id: data.owner_editor
                ? String(data.owner_editor.id)
                : '',
        });
        setOptions({
            includes_hki: data.includes_hki,
            includes_isbn_print: data.includes_isbn_print,
            includes_isbn_electronic: data.includes_isbn_electronic,
            package_item_ids: data.package_items.map((item) => item.id),
        });
    }

    function load() {
        return adminApi
            .getBookChapterProjectAdmin(id ?? '')
            .then((response) => applyProject(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        Promise.all([
            adminApi.listBookCategoriesAdmin(),
            adminApi.listFieldCategoriesAdmin(),
            editorApi.directory(),
            adminApi.getBookChapterSettings(),
            adminApi.listCustomItems(),
        ]).then(
            ([
                bookCategoryRes,
                fieldCategoryRes,
                editorRes,
                settingsRes,
                itemsRes,
            ]) => {
                setBookCategories(bookCategoryRes.data);
                setFieldCategories(fieldCategoryRes.data);
                setEditors(editorRes.data);
                setSettings(settingsRes.data);
                setActiveItems(
                    (
                        itemsRes.data as (PackageItem & {
                            is_active: boolean;
                        })[]
                    ).filter((item) => item.is_active)
                );
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function handleSaveDetails() {
        setNotice(null);

        try {
            await adminApi.updateBookChapterProjectAdmin(id ?? '', {
                title: form.title,
                price: form.price,
                discount: Number(form.discount) || 0,
                description: form.description || undefined,
                front_cover: form.front_cover || undefined,
                back_cover: form.back_cover || undefined,
                book_category_id: form.book_category_id || undefined,
                field_category_id: form.field_category_id || undefined,
                owner_editor_id: form.owner_editor_id
                    ? Number(form.owner_editor_id)
                    : null,
                ...options,
            });
            await load();
            setNotice({ kind: 'ok', text: 'Perubahan berhasil disimpan.' });
        } catch (error) {
            setNotice({ kind: 'error', text: errorText(error) });
        }
    }

    async function handleToggleActive() {
        if (!project) return;
        await adminApi.updateBookChapterProjectAdmin(project.id, {
            is_active: !project.is_active,
        });
        await load();
    }

    async function handleAddChapter() {
        if (!newChapterTitle.trim()) return;
        setChapterNotice('');

        try {
            await adminApi.addBookChapterProjectChapterAdmin(id ?? '', {
                title: newChapterTitle,
            });
            setNewChapterTitle('');
            await load();
        } catch (error) {
            setChapterNotice(errorText(error));
        }
    }

    async function handleSaveChapter(chapterId: number, patch: ChapterPatch) {
        await adminApi.updateBookChapterProjectChapterAdmin(chapterId, patch);
        await load();
    }

    async function handleDeleteChapter(chapterId: number) {
        await adminApi.deleteBookChapterProjectChapterAdmin(chapterId);
        await load();
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900/70">Memuat...</p>;
    }

    if (!project) {
        return <p className="text-oxford-navy-900/70">Proyek tidak ditemukan.</p>;
    }

    // Item yang sudah tercentang tapi kini nonaktif tetap tampil supaya bisa
    // dilepas dan biayanya ikut terhitung.
    const items = [
        ...activeItems,
        ...project.package_items.filter(
            (saved) => !activeItems.some((active) => active.id === saved.id)
        ),
    ];

    const costSummary = settings
        ? calculateBookChapterCost(
              {
                  ...options,
                  price: toNumber(form.price),
                  discount: toNumber(form.discount),
                  chapters: project.chapters.map((chapter) => ({
                      price:
                          chapter.price === null ? null : Number(chapter.price),
                      discount: chapter.discount,
                  })),
              },
              settings,
              items
          )
        : null;

    return (
        <div className="flex flex-col gap-6">
            <Link
                to="/admin/book-chapter-projects"
                className="text-forest-moss-700 text-sm hover:text-forest-moss-800 self-start"
            >
                ← Kembali ke Daftar Proyek
            </Link>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div className="flex flex-row items-center justify-between">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        {project.title}
                    </h5>
                    <Button variant="outline2" onClick={handleToggleActive}>
                        {project.is_active
                            ? 'Nonaktifkan dari Katalog'
                            : 'Publish ke Katalog Buku'}
                    </Button>
                </div>

                <p className="text-oxford-navy-900/65 text-xs">
                    Perubahan harga, diskon, HKI/ISBN, fasilitas &amp; layanan,
                    serta mengubah/menghapus bab ditolak bila sisa biaya 1 buku
                    menjadi di bawah minimal (berlaku juga untuk admin).
                </p>

                <Input
                    label="Judul Buku"
                    value={form.title}
                    onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                    }
                />
                <Input
                    label="Harga"
                    value={form.price}
                    onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                    }
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
                <Select
                    name="book_category_id"
                    label="Kategori Buku"
                    option_data={[
                        { value: '', label: 'Tanpa Kategori' },
                        ...bookCategories.map((c) => ({
                            value: String(c.id),
                            label: c.name,
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
                        ...fieldCategories.map((c) => ({
                            value: String(c.id),
                            label: c.name,
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
                <Select
                    name="owner_editor_id"
                    label="Editor"
                    option_data={[
                        { value: '', label: 'Belum ditentukan' },
                        ...editors.map((editor) => ({
                            value: String(editor.user_id),
                            label: editor.name,
                        })),
                    ]}
                    value={form.owner_editor_id}
                    onChange={(e) =>
                        setForm({ ...form, owner_editor_id: e.target.value })
                    }
                />

                {settings && (
                    <PackageOptionsField
                        value={options}
                        onChange={setOptions}
                        settings={settings}
                        items={items}
                    />
                )}

                {costSummary && (
                    <BookChapterCostPanel
                        summary={costSummary}
                        discount={toNumber(form.discount)}
                        showFee={form.owner_editor_id !== ''}
                    />
                )}

                {notice && (
                    <p
                        role={notice.kind === 'error' ? 'alert' : 'status'}
                        className={`text-sm ${
                            notice.kind === 'error'
                                ? 'text-red-700'
                                : 'text-forest-moss-700'
                        }`}
                    >
                        {notice.text}
                    </p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleSaveDetails}
                >
                    Simpan Perubahan
                </Button>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Daftar Bab</h5>

                <div className="flex flex-col gap-3">
                    {project.chapters.map((chapter) => (
                        <ChapterRowEditor
                            key={`${chapter.id}-${chapter.title}-${chapter.price}-${chapter.discount}`}
                            chapter={chapter}
                            onSave={handleSaveChapter}
                            onDelete={handleDeleteChapter}
                        />
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                        <input
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            placeholder="Judul bab baru"
                            className="flex-1 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 outline-none"
                        />
                        <Button variant="outline2" onClick={handleAddChapter}>
                            Tambah Bab
                        </Button>
                    </div>
                    {chapterNotice && (
                        <p role="alert" className="text-red-700 text-sm">
                            {chapterNotice}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
