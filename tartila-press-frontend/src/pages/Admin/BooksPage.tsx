import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import type { BookPayload } from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

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
    royalty_percentage: string | null;
    is_active: boolean;
    is_chapter_compilation: boolean;
    category: Category | null;
    field_category: Category | null;
    chapters: { id: number }[];
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
    price: string;
    discount: string;
    royalty_percentage: string;
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
    price: '',
    discount: '0',
    royalty_percentage: '',
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
                className="text-white text-xs w-40"
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
    const [books, setBooks] = useState<BookItem[]>([]);
    const [bookCategories, setBookCategories] = useState<Category[]>([]);
    const [fieldCategories, setFieldCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingBook, setEditingBook] = useState<BookItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function load() {
        adminApi
            .listBooksAdmin()
            .then((response) => setBooks(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
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
            price: book.price,
            discount: String(book.discount),
            royalty_percentage: book.royalty_percentage ?? '',
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
            price: form.price,
            discount: Number(form.discount) || 0,
            royalty_percentage:
                form.royalty_percentage === ''
                    ? null
                    : Number(form.royalty_percentage),
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
                <h5 className="text-white text-xl font-semibold">Buku</h5>
                <Link to="/admin/books/gabung-bab">
                    <Button variant="outline2">
                        Gabungkan Naskah jadi Book Chapter
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    {editingBook ? `Ubah "${editingBook.title}"` : 'Tambah Buku Manual'}
                </h5>

                {editingBook?.manuscript_id ? (
                    <p className="text-white/60 text-sm">
                        Judul &amp; penulis buku ini berasal dari naskah,
                        tidak bisa diubah di sini.
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
                    label="Royalti (%)"
                    value={form.royalty_percentage}
                    onChange={(e) =>
                        setForm({
                            ...form,
                            royalty_percentage: e.target.value,
                        })
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

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Daftar Buku
                </h5>

                {isLoading ? (
                    <p className="text-white/70 text-sm">Memuat...</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {books.map((book) => (
                            <div
                                key={book.id}
                                className="flex flex-col gap-3 bg-oxford-navy-900/40 rounded-lg p-4"
                            >
                                <div className="flex flex-row items-center justify-between gap-4">
                                    <div>
                                        <p className="text-white font-semibold">
                                            {book.title}{' '}
                                            {!book.is_active && (
                                                <span className="text-red-400 text-xs">
                                                    (nonaktif)
                                                </span>
                                            )}
                                            {book.is_chapter_compilation && (
                                                <span className="text-forest-moss-300 text-xs">
                                                    {' '}
                                                    (Book Chapter,{' '}
                                                    {book.chapters.length} bab)
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-white/60 text-sm">
                                            {book.authors_text} — Rp{' '}
                                            {book.price} (diskon{' '}
                                            {book.discount}%)
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
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
