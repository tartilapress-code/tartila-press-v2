// "File attachment" pengajuan ISBN: surat permohonan + surat keaslian
// (sudah bertanda tangan & berstempel), foto cover, lalu halaman dummy buku
// dari awal sampai Daftar Isi -- digabung menjadi satu PDF di browser.
// PDF.js (mencari Daftar Isi) dan pdf-lib (menggabung) dimuat malas.

/** Batas ukuran file attachment di formulir ISBN. */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

// Daftar Isi hampir selalu ada di halaman-halaman awal.
const MAX_SCAN_PAGES = 40;
const COVER_MAX_SIDE = 1800;
const COVER_JPEG_QUALITY = 0.85;

export type TocRange = {
    pageCount: number;
    /** Halaman pertama & terakhir Daftar Isi (mulai 1), null bila tidak ketemu. */
    tocStart: number | null;
    tocEnd: number | null;
};

/** Huruf kecil saja: "D A F T A R  I S I" dan "Daftar Isi" sama-sama "daftarisi". */
function letters(text: string): string {
    return text.toLowerCase().replace(/[^a-z]/g, '');
}

const TOC_HEADINGS = ['daftarisi', 'contents', 'tableofcontents'];

/** Judul halaman yang menandai Daftar Isi sudah selesai. */
function startsOtherSection(heading: string): boolean {
    return (
        /^daftar(tabel|gambar|lampiran|singkatan|istilah|pustaka|simbol)/.test(
            heading
        ) ||
        /^(bab|chapter)(i|1|satu)?$/.test(heading) ||
        heading === 'pendahuluan' ||
        heading === 'introduction'
    );
}

/** Baris Daftar Isi: teks diakhiri nomor halaman (angka atau romawi). */
const TOC_LINE = /[a-z].*?(\.{2,}|…|\s)\s*([ivxlc]{1,7}|\d{1,4})\s*$/i;

/**
 * Pasti entri (bukan judul): ada titik-titik sebelum nomor halaman, atau
 * diakhiri angka. "D A F T A R  I S I" dan "BAB I" tetap dianggap judul.
 */
const ENTRY_WITH_PAGE = /((\.{2,}|…)\s*([ivxlc]{1,7}|\d{1,4})|\s\d{1,4})\s*$/i;

type PdfPage = {
    getTextContent: () => Promise<{ items: unknown[] }>;
};

/** Teks satu halaman, per baris dari atas ke bawah. */
async function pageLines(page: PdfPage): Promise<string[]> {
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
        if (!item || typeof item !== 'object' || !('str' in item)) continue;

        const { str, transform } = item as {
            str: string;
            transform: number[];
        };

        if (!str.trim()) continue;

        // Item yang tingginya hampir sama dianggap satu baris.
        const y = Math.round(transform[5] / 3) * 3;
        const row = rows.get(y) ?? [];
        row.push({ x: transform[4], str });
        rows.set(y, row);
    }

    return [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) =>
            row
                .sort((a, b) => a.x - b.x)
                .map((part) => part.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim()
        )
        .filter((line) => line !== '');
}

function looksLikeToc(lines: string[]): boolean {
    const entries = lines.filter((line) => TOC_LINE.test(line)).length;

    return entries >= 3 && entries / Math.max(lines.length, 1) >= 0.4;
}

/**
 * Cari halaman Daftar Isi di PDF dummy: halaman dengan judul "Daftar Isi",
 * ditambah halaman lanjutannya selama isinya masih berupa baris daftar isi
 * dan belum masuk Daftar Tabel/Gambar atau Bab I.
 */
export async function findTableOfContents(
    pdfBytes: ArrayBuffer
): Promise<TocRange> {
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);

    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    // PDF.js memindahkan buffer ke worker, jadi beri salinannya.
    const doc = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;

    try {
        const pageCount = doc.numPages;
        const last = Math.min(pageCount, MAX_SCAN_PAGES);
        let tocStart: number | null = null;
        let tocEnd: number | null = null;

        for (let number = 1; number <= last; number++) {
            const page = await doc.getPage(number);
            const lines = await pageLines(page);
            page.cleanup();

            // Judul halaman: baris awal yang bukan entri daftar isi (entri
            // "Daftar Pustaka ..... 40" bukan judul Daftar Pustaka).
            const headings = lines
                .slice(0, 6)
                .filter((line) => !ENTRY_WITH_PAGE.test(line))
                .map(letters);

            if (tocStart === null) {
                if (
                    headings.some((heading) => TOC_HEADINGS.includes(heading))
                ) {
                    tocStart = number;
                    tocEnd = number;
                }
                continue;
            }

            const continues =
                !headings.some(startsOtherSection) && looksLikeToc(lines);

            if (!continues) break;

            tocEnd = number;
        }

        return { pageCount, tocStart, tocEnd };
    } finally {
        await doc.loadingTask.destroy();
    }
}

/** Foto cover sebagai JPEG yang ukurannya wajar (pdf-lib hanya terima JPG/PNG). */
async function coverAsJpeg(
    cover: Blob,
    maxSide = COVER_MAX_SIDE
): Promise<{ bytes: ArrayBuffer; width: number; height: number }> {
    const bitmap = await createImageBitmap(cover);

    try {
        const scale = Math.min(
            1,
            maxSide / Math.max(bitmap.width, bitmap.height)
        );
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Kanvas tidak tersedia.');

        // Latar putih untuk PNG transparan.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', COVER_JPEG_QUALITY)
        );

        canvas.width = 0;
        canvas.height = 0;

        if (!blob) throw new Error('Gagal mengolah foto cover.');

        return { bytes: await blob.arrayBuffer(), width, height };
    } finally {
        bitmap.close();
    }
}

/**
 * Cover untuk diunggah ke formulir (JPG/PNG maks. 5 MB): dipakai apa
 * adanya bila sudah memenuhi, selain itu diubah menjadi JPEG.
 */
export async function coverForUpload(
    cover: Blob
): Promise<{ blob: Blob; extension: 'jpg' | 'png' }> {
    const type = cover.type.toLowerCase();

    if (cover.size <= ATTACHMENT_MAX_BYTES) {
        if (type === 'image/jpeg' || type === 'image/jpg') {
            return { blob: cover, extension: 'jpg' };
        }
        if (type === 'image/png') return { blob: cover, extension: 'png' };
    }

    const { bytes } = await coverAsJpeg(cover, 3000);

    return {
        blob: new Blob([bytes], { type: 'image/jpeg' }),
        extension: 'jpg',
    };
}

export class EncryptedDummyError extends Error {}

/**
 * Gabungkan: surat (semua halaman) -> foto cover (opsional) -> halaman dummy
 * `fromPage`..`toPage` (mulai 1).
 */
export async function buildIsbnAttachment(options: {
    letters: ArrayBuffer;
    dummy: ArrayBuffer;
    cover: Blob | null;
    fromPage: number;
    toPage: number;
}): Promise<Blob> {
    const { PDFDocument, EncryptedPDFError } = await import('pdf-lib');

    const load = async (bytes: ArrayBuffer) => {
        try {
            return await PDFDocument.load(bytes);
        } catch (caught) {
            if (caught instanceof EncryptedPDFError) {
                throw new EncryptedDummyError(
                    'PDF dummy dikunci kata sandi, jadi halamannya tidak bisa digabung.'
                );
            }
            throw caught;
        }
    };

    const output = await PDFDocument.create();
    const lettersDoc = await load(options.letters);
    const dummyDoc = await load(options.dummy);

    for (const page of await output.copyPages(
        lettersDoc,
        lettersDoc.getPageIndices()
    )) {
        output.addPage(page);
    }

    const total = dummyDoc.getPageCount();
    const from = Math.min(Math.max(1, options.fromPage), total);
    const to = Math.min(Math.max(from, options.toPage), total);

    if (options.cover) {
        // Halaman cover selebar halaman dummy, tinggi mengikuti fotonya.
        const { bytes, width, height } = await coverAsJpeg(options.cover);
        const image = await output.embedJpg(bytes);
        const pageWidth = dummyDoc.getPage(from - 1).getWidth();
        const pageHeight = (pageWidth * height) / width;
        const page = output.addPage([pageWidth, pageHeight]);

        page.drawImage(image, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
        });
    }

    const indices = Array.from(
        { length: to - from + 1 },
        (_, i) => from - 1 + i
    );

    for (const page of await output.copyPages(dummyDoc, indices)) {
        output.addPage(page);
    }

    const bytes = await output.save();

    return new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: 'application/pdf',
    });
}

export function formatMegabytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toLocaleString('id-ID', {
        maximumFractionDigits: 1,
    })} MB`;
}
