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
    const [hkiCost, setHkiCost] = useState<string>('0');
    const [isbnPrintCost, setIsbnPrintCost] = useState<string>('0');
    const [isbnElectronicCost, setIsbnElectronicCost] = useState<string>('0');
    const [minBookCost, setMinBookCost] = useState<string>('0');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    useEffect(() => {
        adminApi
            .getBookChapterSettings()
            .then((response) => {
                const data = response.data;
                setMinChapters(String(data.min_chapters));
                setMaxChapters(
                    data.max_chapters ? String(data.max_chapters) : ''
                );
                setMinPrice(String(data.min_price));
                setMaxDiscount(String(data.max_discount));
                setHkiCost(String(Number(data.hki_cost ?? 0)));
                setIsbnPrintCost(String(Number(data.isbn_print_cost ?? 0)));
                setIsbnElectronicCost(
                    String(Number(data.isbn_electronic_cost ?? 0))
                );
                setMinBookCost(String(Number(data.min_book_cost ?? 0)));
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
                hki_cost: hkiCost || 0,
                isbn_print_cost: isbnPrintCost || 0,
                isbn_electronic_cost: isbnElectronicCost || 0,
                min_book_cost: minBookCost || 0,
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
        return <p className="text-oxford-navy-900/70">Memuat...</p>;
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
                    Pengaturan Book Chapter
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Batas jumlah bab, harga, dan diskon hanya berlaku untuk
                    proyek Book Chapter yang dibuat sendiri oleh Editor. Admin
                    tidak dibatasi saat membuat proyek.
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
                <small className="text-oxford-navy-900/65 -mt-2">
                    Diskon maksimal ini sekaligus menjadi fee editor pemilik
                    proyek: fee = diskon maksimal − diskon yang diberikan editor
                    (dalam % dari harga bab).
                </small>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Biaya Produksi 1 Buku
                </h5>
                <p className="text-oxford-navy-900/65 text-sm">
                    Sisa biaya = total harga bab − biaya HKI − biaya ISBN −
                    biaya fasilitas &amp; layanan yang dicentang pada proyek.
                    Sisa ini harus tidak kurang dari minimal biaya 1 buku.
                    Diskon tidak memengaruhi perhitungan ini. Aturan ini juga
                    berlaku bagi editor <em>dan</em> admin saat mengubah atau
                    menghapus bab.
                </p>

                <Input
                    label="Biaya HKI (Rp)"
                    type="number"
                    min="0"
                    value={hkiCost}
                    onChange={(e) => setHkiCost(e.target.value)}
                />
                <Input
                    label="Biaya ISBN Cetak (Rp)"
                    type="number"
                    min="0"
                    value={isbnPrintCost}
                    onChange={(e) => setIsbnPrintCost(e.target.value)}
                />
                <Input
                    label="Biaya e-ISBN (Rp)"
                    type="number"
                    min="0"
                    value={isbnElectronicCost}
                    onChange={(e) => setIsbnElectronicCost(e.target.value)}
                />
                <Input
                    label="Minimal Biaya Total 1 Buku (Rp)"
                    type="number"
                    min="0"
                    value={minBookCost}
                    onChange={(e) => setMinBookCost(e.target.value)}
                />
                <small className="text-oxford-navy-900/65 -mt-2">
                    Biaya fasilitas &amp; layanan lain diatur di menu{' '}
                    <Link
                        to="/admin/custom-package-items"
                        className="text-forest-moss-700 hover:text-forest-moss-800 underline"
                    >
                        Item Custom
                    </Link>{' '}
                    (kolom &quot;Biaya khusus Book Chapter&quot;; kosong =
                    gratis). HKI dan ISBN dipilih lewat kotak khusus di form
                    proyek — jangan isi biaya Book Chapter pada item HAKI/ISBN
                    di Item Custom supaya tidak terhitung dua kali.
                </small>

                {statusMessage && (
                    <p className="text-forest-moss-700 text-sm">
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
