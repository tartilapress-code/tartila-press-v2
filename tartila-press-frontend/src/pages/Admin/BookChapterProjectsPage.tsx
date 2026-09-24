import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '@/components/Input/Input';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import BookChapterCostPanel from '@/components/bookChapter/BookChapterCostPanel';
import PackageOptionsField from '@/components/bookChapter/PackageOptionsField';
import * as adminApi from '@/data/admin/adminApi';
import type { ChapterInput } from '@/data/admin/adminApi';
import * as editorApi from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';
import {
    calculateBookChapterCost,
    chapterRowsToCostInput,
    emptyPackageOptions,
    toNumber,
    type BookChapterCostSettings,
    type CostSummary,
    type PackageItem,
    type PackageOptions,
} from '@/lib/bookChapterCost';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

type ChapterRow = {
    title: string;
    price: string;
    discount: string;
    sop_terms: string;
};

type EditorItem = { user_id: number; name: string };

type ProjectItem = {
    id: number;
    title: string;
    price: string;
    discount: number;
    is_active: boolean;
    is_editor_created: boolean;
    owner_editor: { id: number; name: string } | null;
    chapters: { id: number; manuscript_id: number | null }[];
    cost_summary?: CostSummary;
};

const emptyChapterRow = (): ChapterRow => ({
    title: '',
    price: '',
    discount: '',
    sop_terms: '',
});

function toChapterInput(row: ChapterRow): ChapterInput {
    return {
        title: row.title,
        price: row.price === '' ? null : row.price,
        discount: row.discount === '' ? null : Number(row.discount),
        sop_terms: row.sop_terms || null,
    };
}

export default function BookChapterProjectsPage() {
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [title, setTitle] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [discount, setDiscount] = useState<string>('0');
    const [description, setDescription] = useState<string>('');
    const [ownerEditorId, setOwnerEditorId] = useState<string>('');
    const [submissionDeadline, setSubmissionDeadline] = useState<string>('');
    const [options, setOptions] = useState<PackageOptions>(emptyPackageOptions);
    const [settings, setSettings] = useState<BookChapterCostSettings | null>(
        null
    );
    const [packageItems, setPackageItems] = useState<PackageItem[]>([]);
    const [chapters, setChapters] = useState<ChapterRow[]>([
        emptyChapterRow(),
        emptyChapterRow(),
    ]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function load() {
        adminApi
            .listBookChapterProjectsAdmin()
            .then((response) => setProjects(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        editorApi.directory().then((response) => setEditors(response.data));
        adminApi
            .getBookChapterSettings()
            .then((response) => setSettings(response.data));
        adminApi.listCustomItems().then((response) =>
            setPackageItems(
                (
                    response.data as (PackageItem & {
                        is_active: boolean;
                    })[]
                ).filter((item) => item.is_active)
            )
        );
    }, []);

    function updateChapterRow(index: number, patch: Partial<ChapterRow>) {
        setChapters((previous) =>
            previous.map((row, i) => (i === index ? { ...row, ...patch } : row))
        );
    }

    function addChapterRow() {
        setChapters((previous) => [...previous, emptyChapterRow()]);
    }

    function removeChapterRow(index: number) {
        setChapters((previous) => previous.filter((_, i) => i !== index));
    }

    function resetForm() {
        setTitle('');
        setPrice('');
        setDiscount('0');
        setDescription('');
        setOwnerEditorId('');
        setSubmissionDeadline('');
        setOptions(emptyPackageOptions);
        setChapters([emptyChapterRow(), emptyChapterRow()]);
    }

    const filledChapters = chapters.filter((row) => row.title.trim() !== '');

    // Pratinjau: admin tidak dibatasi saat membuat proyek, jadi kekurangan
    // biaya minimal hanya berupa peringatan (perubahan berikutnya tetap
    // terikat aturan).
    const costSummary = settings
        ? calculateBookChapterCost(
              {
                  ...options,
                  price: toNumber(price),
                  discount: toNumber(discount),
                  chapters: chapterRowsToCostInput(filledChapters),
              },
              settings,
              packageItems
          )
        : null;

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await adminApi.createBookChapterProjectAdmin({
                title,
                price,
                discount: Number(discount) || 0,
                description: description || undefined,
                owner_editor_id: ownerEditorId ? Number(ownerEditorId) : null,
                submission_deadline: submissionDeadline || undefined,
                ...options,
                chapters: filledChapters.map(toChapterInput),
            });
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
        await adminApi.deleteBookChapterProjectAdmin(id);
        load();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-row items-center justify-between">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Proyek Book Chapter
                </h5>
                <div className="flex flex-row gap-2">
                    <Link to="/admin/book-chapter-projects/bulk-import">
                        <Button variant="outline2">Import CSV</Button>
                    </Link>
                    <Link to="/admin/book-chapter-settings">
                        <Button variant="outline2">Pengaturan</Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Buat Proyek Book Chapter
                </h5>

                <Input
                    label="Judul Buku"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <Input
                    label="Harga (default untuk semua bab)"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                />
                <Input
                    label="Diskon (%) (default untuk semua bab)"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                />
                <Input
                    label="Keterangan"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <Select
                    name="owner_editor_id"
                    label="Editor (opsional, boleh kosong)"
                    option_data={[
                        { value: '', label: 'Belum ditentukan' },
                        ...editors.map((editor) => ({
                            value: String(editor.user_id),
                            label: editor.name,
                        })),
                    ]}
                    value={ownerEditorId}
                    onChange={(e) => setOwnerEditorId(e.target.value)}
                />
                <Input
                    label="Batas Pengumpulan Naskah"
                    type="datetime-local"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                />

                <div className="flex flex-col gap-3">
                    <h6 className="text-oxford-navy-900 font-semibold">Daftar Bab</h6>
                    {chapters.map((row, index) => (
                        <div
                            key={index}
                            className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3"
                        >
                            <div className="flex flex-row items-center gap-2">
                                <input
                                    value={row.title}
                                    onChange={(e) =>
                                        updateChapterRow(index, {
                                            title: e.target.value,
                                        })
                                    }
                                    placeholder={`Judul Bab ${index + 1}`}
                                    className="flex-1 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 outline-none"
                                />
                                <Button
                                    type="button"
                                    variant="outline2"
                                    onClick={() => removeChapterRow(index)}
                                >
                                    Hapus
                                </Button>
                            </div>
                            <div className="flex flex-row flex-wrap gap-2">
                                <input
                                    value={row.price}
                                    onChange={(e) =>
                                        updateChapterRow(index, {
                                            price: e.target.value,
                                        })
                                    }
                                    placeholder="Harga custom (kosongkan = ikut buku)"
                                    className="flex-1 min-w-48 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 text-sm outline-none"
                                />
                                <input
                                    value={row.discount}
                                    onChange={(e) =>
                                        updateChapterRow(index, {
                                            discount: e.target.value,
                                        })
                                    }
                                    placeholder="Diskon custom (%)"
                                    className="w-40 p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 text-sm outline-none"
                                />
                            </div>
                            <input
                                value={row.sop_terms}
                                onChange={(e) =>
                                    updateChapterRow(index, {
                                        sop_terms: e.target.value,
                                    })
                                }
                                placeholder="SOP / ketentuan terbit bab ini (opsional)"
                                className="p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 text-sm outline-none"
                            />
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline2"
                        className="self-start"
                        onClick={addChapterRow}
                    >
                        Tambah Bab
                    </Button>
                </div>

                {settings && (
                    <PackageOptionsField
                        value={options}
                        onChange={setOptions}
                        settings={settings}
                        items={packageItems}
                    />
                )}

                {costSummary && (
                    <BookChapterCostPanel
                        summary={costSummary}
                        discount={toNumber(discount)}
                        showFee={ownerEditorId !== ''}
                    />
                )}

                {statusMessage && (
                    <p className="text-red-600 text-sm">{statusMessage}</p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !title || !price}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Buat Proyek'}
                </Button>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Daftar Proyek Book Chapter
                </h5>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {projects.map((project) => {
                            const filled = project.chapters.filter(
                                (c) => c.manuscript_id
                            ).length;

                            return (
                                <div
                                    key={project.id}
                                    className="flex flex-row items-center justify-between gap-4 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                                >
                                    <div>
                                        <p className="text-oxford-navy-900 font-semibold">
                                            {project.title}{' '}
                                            {!project.is_active && (
                                                <span className="text-oxford-navy-900/55 text-xs">
                                                    (belum publish)
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-oxford-navy-900/65 text-sm">
                                            {filled}/{project.chapters.length}{' '}
                                            bab terisi
                                            {project.owner_editor
                                                ? ` — Editor: ${project.owner_editor.name}`
                                                : ' — Belum ada editor'}
                                            {project.is_editor_created &&
                                                ' (dibuat editor)'}
                                        </p>
                                        {project.cost_summary &&
                                            !project.cost_summary
                                                .meets_minimum && (
                                                <p className="text-red-700 text-xs">
                                                    Sisa biaya di bawah minimal
                                                    1 buku (kurang{' '}
                                                    {rupiahFormatter.format(
                                                        project.cost_summary
                                                            .shortfall
                                                    )}
                                                    )
                                                </p>
                                            )}
                                    </div>
                                    <div className="flex flex-row gap-2 shrink-0">
                                        <Link
                                            to={`/admin/book-chapter-projects/${project.id}`}
                                        >
                                            <Button variant="outline2">
                                                Kelola
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="outline2"
                                            onClick={() =>
                                                handleDelete(project.id)
                                            }
                                        >
                                            Hapus
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
