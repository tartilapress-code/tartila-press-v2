import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import BookChapterCostPanel from '@/components/bookChapter/BookChapterCostPanel';
import PackageOptionsField from '@/components/bookChapter/PackageOptionsField';
import * as editorApi from '@/data/editor/editorApi';
import type { ChapterInput } from '@/data/editor/editorApi';
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

type ChapterRow = {
    title: string;
    price: string;
    discount: string;
    sop_terms: string;
};

type ProjectItem = {
    id: number;
    title: string;
    price: string;
    discount: number;
    is_active: boolean;
    chapters: { id: number; title: string; manuscript_id: number | null }[];
    cost_summary?: CostSummary;
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

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

export default function MyBookChapterProjectsPage() {
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [settings, setSettings] = useState<BookChapterCostSettings | null>(
        null
    );
    const [packageItems, setPackageItems] = useState<PackageItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [title, setTitle] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [discount, setDiscount] = useState<string>('0');
    const [description, setDescription] = useState<string>('');
    const [about, setAbout] = useState<string>('');
    const [submissionDeadline, setSubmissionDeadline] = useState<string>('');
    const [options, setOptions] = useState<PackageOptions>(emptyPackageOptions);
    const [chapters, setChapters] = useState<ChapterRow[]>([
        emptyChapterRow(),
        emptyChapterRow(),
    ]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function load() {
        editorApi
            .myBookChapterProjects()
            .then((response) => setProjects(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        editorApi
            .getBookChapterSettings()
            .then((response) => setSettings(response.data));
        editorApi
            .getBookChapterPackageItems()
            .then((response) => setPackageItems(response.data));
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
        setAbout('');
        setSubmissionDeadline('');
        setOptions(emptyPackageOptions);
        setChapters([emptyChapterRow(), emptyChapterRow()]);
    }

    const filledChapters = chapters.filter((row) => row.title.trim() !== '');

    // Pratinjau langsung: sisa biaya 1 buku & fee yang bisa didapatkan.
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
            await editorApi.createMyBookChapterProject({
                title,
                price,
                discount: Number(discount) || 0,
                description: description || undefined,
                about: about || undefined,
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

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Buat Proyek Book Chapter
                </h5>

                {settings && (
                    <p className="text-oxford-navy-900/65 text-xs">
                        Ketentuan admin: minimal {settings.min_chapters} bab
                        {settings.max_chapters
                            ? `, maksimal ${settings.max_chapters} bab`
                            : ''}
                        , harga minimal{' '}
                        {rupiahFormatter.format(toNumber(settings.min_price))},
                        diskon maksimal {settings.max_discount}%, sisa biaya
                        minimal 1 buku{' '}
                        {rupiahFormatter.format(
                            toNumber(settings.min_book_cost)
                        )}
                        .
                    </p>
                )}

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
                {settings && (
                    <small className="text-oxford-navy-900/65 -mt-2">
                        Diskon diambil dari fee Anda: fee = diskon maksimal{' '}
                        {settings.max_discount}% − diskon yang Anda berikan
                        (lihat perhitungan fee di bawah).
                    </small>
                )}
                <Input
                    label="Keterangan"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <Input
                    label="Tentang Buku"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
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
                        showFee
                    />
                )}

                {statusMessage && (
                    <p role="alert" className="text-red-700 text-sm">
                        {statusMessage}
                    </p>
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
                    Proyek Book Chapter Saya
                </h5>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : projects.length === 0 ? (
                    <p className="text-oxford-navy-900/65 text-sm">
                        Anda belum membuat proyek Book Chapter.
                    </p>
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
                                                    (belum terbit)
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-oxford-navy-900/65 text-sm">
                                            {filled}/{project.chapters.length}{' '}
                                            bab terisi —{' '}
                                            {rupiahFormatter.format(
                                                Number(project.price)
                                            )}{' '}
                                            (diskon {project.discount}%)
                                        </p>
                                        {project.cost_summary && (
                                            <p className="text-forest-moss-700 text-sm">
                                                Fee{' '}
                                                {
                                                    project.cost_summary
                                                        .fee_percent
                                                }
                                                % — potensi{' '}
                                                {rupiahFormatter.format(
                                                    project.cost_summary
                                                        .potential_fee
                                                )}{' '}
                                                jika seluruh bab terjual &amp;
                                                buku terbit
                                            </p>
                                        )}
                                        {project.cost_summary &&
                                            !project.cost_summary
                                                .meets_minimum && (
                                                <p className="text-red-700 text-xs">
                                                    Biaya di bawah minimal
                                                    (kurang{' '}
                                                    {rupiahFormatter.format(
                                                        project.cost_summary
                                                            .shortfall
                                                    )}
                                                    )
                                                </p>
                                            )}
                                    </div>
                                    <Link
                                        to={`/dashboard/proyek-bab-buku-saya/${project.id}`}
                                        className="inline-flex items-center font-semibold text-sm rounded-lg px-4 py-3 h-fit shrink-0 text-oxford-navy-700 border border-oxford-navy-200 hover:bg-forest-moss-50"
                                    >
                                        Kelola
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
