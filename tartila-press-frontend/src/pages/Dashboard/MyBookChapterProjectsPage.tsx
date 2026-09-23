import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import * as editorApi from '@/data/editor/editorApi';
import type { ChapterInput } from '@/data/editor/editorApi';
import { ApiError } from '@/lib/http';

type ChapterRow = {
    id?: number;
    title: string;
    price: string;
    discount: string;
    sop_terms: string;
};

type Settings = {
    min_chapters: number;
    max_chapters: number | null;
    min_price: string;
    max_discount: number;
};

type ProjectItem = {
    id: number;
    title: string;
    price: string;
    discount: number;
    is_active: boolean;
    chapters: { id: number; title: string; manuscript_id: number | null }[];
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

export default function MyBookChapterProjectsPage() {
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [title, setTitle] = useState<string>('');
    const [price, setPrice] = useState<string>('');
    const [discount, setDiscount] = useState<string>('0');
    const [description, setDescription] = useState<string>('');
    const [about, setAbout] = useState<string>('');
    const [submissionDeadline, setSubmissionDeadline] = useState<string>('');
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
        setChapters([emptyChapterRow(), emptyChapterRow()]);
    }

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
                chapters: chapters
                    .filter((row) => row.title.trim() !== '')
                    .map(toChapterInput),
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
            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Buat Proyek Book Chapter
                </h5>

                {settings && (
                    <p className="text-white/60 text-xs">
                        Ketentuan admin: minimal {settings.min_chapters} bab
                        {settings.max_chapters
                            ? `, maksimal ${settings.max_chapters} bab`
                            : ''}
                        , harga minimal Rp {settings.min_price}, diskon
                        maksimal {settings.max_discount}%.
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
                    <h6 className="text-white font-semibold">Daftar Bab</h6>
                    {chapters.map((row, index) => (
                        <div
                            key={index}
                            className="flex flex-col gap-2 bg-oxford-navy-900/40 rounded-lg p-3"
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
                                    className="flex-1 p-2 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white outline-none"
                                />
                                <Button
                                    type="button"
                                    variant="outline2"
                                    onClick={() => removeChapterRow(index)}
                                >
                                    Hapus
                                </Button>
                            </div>
                            <div className="flex flex-row gap-2">
                                <input
                                    value={row.price}
                                    onChange={(e) =>
                                        updateChapterRow(index, {
                                            price: e.target.value,
                                        })
                                    }
                                    placeholder="Harga custom (kosongkan = ikut buku)"
                                    className="flex-1 p-2 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white text-sm outline-none"
                                />
                                <input
                                    value={row.discount}
                                    onChange={(e) =>
                                        updateChapterRow(index, {
                                            discount: e.target.value,
                                        })
                                    }
                                    placeholder="Diskon custom (%)"
                                    className="w-40 p-2 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white text-sm outline-none"
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
                                className="p-2 rounded-lg ring-1 ring-white/30 placeholder:text-white/50 bg-transparent text-white text-sm outline-none"
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

                {statusMessage && (
                    <p className="text-red-400 text-sm">{statusMessage}</p>
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

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Proyek Book Chapter Saya
                </h5>

                {isLoading ? (
                    <p className="text-white/70 text-sm">Memuat...</p>
                ) : projects.length === 0 ? (
                    <p className="text-white/60 text-sm">
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
                                    className="flex flex-row items-center justify-between gap-4 bg-oxford-navy-900/40 rounded-lg p-4"
                                >
                                    <div>
                                        <p className="text-white font-semibold">
                                            {project.title}
                                        </p>
                                        <p className="text-white/60 text-sm">
                                            {filled}/{project.chapters.length}{' '}
                                            bab terisi — Rp {project.price}{' '}
                                            (diskon {project.discount}%)
                                        </p>
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
