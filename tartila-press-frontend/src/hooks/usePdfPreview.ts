import { useEffect, useState } from 'react';
import { openPdfPageStore, type PdfPageStore } from '@/lib/pdfPreview';

export type PdfPreviewState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; store: PdfPageStore }
    | { status: 'error' };

/**
 * Memuat PDF preview dari `url`, tetapi baru setelah `active` bernilai true
 * (mis. saat pembaca membuka flipbook), supaya halaman detail buku tidak
 * mengunduh PDF.js maupun PDF-nya bila tidak diperlukan. Gambar halaman
 * dilepas otomatis saat komponen dilepas atau `url` berubah. Menaikkan
 * `attempt` memuat ulang (mis. mencoba lagi setelah gagal).
 */
export function usePdfPreview(
    url: string,
    active: boolean,
    attempt = 0
): PdfPreviewState {
    const [state, setState] = useState<PdfPreviewState>({ status: 'idle' });

    useEffect(() => {
        if (!active) {
            return;
        }

        let cancelled = false;
        let opened: PdfPageStore | null = null;

        Promise.resolve()
            .then(() => {
                setState({ status: 'loading' });

                return openPdfPageStore(url);
            })
            .then((store) => {
                if (cancelled) {
                    store.dispose();
                    return;
                }

                opened = store;
                setState({ status: 'ready', store });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'error' });
            });

        return () => {
            cancelled = true;
            opened?.dispose();
        };
    }, [url, active, attempt]);

    return state;
}
