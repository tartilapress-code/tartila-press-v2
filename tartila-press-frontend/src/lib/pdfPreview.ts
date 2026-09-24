// Membuka PDF preview buku dan merender halamannya menjadi gambar untuk
// flipbook. PDF.js dimuat malas: pustakanya baru diunduh saat flipbook
// dibuka pertama kali.

import type { PDFDocumentProxy } from 'pdfjs-dist';

// Lebar gambar tiap halaman (px): cukup tajam untuk dua halaman berdampingan
// di layar penuh, tetapi tetap ringan di memori.
const PAGE_IMAGE_WIDTH = 1000;
const JPEG_QUALITY = 0.86;

// Berapa halaman yang dirender di depan/belakang halaman aktif, dan sejauh
// apa gambar halaman lama masih disimpan sebelum dilepas dari memori.
const RENDER_AHEAD = 6;
const RENDER_BEHIND = 2;
const KEEP_RADIUS = 12;

export type PageImage =
    { kind: 'ready'; url: string } | { kind: 'failed' } | { kind: 'evicted' };

export type PageImageListener = (page: number, image: PageImage) => void;

/**
 * Penyimpan gambar halaman sebuah PDF. Halaman dirender berurutan (dimulai
 * dari yang paling dekat dengan halaman aktif) menjadi gambar JPEG, dan yang
 * sudah jauh dari halaman aktif dilepas lagi supaya memori tetap terbatas
 * bahkan untuk PDF yang panjang. Nomor halaman dimulai dari 1.
 */
export class PdfPageStore {
    readonly pageCount: number;
    /**
     * PDF menandai halaman pertamanya berada di sisi kanan pada tampilan dua
     * halaman ("Two-Up (Cover Page)" di Acrobat), seperti halaman judul buku
     * cetak. Tanpa penanda, halaman pertama di sisi kiri.
     */
    readonly firstPageOnRight: boolean;

    private readonly doc: PDFDocumentProxy;
    private readonly urls = new Map<number, string>();
    private readonly failed = new Set<number>();
    private readonly pending = new Set<number>();
    private readonly listeners = new Set<PageImageListener>();
    private tail: Promise<void> = Promise.resolve();
    private center = 1;
    private disposed = false;

    constructor(doc: PDFDocumentProxy, firstPageOnRight = false) {
        this.doc = doc;
        this.pageCount = doc.numPages;
        this.firstPageOnRight = firstPageOnRight;
    }

    /** Gambar halaman yang sudah ada saat ini (null bila belum dirender). */
    getImage(page: number): PageImage | null {
        const url = this.urls.get(page);

        if (url) return { kind: 'ready', url };
        if (this.failed.has(page)) return { kind: 'failed' };

        return null;
    }

    /** Berlangganan pembaruan gambar halaman; mengembalikan fungsi berhenti. */
    subscribe(listener: PageImageListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Pusatkan perhatian pada satu halaman: render halaman itu dan
     * tetangganya (yang di depan lebih banyak), lalu lepas yang sudah jauh.
     */
    focus(page: number): void {
        if (this.disposed) return;

        this.center = page;

        const order = [page];
        for (let step = 1; step <= RENDER_AHEAD; step++) {
            order.push(page + step);
            if (step <= RENDER_BEHIND) order.push(page - step);
        }

        order
            .filter((n) => n >= 1 && n <= this.pageCount)
            .forEach((n) => this.enqueue(n));

        this.evictFar();
    }

    /** Lepas semua gambar dan tutup dokumen PDF. */
    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;
        this.urls.forEach((url) => URL.revokeObjectURL(url));
        this.urls.clear();
        this.listeners.clear();
        void this.doc.loadingTask.destroy();
    }

    private isNearCenter(page: number): boolean {
        return Math.abs(page - this.center) <= KEEP_RADIUS;
    }

    private emit(page: number, image: PageImage): void {
        this.listeners.forEach((listener) => listener(page, image));
    }

    private enqueue(page: number): void {
        if (
            this.urls.has(page) ||
            this.failed.has(page) ||
            this.pending.has(page)
        ) {
            return;
        }

        this.pending.add(page);
        this.tail = this.tail.then(() => this.renderPage(page));
    }

    private async renderPage(page: number): Promise<void> {
        try {
            // Antrean bisa tertinggal saat pembaca membalik halaman cepat.
            if (this.disposed || !this.isNearCenter(page)) return;

            const url = await this.renderToObjectUrl(page);

            if (this.disposed || !this.isNearCenter(page)) {
                URL.revokeObjectURL(url);
                return;
            }

            this.urls.set(page, url);
            this.emit(page, { kind: 'ready', url });
        } catch {
            if (!this.disposed) {
                this.failed.add(page);
                this.emit(page, { kind: 'failed' });
            }
        } finally {
            this.pending.delete(page);
        }
    }

    private evictFar(): void {
        for (const [page, url] of this.urls) {
            if (this.isNearCenter(page)) continue;

            URL.revokeObjectURL(url);
            this.urls.delete(page);
            this.emit(page, { kind: 'evicted' });
        }
    }

    private async renderToObjectUrl(pageNumber: number): Promise<string> {
        const page = await this.doc.getPage(pageNumber);

        try {
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({
                scale: PAGE_IMAGE_WIDTH / base.width,
            });

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('Canvas tidak tersedia.');

            await page.render({ canvas, canvasContext: context, viewport })
                .promise;

            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
            );

            // Bebaskan memori kanvas segera; gambarnya kini ada di blob.
            canvas.width = 0;
            canvas.height = 0;

            if (!blob) throw new Error('Halaman gagal dikonversi.');

            return URL.createObjectURL(blob);
        } finally {
            page.cleanup();
        }
    }
}

// Tata letak halaman yang tertulis di PDF: halaman ganjil di kanan berarti
// halaman pertama (sampul isi/halaman judul) berada di sisi kanan.
async function readsFirstPageOnRight(doc: PDFDocumentProxy): Promise<boolean> {
    try {
        const layout = await doc.getPageLayout();

        return layout === 'TwoPageRight' || layout === 'TwoColumnRight';
    } catch {
        return false;
    }
}

/** Unduh dan buka PDF dari `url`, siap dirender halaman demi halaman. */
export async function openPdfPageStore(url: string): Promise<PdfPageStore> {
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);

    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const doc = await pdfjs.getDocument({ url, withCredentials: false })
        .promise;

    return new PdfPageStore(doc, await readsFirstPageOnRight(doc));
}
