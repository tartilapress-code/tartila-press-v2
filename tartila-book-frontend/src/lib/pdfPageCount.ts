// Jumlah halaman PDF yang dibaca di peramban (Tartila Book butuh angkanya,
// server tidak punya pustaka PDF). PDF.js dimuat malas dan berkasnya dibaca
// bertahap lewat blob URL, bukan disalin utuh ke memori.

export async function readPdfPageCount(file: File): Promise<number> {
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const url = URL.createObjectURL(file);
    const task = pdfjs.getDocument({ url });

    try {
        const doc = await task.promise;

        return doc.numPages;
    } finally {
        await task.destroy();
        URL.revokeObjectURL(url);
    }
}
