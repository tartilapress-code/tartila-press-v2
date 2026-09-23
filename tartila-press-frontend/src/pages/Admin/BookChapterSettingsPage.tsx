import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Input from '@/components/Input/Input';
import Button from '@/components/Button/Button';
import * as adminApi from '@/data/admin/adminApi';
import { ApiError } from '@/lib/http';

export default function BookChapterSettingsPage() {
    const [minChapters, setMinChapters] = useState<string>('2');
    const [maxChapters, setMaxChapters] = useState<string>('');
    const [minPrice, setMinPrice] = useState<string>('0');
    const [maxDiscount, setMaxDiscount] = useState<string>('100');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    useEffect(() => {
        adminApi
            .getBookChapterSettings()
            .then((response) => {
                const data = response.data;
                setMinChapters(String(data.min_chapters));
                setMaxChapters(data.max_chapters ? String(data.max_chapters) : '');
                setMinPrice(String(data.min_price));
                setMaxDiscount(String(data.max_discount));
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function handleSubmit() {
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await adminApi.updateBookChapterSettings({
                min_chapters: Number(minChapters),
                max_chapters: maxChapters ? Number(maxChapters) : undefined,
                min_price: minPrice,
                max_discount: Number(maxDiscount),
            });
            setStatusMessage('Pengaturan berhasil disimpan.');
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

    if (isLoading) {
        return <p className="text-white/70">Memuat...</p>;
    }

    return (
        <div className="flex flex-col gap-6">
            <Link
                to="/admin/book-chapter-projects"
                className="text-forest-moss-300 text-sm hover:text-forest-moss-200 self-start"
            >
                ← Kembali ke Daftar Proyek
            </Link>

            <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
                <h5 className="text-white text-xl font-semibold">
                    Pengaturan Book Chapter
                </h5>
                <p className="text-white/60 text-sm">
                    Batas ini hanya berlaku untuk proyek Book Chapter yang
                    dibuat sendiri oleh Editor. Admin tidak dibatasi.
                </p>

                <Input
                    label="Jumlah Bab Minimal"
                    value={minChapters}
                    onChange={(e) => setMinChapters(e.target.value)}
                    required
                />
                <Input
                    label="Jumlah Bab Maksimal (kosongkan = tanpa batas)"
                    value={maxChapters}
                    onChange={(e) => setMaxChapters(e.target.value)}
                />
                <Input
                    label="Harga Minimal"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    required
                />
                <Input
                    label="Diskon Maksimal (%)"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    required
                />

                {statusMessage && (
                    <p className="text-forest-moss-300 text-sm">
                        {statusMessage}
                    </p>
                )}

                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
            </div>
        </div>
    );
}
