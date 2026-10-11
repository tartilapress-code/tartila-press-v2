import { useState } from 'react';
import { RiDownload2Line } from '@remixicon/react';
import { describeApiError } from '@/lib/apiErrors';
import {
    promoFilename,
    renderChapterPromo,
    type ChapterPromoData,
} from '@/lib/chapterPromoPoster';
import { saveBlob } from '@/lib/download';

/**
 * Tombol yang mengambil data proyek TERBARU, menggambar poster promosi, lalu
 * langsung mengunduhnya. Tidak ada pratinjau atau gambar yang disimpan:
 * setiap klik membuat gambar baru (mis. setelah jumlah slot berubah).
 */
export default function PromoteProjectButton({
    load,
    withEditor,
    label = 'Unduh gambar promosi',
    className = '',
}: {
    load: () => Promise<{ data: ChapterPromoData }>;
    // true: nama editor ikut tercetak (versi "Promosikan Projek" editor).
    withEditor: boolean;
    label?: string;
    className?: string;
}) {
    const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>(
        'idle'
    );
    const [error, setError] = useState<string>('');

    async function run() {
        setState('working');
        setError('');

        try {
            const response = await load();
            const blob = await renderChapterPromo(response.data, withEditor);
            saveBlob(blob, promoFilename(response.data));
            setState('done');
        } catch (caught) {
            setError(describeApiError(caught));
            setState('error');
        }
    }

    return (
        <span className={`inline-flex flex-col gap-1 ${className}`}>
            <button
                type="button"
                onClick={run}
                disabled={state === 'working'}
                className="inline-flex items-center gap-2 rounded-lg bg-oxford-navy-700 px-3 py-2 text-sm font-semibold text-white hover:cursor-pointer hover:bg-oxford-navy-800 disabled:cursor-wait disabled:opacity-60"
            >
                <RiDownload2Line aria-hidden className="size-4" />
                {state === 'working' ? 'Membuat gambar...' : label}
            </button>
            {state === 'done' && (
                <span className="text-xs text-forest-moss-700">
                    Gambar diunduh. Klik lagi untuk membuat ulang dengan data
                    terbaru.
                </span>
            )}
            {state === 'error' && (
                <span className="text-xs text-red-600">{error}</span>
            )}
        </span>
    );
}
