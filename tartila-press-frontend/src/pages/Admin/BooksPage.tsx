import { useCallback, useEffect, useState } from 'react';
import { SearchField } from '@/components/ui/FilterControls';
import Pagination from '@/components/ui/Pagination';
import type { PageMeta } from '@/lib/pagination';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ContentLanguageField from '@/components/language/ContentLanguageField';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import EbookManager from '@/components/book/EbookManager';
import * as adminApi from '@/data/admin/adminApi';
import type { BookPayload } from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';
import {
    toContentLanguages,
    type ContentLanguage,
} from '@/lib/contentLanguages';

type Category = { id: number; name: string };

type BookItem = {
    id: number;
    manuscript_id: number | null;
    title: string;
    authors_text: string | null;
    isbn: string | null;
    front_cover: string | null;
    cover_layout_designer: string | null;
    price: string;
    discount: number;
    languages: string[];
    is_active: boolean;
    is_chapter_compilation: boolean;
    category: Category | null;
    field_category: Category | null;
    chapters: { id: number }[];
    // Ebook lengkap untuk penulis (berkasnya privat).
    ebook_name: string | null;
    ebook_uploaded_at: string | null;
    ebook_pages: number | null;
    // Ebook PDF dengan jumlah halaman yang diketahui: tampil di Tartila Book.
    in_tartila_book: boolean;
};

type FormState = {
    title: string;
    authors: string;
    isbn: string;
    front_cover: string;
    back_cover: string;
    cover_layout_designer: string;
    description: string;
    book_category_id: string;
    field_category_id: string;
    languages: ContentLanguage[];
    price: string;
    discount: string;
    citation_publisher: string;
    citation_publication_date: string;
    google_scholar_url: string;
};

const emptyForm: FormState = {
    title: '',
    authors: '',
    isbn: '',
    front_cover: '',
    back_cover: '',
    cover_layout_designer: '',
    description: '',
    book_category_id: '',
    field_category_id: '',
    languages: [],
    price: '',
    discount: '0',
    citation_publisher: '',
    citation_publication_date: '',
    google_scholar_url: '',
};

function PreviewUploader({
    onUpload,
}: {
    onUpload: (file: File) => Promise<void>;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);

    return (
        <div className="flex flex-row items-center gap-2">
            <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-oxford-navy-900 text-xs w-40"
            />
            <Button
                variant="outline2"
                disabled={!file || isUploading}
                onClick={async () => {
                    if (!file) return;
                    setIsUploading(true);
                    try {
                        await onUpload(file);
                        setFile(null);
                    } finally {
                        setIsUploading(false);
                    }
                }}
            >
                {isUploading ? 'Mengunggah...' : 'Upload Preview'}
            </Button>
        </div>
    );
}

export default function BooksPage() {
    const { t } = useTranslation();
    const [books, setBooks] = useState<BookItem[]>([]);
    const [bookCategories, setBookCategories] = useState<Category[]>([]);
    const [fieldCategories, setFieldCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingBook, setEditingBook] = useState<BookItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const [active, setActive] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [meta, setMeta] = useState<PageMeta | null>(null);

    // Pencarian, filter aktif & halaman dikerjakan server.
    const load = useCallback(() => {
        adminApi
            .listBooksAdmin({ search: search.trim(), active, page })
            .then((response) => {
                setBooks(response.data);
                setMeta(response.meta ?? null);
            })
            .finally(() => setIsLoading(false));
    }, [search, active, page]);

    useEffect(() => {
        const timeout = setTimeout(load, 300);

        return () => clearTimeout(timeout);
    }, [load]);

    useEffect(() => {
        Promise.all([
            adminApi.listBookCategoriesAdmin(),
            adminApi.listFieldCategoriesAdmin(),
        ]).then(([bookCategoryRes, fieldCategoryRes]) => {
            setBookCategories(bookCategoryRes.data);
            setFieldCategories(fieldCategoryRes.data);
        });
    }, []);

    function resetForm() {
        setEditingBook(null);
        setForm(emptyForm);
    }

    function startEdit(book: BookItem) {
        setEditingBook(book);
        setForm({
            title: book.title,
            authors: book.authors_text ?? '',
            isbn: book.isbn ?? '',
            front_cover: book.front_cover ?? '',
            back_cover: '',
            cover_layout_designer: book.cover_layout_designer ?? '',
            description: '',
            book_category_id: book.category ? String(book.category.id) : '',
            field_category_id: book.field_category
                ? String(book.field_category.id)
                : '',
            languages: toContentLanguages(book.languages),
            price: book.price,
            discount: String(book.discount),
            citation_publisher: '',
            citation_publication_date: '',
            google_scholar_url: '',
        });
    }

    function buildPayload(): BookPayload {
        const payload: BookPayload = {
            isbn: form.isbn || undefined,
            front_cover: form.front_cover || undefined,
            back_cover: form.back_cover || undefined,
            cover_layout_designer: form.cover_layout_designer || undefined,
            description: form.description || undefined,
            book_category_id: form.book_category_id || undefined,
            field_category_id: form.field_category_id || undefined,
            languages: form.languages,
            price: form.price,
            discount: Number(form.discount) || 0,
            citation_publisher: form.citation_publisher || undefined,
            citation_publication_date:
                form.citation_publication_date || undefined,
            google_scholar_url: form.google_scholar_url || undefined,
        };

        if (!editingBook || !editingBook.manuscript_id) {
            payload.title = form.title;
            payload.authors = form.authors
                .split(',')
                .map((author) => author.trim())
                .filter(Boolean);
        }

        return payload;
    }

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            if (editingBook) {
                await adminApi.updateBook(editingBook.id, buildPayload());
            } else {
                await adminApi.createBookManual(buildPayload());
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

    async function handleToggleActive(book: BookItem) {
        await adminApi.updateBook(book.id, { is_active: !book.is_active });
        load();
    }

    async function handleDelete(id: number) {
        await adminApi.deleteBook(id);
        load();
    }

    async function handleUploadPreview(book: BookItem, file: File) {
        const formData = new FormData();
        formData.append('file', file);
        await adminApi.uploadBookPreview(book.id, formData);
        load();
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-row items-center justify-between">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Buku
                </h5>
                <Link to="/admin/books/gabung-bab">
                    <Button variant="outline2">
                        Gabungkan Naskah jadi Book Chapter
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    {editingBook
                        ? `Ubah "${editingBook.title}"`
                        : 'Tambah Buku Manual'}
                </h5>

                {editingBook?.manuscript_id ? (
                    <p className="text-oxford-navy-900/65 text-sm">
                        Judul &amp; penulis buku ini berasal dari naskah, tidak
                        bisa diubah di sini.
                    </p>
                ) : (
                    <>
                        <Input
                            label="Judul"
                            value={form.title}
                            onChange={(e) =>
                                setForm({ ...form, title: e.target.value })
                            }
                            required
                        />
                        <Input
                            label="Penulis (pisahkan dengan koma)"
                            value={form.authors}
                            onChange={(e) =>
                                setForm({ ...form, authors: e.target.value })
                            }
                            required
                        />
                    </>
                )}

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
                    label="Desain Sampul & Tata Letak"
                    value={form.cover_layout_designer}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            cover_layout_designer: e.target.value,
                        })
                    }
                    placeholder="Nama desainer/studio"
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
                <Input
                    label="Penerbit Sitasi"
                    value={form.citation_publisher}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            citation_publisher: e.target.value,
                        })
                    }
                    placeholder="Tartila Press"
                />
                <Input
                    label="Tanggal Terbit"
                    type="date"
                    value={form.citation_publication_date}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            citation_publication_date: e.target.value,
                        })
                    }
                />
                <Input
                    label="URL Google Scholar"
                    value={form.google_scholar_url}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            google_scholar_url: e.target.value,
                        })
                    }
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
                            : editingBook
                              ? 'Simpan Perubahan'
                              : 'Tambah Buku'}
                    </Button>
                    {editingBook && (
                        <Button variant="outline2" onClick={resetForm}>
                            Batal
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Daftar Buku
                        {meta && (
                            <span className="ml-2 font-sans text-sm font-normal text-oxford-navy-900/60">
                                ({meta.total})
                            </span>
                        )}
                    </h5>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <SearchField
                            value={search}
                            onChange={(value) => {
                                setSearch(value);
                                setPage(1);
                            }}
                            placeholder="Cari judul atau penulis"
                            ariaLabel="Cari buku"
                            className="sm:w-72"
                        />
                        <div className="sm:w-48">
                            <Select
                                name="active_filter"
                                label="Status"
                                option_data={[
                                    { value: '', label: 'Semua' },
                                    { value: '1', label: 'Aktif' },
                                    { value: '0', label: 'Nonaktif' },
                                ]}
                                value={active}
                                onChange={(e) => {
                                    setActive(e.target.value);
                                    setPage(1);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {books.map((book) => (
                            <div
                                key={book.id}
                                className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                            >
                                <div className="flex flex-row items-center justify-between gap-4">
                                    <div>
                                        <p className="text-oxford-navy-900 font-semibold">
                                            {book.title}{' '}
                                            {!book.is_active && (
                                                <span className="text-red-600 text-xs">
                                                    (nonaktif)
                                                </span>
                                            )}
                                            {book.is_chapter_compilation && (
                                                <span className="text-forest-moss-700 text-xs">
                                                    {' '}
                                                    (Book Chapter,{' '}
                                                    {book.chapters.length} bab)
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-oxford-navy-900/65 text-sm">
                                            {book.authors_text} — Rp{' '}
                                            {book.price} (diskon {book.discount}
                                            %)
                                        </p>
                                    </div>
                                    <div className="flex flex-row gap-2 shrink-0">
                                        <Button
                                            variant="outline2"
                                            onClick={() => startEdit(book)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline2"
                                            onClick={() =>
                                                handleToggleActive(book)
                                            }
                                        >
                                            {book.is_active
                                                ? 'Nonaktifkan'
                                                : 'Aktifkan'}
                                        </Button>
                                        <Button
                                            variant="outline2"
                                            onClick={() =>
                                                handleDelete(book.id)
                                            }
                                        >
                                            Hapus
                                        </Button>
                                    </div>
                                </div>
                                <PreviewUploader
                                    onUpload={(file) =>
                                        handleUploadPreview(book, file)
                                    }
                                />
                                <EbookManager
                                    bookId={book.id}
                                    ebookName={book.ebook_name}
                                    uploadedAt={book.ebook_uploaded_at}
                                    pages={book.ebook_pages}
                                    inTartilaBook={book.in_tartila_book}
                                    onChanged={load}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <Pagination meta={meta} onPageChange={setPage} />
            </div>
        </div>
    );
}
