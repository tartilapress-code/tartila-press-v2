// Pembangun halaman flipbook. Elemen dibuat lewat DOM biasa (bukan React)
// karena library page-flip memindahkan dan menggandakan elemen halaman —
// React tidak boleh ikut memilikinya.

import type { PageImage } from '@/lib/pdfPreview';

/** Hal-hal yang menentukan susunan halaman buku (bukan tampilannya). */
export type FlipbookShape = {
    pdfPageCount: number;
    /**
     * Tampilan dua halaman mungkin dipakai (layout besar). Hanya di situ
     * halaman kosong ditambahkan; pada tampilan satu halaman (hero) tidak ada
     * halaman kosong yang perlu dibalik.
     */
    paired: boolean;
    /** Halaman PDF pertama berada di sisi kanan (`PdfPageStore.firstPageOnRight`). */
    firstPageOnRight: boolean;
};

/**
 * Teks yang tertulis di dalam halaman flipbook. Halaman dibuat lewat DOM biasa,
 * jadi teksnya (sudah diterjemahkan) diberikan dari luar oleh komponen.
 */
export type FlipbookLabels = {
    // Tulisan di sampul belakang pengganti.
    endOfPreview: string;
    // Pengganti halaman PDF yang gagal dirender.
    pageFailed: string;
    // Teks alternatif gambar halaman PDF.
    pageAlt: (page: number) => string;
};

export type FlipbookPagesOptions = FlipbookShape & {
    title: string;
    frontCover: string | null;
    // Sampul cadangan bila sampul depan kosong/gagal dimuat (mis. sampul
    // bawaan Book Chapter).
    fallbackCover?: string;
    backCover: string | null;
    labels: FlipbookLabels;
};

/** Tampilan satu halaman PDF di flipbook; diperbarui saat gambarnya siap. */
export type PdfPageView = { setImage: (image: PageImage) => void };

export type FlipbookPages = {
    /**
     * Halaman buku berurutan: sampul depan, halaman PDF, sampul belakang
     * (ditambah halaman kosong bila perlu, lihat `blankPages`).
     */
    elements: HTMLElement[];
    /** Tampilan tiap halaman PDF, dengan nomor halaman PDF (mulai 1) sebagai kunci. */
    views: Map<number, PdfPageView>;
};

// Halaman kosong yang ditambahkan (hanya bila `paired`):
// - `lead`: bagian dalam sampul depan, supaya halaman PDF pertama jatuh di
//   sisi kanan seperti halaman judul buku cetak;
// - `filler`: penggenap di ujung, supaya sampul belakang berdiri sendiri.
function blankPages(shape: FlipbookShape): { lead: number; filler: number } {
    const lead = shape.paired && shape.firstPageOnRight ? 1 : 0;
    const filler =
        shape.paired && (lead + shape.pdfPageCount) % 2 === 1 ? 1 : 0;

    return { lead, filler };
}

/** Susunan halaman untuk sebuah PDF yang dibuka di layout tertentu. */
export function flipbookShape(
    pdf: { pageCount: number; firstPageOnRight: boolean },
    paired: boolean
): FlipbookShape {
    return {
        pdfPageCount: pdf.pageCount,
        paired,
        firstPageOnRight: pdf.firstPageOnRight,
    };
}

/**
 * Jumlah halaman buku: sampul depan + halaman PDF (+ halaman kosong, lihat
 * `blankPages`) + sampul belakang.
 */
export function bookPageCount(shape: FlipbookShape): number {
    const { lead, filler } = blankPages(shape);

    return 2 + lead + shape.pdfPageCount + filler;
}

/**
 * Posisi baca yang sama di semua layout: 0 = sampul depan, 1..N = halaman PDF,
 * N + 1 = sampul belakang. Dipakai untuk mengingat halaman saat pindah antara
 * flipbook di hero dan tampilan besar, yang nomor halaman bukunya bisa
 * berbeda karena halaman kosong.
 */
export function positionToIndex(
    position: number,
    shape: FlipbookShape
): number {
    if (position <= 0) return 0;
    if (position > shape.pdfPageCount) return bookPageCount(shape) - 1;

    return position + blankPages(shape).lead;
}

export function indexToPosition(index: number, shape: FlipbookShape): number {
    if (index <= 0) return 0;
    if (index >= bookPageCount(shape) - 1) return shape.pdfPageCount + 1;

    return Math.min(
        Math.max(index - blankPages(shape).lead, 1),
        shape.pdfPageCount
    );
}

/**
 * Keterangan posisi baca: jenis halaman (sampul, bagian dalam sampul, halaman
 * kosong) atau nomor halaman PDF yang tampil. Teksnya disusun komponen lewat
 * terjemahan.
 */
export type PositionLabel =
    | { kind: 'cover' | 'backCover' | 'insideCover' | 'blank' }
    | { kind: 'page'; page: number; total: number }
    | { kind: 'spread'; left: number; right: number; total: number };

/**
 * Keterangan posisi baca untuk `index` (nomor halaman buku yang sedang
 * ditampilkan; pada tampilan dua halaman = halaman kiri).
 */
export function describePosition(
    index: number,
    portrait: boolean,
    shape: FlipbookShape
): PositionLabel {
    const { lead } = blankPages(shape);
    const total = shape.pdfPageCount;

    if (index <= 0) return { kind: 'cover' };
    if (index >= bookPageCount(shape) - 1) return { kind: 'backCover' };

    if (portrait) {
        if (index <= lead) return { kind: 'insideCover' };

        // Halaman kosong di ujung hanya ada untuk menggenapkan jumlah halaman.
        return index - lead > total
            ? { kind: 'blank' }
            : { kind: 'page', page: index - lead, total };
    }

    // Tampilan dua halaman: spread dimulai dari halaman buku ganjil.
    const left = (index % 2 === 1 ? index : index - 1) - lead;
    const right = left + 1;

    // Sisi kiri spread pertama bisa berupa bagian dalam sampul (kosong).
    if (left < 1) return { kind: 'page', page: right, total };

    return right <= total
        ? { kind: 'spread', left, right, total }
        : { kind: 'page', page: left, total };
}

function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;

    return node;
}

// Sampul pengganti (tanpa gambar): panel navy dengan tulisan, sama seperti
// sampul pengganti di katalog. Ukuran huruf mengikuti lebar halaman (cqw).
function createCoverPlaceholder(
    title: string,
    side: 'front' | 'back',
    labels: FlipbookLabels
): HTMLElement {
    const panel = element(
        'div',
        'absolute inset-0 flex flex-col items-center justify-between bg-linear-to-br from-oxford-navy-600 via-oxford-navy-700 to-oxford-navy-900 p-[9cqw] text-center'
    );
    const rule = element('span', 'h-px w-[28cqw] bg-forest-moss-300/70');
    const heading = element(
        'span',
        'font-display line-clamp-5 text-[10.5cqw] font-semibold leading-tight text-white'
    );
    const footer = element(
        'span',
        'text-[6cqw] font-medium uppercase tracking-[0.25em] text-forest-moss-200/80'
    );

    if (side === 'front') {
        heading.textContent = title;
    } else {
        heading.textContent = labels.endOfPreview;
    }
    footer.textContent = 'Tartila Press';
    panel.append(rule, heading, footer);

    return panel;
}

// Halaman sampul (keras): mencoba gambar berurutan, lalu sampul pengganti.
function createCoverPage(
    title: string,
    sources: string[],
    side: 'front' | 'back',
    labels: FlipbookLabels
): HTMLElement {
    const page = element(
        'div',
        '@container relative overflow-hidden bg-oxford-navy-50'
    );
    page.dataset.density = 'hard';

    const spine = element(
        'span',
        `pointer-events-none absolute inset-y-0 z-10 w-[7%] from-black/25 via-white/20 to-transparent ${
            side === 'front'
                ? 'left-0 bg-linear-to-r'
                : 'right-0 bg-linear-to-l'
        }`
    );

    const show = (index: number) => {
        const src = sources[index];

        if (!src) {
            page.replaceChildren(
                createCoverPlaceholder(title, side, labels),
                spine
            );
            return;
        }

        const image = element(
            'img',
            'absolute inset-0 h-full w-full select-none object-cover'
        );
        image.alt = '';
        image.draggable = false;
        image.addEventListener('error', () => show(index + 1), { once: true });
        image.src = src;
        page.replaceChildren(image, spine);
    };

    show(0);

    return page;
}

// Kertas halaman isi: sedikit krem, bertepi tipis dan berbayang lembut supaya
// batas halaman tetap terlihat di atas latar putih.
const PAPER_CLASS =
    'relative overflow-hidden bg-[#fbfaf5] shadow-[0_10px_28px_-14px_rgba(1,26,44,0.55)] ring-1 ring-oxford-navy-900/10';

function createBlankPage(): HTMLElement {
    return element('div', PAPER_CLASS);
}

// Halaman isi (lembut): spinner sampai gambar halaman PDF-nya siap.
function createPdfPage(
    pageNumber: number,
    labels: FlipbookLabels
): {
    page: HTMLElement;
    view: PdfPageView;
} {
    const page = element('div', PAPER_CLASS);

    const spinner = element(
        'span',
        'absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-forest-moss-200 border-t-forest-moss-600'
    );
    const failure = element(
        'span',
        'absolute inset-x-0 top-1/2 hidden -translate-y-1/2 px-6 text-center text-xs text-oxford-navy-900/50'
    );
    failure.textContent = labels.pageFailed;

    const image = element(
        'img',
        'absolute inset-0 h-full w-full select-none object-contain opacity-0 transition-opacity duration-200'
    );
    image.alt = labels.pageAlt(pageNumber);
    image.draggable = false;
    image.addEventListener('load', () => {
        image.classList.remove('opacity-0');
        spinner.classList.add('hidden');
    });

    page.append(spinner, failure, image);

    const view: PdfPageView = {
        setImage(pageImage) {
            if (pageImage.kind === 'ready') {
                failure.classList.add('hidden');
                image.src = pageImage.url;
                return;
            }

            image.removeAttribute('src');
            image.classList.add('opacity-0');
            spinner.classList.toggle('hidden', pageImage.kind === 'failed');
            failure.classList.toggle('hidden', pageImage.kind !== 'failed');
        },
    };

    return { page, view };
}

/** Bangun semua halaman flipbook untuk sebuah buku. */
export function buildFlipbookPages(
    options: FlipbookPagesOptions
): FlipbookPages {
    const {
        title,
        frontCover,
        fallbackCover,
        backCover,
        pdfPageCount,
        labels,
    } = options;
    const { lead, filler } = blankPages(options);

    const frontSources = [frontCover, fallbackCover].filter(
        (src): src is string => Boolean(src)
    );
    const backSources = backCover ? [backCover] : [];

    const elements: HTMLElement[] = [
        createCoverPage(title, frontSources, 'front', labels),
    ];
    const views = new Map<number, PdfPageView>();

    if (lead) {
        elements.push(createBlankPage());
    }

    for (let pageNumber = 1; pageNumber <= pdfPageCount; pageNumber++) {
        const { page, view } = createPdfPage(pageNumber, labels);

        elements.push(page);
        views.set(pageNumber, view);
    }

    if (filler) {
        elements.push(createBlankPage());
    }

    elements.push(createCoverPage(title, backSources, 'back', labels));

    return { elements, views };
}
