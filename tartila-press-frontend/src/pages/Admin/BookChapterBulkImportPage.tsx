import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

type ImportResult = {
    created: number;
    errors: { row: number; message: string }[];
};

export default function BookChapterBulkImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('');

    async function handleUpload() {
        if (!file) return;

        setIsUploading(true);
        setStatusMessage('');
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await adminApi.bulkImportBookChapterProjects(
                formData
            );
            setResult(response.data);
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <Link
                to="/admin/book-chapter-projects"
                className="text-forest-moss-700 text-sm hover:text-forest-moss-800 self-start"
            >
                ← Kembali ke Daftar Proyek
            </Link>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Import CSV Book Chapter
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Kolom yang dikenali (semua opsional kecuali title):
                    title, book_category_id, field_category_id, price,
                    discount, chapter_count, estimated_publish_date,
                    submission_deadline, description, about,
                    owner_editor_email, front_cover, languages (kode
                    bahasa dipisah titik koma, mis. id;en). Tiap baris membuat 1
                    buku dengan bab default berjudul &quot;Bab 1&quot;..&quot;Bab
                    N&quot; — judul/harga per-bab bisa diubah manual sesudahnya
                    lewat halaman Kelola.
                </p>

                <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="text-oxford-navy-900 text-sm"
                />

                {statusMessage && (
                    <p className="text-red-600 text-sm">{statusMessage}</p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleUpload}
                    disabled={!file || isUploading}
                >
                    {isUploading ? 'Mengunggah...' : 'Import'}
                </Button>
            </div>

            {result && (
                <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <p className="text-forest-moss-700 font-semibold">
                        {result.created} proyek berhasil dibuat.
                    </p>
                    {result.errors.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <p className="text-red-600 text-sm font-semibold">
                                {result.errors.length} baris gagal:
                            </p>
                            {result.errors.map((error) => (
                                <p
                                    key={error.row}
                                    className="text-red-600 text-sm"
                                >
                                    Baris {error.row}: {error.message}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
