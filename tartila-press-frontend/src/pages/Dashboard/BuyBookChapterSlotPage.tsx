import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import * as bookChapterProjectApi from '@/data/bookChapterProject/bookChapterProjectApi';
import * as orderApi from '@/data/order/orderApi';
import { ApiError } from '@/lib/http';

type ChapterSlot = {
    id: number;
    chapter_number: number;
    title: string;
    final_price: number;
    slot_status: 'open' | 'reserved' | 'submitted' | 'completed';
};

type ProjectDetail = {
    id: number;
    title: string;
    chapters: ChapterSlot[];
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function BuyBookChapterSlotPage() {
    const { projectId, chapterId } = useParams<{
        projectId: string;
        chapterId: string;
    }>();
    const navigate = useNavigate();

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        Promise.resolve()
            .then(() => bookChapterProjectApi.get(projectId ?? ''))
            .then((response) => setProject(response.data))
            .catch(() => setProject(null))
            .finally(() => setIsLoading(false));
    }, [projectId]);

    const chapter = project?.chapters.find((c) => String(c.id) === chapterId);

    async function handleSubmit() {
        if (!chapter) return;

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            await orderApi.create({
                type: 'book_chapter',
                book_chapter_id: chapter.id,
            });
            navigate('/dashboard/pesanan');
        } catch (error) {
            setErrorMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!project || !chapter) {
        return <p className="text-oxford-navy-900">Slot bab tidak ditemukan.</p>;
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 max-w-xl">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Beli Slot Bab: {project.title}
            </h5>
            <p className="text-oxford-navy-900/80">
                Bab {chapter.chapter_number} — {chapter.title}
            </p>

            {chapter.slot_status !== 'open' ? (
                <p className="text-red-600 text-sm">
                    Slot bab ini sudah tidak tersedia.
                </p>
            ) : (
                <>
                    <div className="border-t border-forest-moss-200 pt-4">
                        <p className="text-oxford-navy-900 text-lg font-semibold">
                            Total: {rupiahFormatter.format(chapter.final_price)}
                        </p>
                    </div>

                    {errorMessage && (
                        <p className="text-red-600 text-sm">{errorMessage}</p>
                    )}

                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Memproses...' : 'Konfirmasi Beli Slot Ini'}
                    </Button>
                </>
            )}
        </div>
    );
}
