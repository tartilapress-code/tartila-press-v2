import { useCallback, useEffect, useRef } from 'react';
import { recordReads } from '@/data/readerApi';

// Halaman baru dihitung "terbaca" bila tampil di layar sedikitnya sekian
// detik, supaya membalik/menggulir cepat tidak menaikkan hitungan.
export const DWELL_MS = 3000;
const FLUSH_MS = 5000;
const FLUSH_SIZE = 10;

/**
 * Mencatat halaman yang benar-benar dibaca. `visit(pages)` diberi daftar
 * halaman yang sedang tampil; halaman yang bertahan DWELL_MS dikirim ke
 * server (yang menghitung satu pembaca-halaman-hari sebagai 1). Halaman yang
 * sudah dikirim dalam sesi ini tidak dikirim lagi.
 */
export function useReadTracker(bookId: number, enabled: boolean) {
    const timers = useRef(new Map<number, number>());
    const reported = useRef(new Set<number>());
    const queue = useRef<number[]>([]);
    const flushTimer = useRef<number | undefined>(undefined);

    const flush = useCallback(() => {
        window.clearTimeout(flushTimer.current);
        flushTimer.current = undefined;

        const pages = queue.current.splice(0, queue.current.length);

        if (pages.length > 0) {
            // Gagal sesaat tidak perlu mengganggu pembaca.
            recordReads(bookId, pages).catch(() => undefined);
        }
    }, [bookId]);

    const visit = useCallback(
        (pages: number[]) => {
            if (!enabled) return;

            // Berhenti menghitung halaman yang sudah tidak tampil.
            for (const [page, timer] of timers.current) {
                if (!pages.includes(page)) {
                    window.clearTimeout(timer);
                    timers.current.delete(page);
                }
            }

            for (const page of pages) {
                if (reported.current.has(page) || timers.current.has(page))
                    continue;

                timers.current.set(
                    page,
                    window.setTimeout(() => {
                        timers.current.delete(page);
                        reported.current.add(page);
                        queue.current.push(page);

                        if (queue.current.length >= FLUSH_SIZE) {
                            flush();
                        } else if (flushTimer.current === undefined) {
                            flushTimer.current = window.setTimeout(
                                flush,
                                FLUSH_MS
                            );
                        }
                    }, DWELL_MS)
                );
            }
        },
        [enabled, flush]
    );

    // Saat pembaca menutup buku / pindah halaman web: kirim yang tersisa.
    useEffect(() => {
        const pending = timers.current;

        const onHide = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        document.addEventListener('visibilitychange', onHide);

        return () => {
            document.removeEventListener('visibilitychange', onHide);
            pending.forEach((timer) => window.clearTimeout(timer));
            pending.clear();
            flush();
        };
    }, [flush]);

    return visit;
}
