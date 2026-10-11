import { useEffect, useState } from 'react';
import Button from '@/components/Button/Button';
import PublicationTimeline from '@/components/publication/PublicationTimeline';
import * as publicationApi from '@/data/publication/publicationApi';
import { describeApiError } from '@/lib/apiErrors';

/**
 * "Riwayat Status Proses" di detail Naskah Saya: tampil setelah naskah
 * selesai (Book Chapter: setelah naskah gabungan selesai).
 */
export default function ManuscriptPublicationCard({
    manuscriptId,
}: {
    manuscriptId: number;
}) {
    const [progress, setProgress] =
        useState<publicationApi.PublicationProgress | null>(null);
    const [isBusy, setIsBusy] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        let active = true;

        publicationApi
            .forManuscript(manuscriptId)
            .then((response) => {
                if (active) setProgress(response.data);
            })
            .catch(() => {
                if (active) setProgress(null);
            });

        return () => {
            active = false;
        };
    }, [manuscriptId]);

    if (!progress) return null;

    async function confirmDelivery() {
        setIsBusy(true);
        setError('');

        try {
            const response = await publicationApi.confirmDelivery(manuscriptId);
            setProgress(response.data);
        } catch (caught) {
            setError(describeApiError(caught));
        } finally {
            setIsBusy(false);
        }
    }

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <div className="flex flex-col gap-1">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Riwayat Status Proses
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Tahap penerbitan setelah naskah selesai. HAKI dan buku fisik
                    mengikuti paket yang Anda pilih.
                </p>
            </div>

            <PublicationTimeline
                progress={progress}
                actions={
                    progress.can_confirm_delivery ? (
                        <div className="flex flex-col gap-2 rounded-xl bg-forest-moss-50 p-4 ring-1 ring-forest-moss-200">
                            <p className="text-sm text-oxford-navy-900">
                                Buku sedang dikirim. Sudah diterima? Konfirmasi
                                agar prosesnya tercatat selesai.
                            </p>
                            <Button
                                variant="primary"
                                className="self-start"
                                disabled={isBusy}
                                onClick={confirmDelivery}
                            >
                                {isBusy ? 'Menyimpan...' : 'Buku sudah sampai'}
                            </Button>
                            {error && (
                                <p className="text-xs text-red-600">{error}</p>
                            )}
                        </div>
                    ) : null
                }
            />
        </div>
    );
}
