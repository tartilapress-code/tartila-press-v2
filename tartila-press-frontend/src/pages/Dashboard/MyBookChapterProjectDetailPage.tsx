import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ErrorPage from '@/pages/ErrorPage';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import BookChapterCostPanel from '@/components/bookChapter/BookChapterCostPanel';
import ChapterRowEditor, {
    type ChapterPatch,
    type EditableChapter,
} from '@/components/bookChapter/ChapterRowEditor';
import PackageOptionsField from '@/components/bookChapter/PackageOptionsField';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';
import {
    calculateBookChapterCost,
    toNumber,
    type BookChapterCostSettings,
    type PackageItem,
    type PackageOptions,
} from '@/lib/bookChapterCost';

type ProjectDetail = {
    id: number;
    title: string;
    price: string;
    discount: number;
    description: string | null;
    about: string | null;
    is_active: boolean;
    includes_hki: boolean;
    includes_isbn_print: boolean;
    includes_isbn_electronic: boolean;
    package_items: PackageItem[];
    chapters: EditableChapter[];
};

type Notice = { kind: 'ok' | 'error'; text: string };

function errorText(error: unknown): string {
    return error instanceof ApiError
        ? error.message
        : 'Terjadi kesalahan. Silakan coba lagi.';
}

function optionsOf(project: ProjectDetail): PackageOptions {
    return {
        includes_hki: project.includes_hki,
        includes_isbn_print: project.includes_isbn_print,
        includes_isbn_electronic: project.includes_isbn_electronic,
        package_item_ids: project.package_items.map((item) => item.id),
    };
}

/**
 * Editor mengelola proyek Book Chapter miliknya: harga, diskon, paket
 * (HKI/ISBN/fasilitas/layanan), serta bab. Server menolak perubahan yang
 * membuat sisa biaya 1 buku di bawah minimal.
 */
export default function MyBookChapterProjectDetailPage() {
    const { id } = useParams<{ id: string }>();

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [settings, setSettings] = useState<BookChapterCostSettings | null>(
        null
    );
    const [activeItems, setActiveItems] = useState<PackageItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [notFound, setNotFound] = useState<boolean>(false);

    const [form, setForm] = useState({
        title: '',
        price: '',
        discount: '0',
        description: '',
        about: '',
    });
    const [options, setOptions] = useState<PackageOptions>({
        includes_hki: false,
        includes_isbn_print: false,
        includes_isbn_electronic: false,
        package_item_ids: [],
    });
    const [notice, setNotice] = useState<Notice | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const [newChapterTitle, setNewChapterTitle] = useState<string>('');
    const [newChapterPrice, setNewChapterPrice] = useState<string>('');
    const [chapterNotice, setChapterNotice] = useState<string>('');

    function applyProject(data: ProjectDetail) {
        setProject(data);
        setForm({
            title: data.title,
            price: String(Number(data.price)),
            discount: String(data.discount),
            description: data.description ?? '',
            about: data.about ?? '',
        });
        setOptions(optionsOf(data));
    }

    function reload() {
        return editorApi
            .getMyBookChapterProject(id ?? '')
            .then((response) => applyProject(response.data));
    }

    useEffect(() => {
        Promise.all([
            editorApi.getMyBookChapterProject(id ?? ''),
            editorApi.getBookChapterSettings(),
            editorApi.getBookChapterPackageItems(),
        ])
            .then(([projectRes, settingsRes, itemsRes]) => {
                applyProject(projectRes.data);
                setSettings(settingsRes.data);
                setActiveItems(itemsRes.data);
            })
            .catch((error) => {
                if (
                    error instanceof ApiError &&
                    (error.status === 404 || error.status === 403)
                ) {
                    setNotFound(true);
                } else {
                    throw error;
                }
            })
            .finally(() => setIsLoading(false));
    }, [id]);

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (notFound || !project || !settings) {
        return <ErrorPage />;
    }

    // Item yang sudah tercentang tapi kini nonaktif tetap tampil supaya bisa
    // dilepas dan biayanya ikut terhitung.
    const items = [
        ...activeItems,
        ...project.package_items.filter(
            (saved) => !activeItems.some((active) => active.id === saved.id)
        ),
    ];

    const costSummary = calculateBookChapterCost(
        {
            ...options,
            price: toNumber(form.price),
            discount: toNumber(form.discount),
            chapters: project.chapters.map((chapter) => ({
                price: chapter.price === null ? null : Number(chapter.price),
                discount: chapter.discount,
            })),
        },
        settings,
        items
    );

    async function handleSave() {
        setIsSaving(true);
        setNotice(null);

        try {
            await editorApi.updateMyBookChapterProject(project!.id, {
                title: form.title,
                price: form.price,
                discount: Number(form.discount) || 0,
                description: form.description,
                about: form.about,
                ...options,
            });
            await reload();
            setNotice({ kind: 'ok', text: 'Perubahan berhasil disimpan.' });
        } catch (error) {
            setNotice({ kind: 'error', text: errorText(error) });
        } finally {
            setIsSaving(false);
        }
    }

    async function handleSaveChapter(chapterId: number, patch: ChapterPatch) {
        await editorApi.updateMyBookChapterProjectChapter(chapterId, patch);
        await reload();
    }

    async function handleDeleteChapter(chapterId: number) {
        await editorApi.deleteMyBookChapterProjectChapter(chapterId);
        await reload();
    }

    async function handleAddChapter() {
        setChapterNotice('');

        try {
            await editorApi.addMyBookChapterProjectChapter(project!.id, {
                title: newChapterTitle,
                price: newChapterPrice.trim() === '' ? null : newChapterPrice,
            });
            setNewChapterTitle('');
            setNewChapterPrice('');
            await reload();
        } catch (error) {
            setChapterNotice(errorText(error));
        }
    }

    const filled = project.chapters.filter((c) => c.manuscript_id).length;

    return (
        <div className="flex flex-col gap-6">
            <Link
                to="/dashboard/proyek-bab-buku-saya"
                className="text-forest-moss-700 text-sm hover:text-forest-moss-800 self-start"
            >
                ← Kembali ke Proyek Saya
            </Link>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div>
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        {project.title}
                    </h5>
                    <p className="text-oxford-navy-900/65 text-sm">
                        {project.is_active ? 'Sudah terbit' : 'Belum terbit'} —{' '}
                        {filled}/{project.chapters.length} bab terisi
                    </p>
                </div>

                <p className="text-oxford-navy-900/65 text-xs">
                    Perubahan harga, diskon, HKI/ISBN, fasilitas &amp; layanan,
                    serta mengubah/menghapus bab akan ditolak bila sisa biaya 1
                    buku menjadi di bawah minimal.
                </p>

                <Input
                    label="Judul Buku"
                    value={form.title}
                    onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                    }
                />
                <Input
                    label="Harga (default untuk semua bab)"
                    value={form.price}
                    onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                    }
                />
                <Input
                    label="Diskon (%) (default untuk semua bab)"
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
                <Input
                    label="Tentang Buku"
                    value={form.about}
                    onChange={(e) =>
                        setForm({ ...form, about: e.target.value })
                    }
                />

                <PackageOptionsField
                    value={options}
                    onChange={setOptions}
                    settings={settings}
                    items={items}
                />

                <BookChapterCostPanel
                    summary={costSummary}
                    discount={toNumber(form.discount)}
                    showFee
                />

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
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
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
                    <div className="flex flex-row flex-wrap gap-2">
                        <input
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            placeholder="Judul bab baru"
                            className="flex-1 min-w-48 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 outline-none"
                        />
                        <input
                            value={newChapterPrice}
                            onChange={(e) => setNewChapterPrice(e.target.value)}
                            placeholder="Harga (kosongkan = ikut proyek)"
                            className="w-64 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 text-sm outline-none"
                        />
                        <Button
                            variant="outline2"
                            onClick={handleAddChapter}
                            disabled={newChapterTitle.trim() === ''}
                        >
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
