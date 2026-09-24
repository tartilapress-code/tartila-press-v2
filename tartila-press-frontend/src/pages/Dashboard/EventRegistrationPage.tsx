import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/Button/Button';
import DocumentInput from '@/components/Input/DocumentInput';
import * as eventApi from '@/data/event/eventApi';
import type { Event } from '@/data/event/eventApi';
import { ApiError } from '@/lib/http';

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

export default function EventRegistrationPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<Event | null>(null);
    const [documentUrl, setDocumentUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        eventApi
            .get(slug ?? '')
            .then((response) => setEvent(response.data))
            .catch(() => setEvent(null))
            .finally(() => setIsLoading(false));
    }, [slug]);

    async function handleSubmit() {
        if (!event) return;

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await eventApi.register(event.slug, {
                document_url: documentUrl || undefined,
            });
            navigate(
                response.data.order_id
                    ? '/dashboard/pesanan'
                    : '/dashboard/event-saya'
            );
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

    if (!event) {
        return <p className="text-oxford-navy-900">Event tidak ditemukan.</p>;
    }

    const fee = Number(event.fee);
    const canSubmit = !event.requires_document || documentUrl !== '';

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 max-w-xl">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                Daftar Event: {event.title}
            </h5>

            {event.requires_document && (
                <DocumentInput
                    label="Unggah Dokumen yang Dibutuhkan"
                    value={documentUrl}
                    onChange={setDocumentUrl}
                    folder="event-documents"
                />
            )}

            <div className="border-t border-forest-moss-200 pt-4">
                <p className="text-oxford-navy-900 text-lg font-semibold">
                    Total: {fee > 0 ? rupiahFormatter.format(fee) : 'Gratis'}
                </p>
                {fee > 0 && (
                    <p className="text-oxford-navy-900/65 text-sm">
                        Setelah konfirmasi, Anda akan diarahkan ke halaman
                        Pesanan untuk mengunggah bukti pembayaran.
                    </p>
                )}
            </div>

            {errorMessage && (
                <p className="text-red-600 text-sm">{errorMessage}</p>
            )}

            <Button
                variant="primary"
                className="self-start"
                onClick={handleSubmit}
                disabled={isSubmitting || !canSubmit}
            >
                {isSubmitting ? 'Memproses...' : 'Konfirmasi Pendaftaran'}
            </Button>
        </div>
    );
}
