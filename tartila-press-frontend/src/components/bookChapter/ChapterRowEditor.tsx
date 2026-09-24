import { useState } from 'react';
import Button from '@/components/Button/Button';
import { ApiError } from '@/lib/http';

export type EditableChapter = {
    id: number;
    chapter_number: number;
    title: string;
    price: string | null;
    discount: number | null;
    manuscript_id: number | null;
    order_id: number | null;
};

export type ChapterPatch = {
    title: string;
    price: string | null;
    discount: number | null;
};

const fieldClass =
    'p-2 rounded-lg ring-1 ring-forest-moss-200 placeholder:text-oxford-navy-900/40 bg-transparent text-oxford-navy-900 text-sm outline-none';

/**
 * Baris bab yang bisa diubah/dihapus. Server menolak perubahan yang membuat
 * sisa biaya 1 buku di bawah minimal — pesannya ditampilkan di bawah baris.
 * Beri `key` yang memuat nilai bab supaya baris ter-reset setelah dimuat ulang.
 */
export default function ChapterRowEditor({
    chapter,
    onSave,
    onDelete,
}: {
    chapter: EditableChapter;
    onSave: (id: number, patch: ChapterPatch) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}) {
    const initialPrice =
        chapter.price === null ? '' : String(Number(chapter.price));
    const initialDiscount =
        chapter.discount === null ? '' : String(chapter.discount);

    const [title, setTitle] = useState<string>(chapter.title);
    const [price, setPrice] = useState<string>(initialPrice);
    const [discount, setDiscount] = useState<string>(initialDiscount);
    const [message, setMessage] = useState<string>('');
    const [isBusy, setIsBusy] = useState<boolean>(false);

    const isOpen = !chapter.manuscript_id && !chapter.order_id;
    const isDirty =
        title !== chapter.title ||
        price !== initialPrice ||
        discount !== initialDiscount;

    async function run(action: () => Promise<void>) {
        setIsBusy(true);
        setMessage('');

        try {
            await action();
        } catch (error) {
            setMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-2 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-3">
            <div className="flex flex-row items-center gap-2">
                <span className="text-oxford-navy-900/55 text-xs shrink-0">
                    Bab {chapter.chapter_number}
                </span>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`flex-1 ${fieldClass}`}
                    aria-label={`Judul bab ${chapter.chapter_number}`}
                />
                <span className="text-oxford-navy-900/65 text-xs shrink-0">
                    {chapter.manuscript_id
                        ? 'Terisi'
                        : chapter.order_id
                          ? 'Dipesan'
                          : 'Terbuka'}
                </span>
            </div>

            <div className="flex flex-row flex-wrap gap-2">
                <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Harga custom (kosongkan = ikut proyek)"
                    className={`flex-1 min-w-48 ${fieldClass}`}
                    aria-label="Harga bab"
                />
                <input
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="Diskon custom (%)"
                    className={`w-40 ${fieldClass}`}
                    aria-label="Diskon bab"
                />
                <Button
                    type="button"
                    variant="outline2"
                    disabled={isBusy || !isDirty || title.trim() === ''}
                    onClick={() =>
                        run(() =>
                            onSave(chapter.id, {
                                title,
                                price: price.trim() === '' ? null : price,
                                discount:
                                    discount.trim() === ''
                                        ? null
                                        : Number(discount),
                            })
                        )
                    }
                >
                    Simpan
                </Button>
                {isOpen && (
                    <Button
                        type="button"
                        variant="outline2"
                        disabled={isBusy}
                        onClick={() => run(() => onDelete(chapter.id))}
                    >
                        Hapus
                    </Button>
                )}
            </div>

            {message && (
                <p role="alert" className="text-red-700 text-sm">
                    {message}
                </p>
            )}
        </div>
    );
}
