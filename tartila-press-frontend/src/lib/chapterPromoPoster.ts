// Poster promosi proyek Book Chapter untuk sosmed (1080 × 1350, rasio 4:5).
// Satu desain, isinya berganti sesuai data: bidang, judul, judul bab, jumlah
// slot, dan (versi editor) nama editor. Gambar dibuat HANYA saat tombol
// diklik, dari data terbaru server, lalu kanvasnya dibuang — tidak ada
// gambar yang disimpan di memori halaman.
import { apiUrl } from '@/lib/http';
import {
    CONTACT,
    FONT_SANS,
    FONT_SERIF,
    loadPosterFonts,
} from '@/lib/socialPoster';

export type ChapterPromoData = {
    id: number;
    title: string;
    field: string | null;
    category: string | null;
    editor_name: string | null;
    submission_deadline: string | null;
    chapters: { number: number; title: string; open: boolean }[];
    open_slots: number;
    total_slots: number;
    url: string;
};

const W = 1080;
const H = 1350;
const PAD = 64;

const NAVY = '#10315f';
const NAVY_SOFT = '#1d4479';
const SAGE = '#c7d6b1';
const SAGE_DARK = '#5f7a3d';
const PAPER = '#f4f6f9';
const WHITE = '#ffffff';
const MUTED = '#6b7a90';
const TAKEN = '#c5cdd8';

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, family: string, size: number, weight = 400) {
    ctx.font = `${weight} ${size}px "${family}", Arial, sans-serif`;
}

function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';

    for (const word of text.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;

        if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }

    if (line) lines.push(line);

    return lines;
}

/** Potong satu baris dengan "…" bila lebih lebar dari batas. */
function clip(ctx: Ctx, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;

    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
        cut = cut.slice(0, -1);
    }

    return `${cut.trimEnd()}…`;
}

function pill(ctx: Ctx, x: number, y: number, w: number, h: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
}

/** "2026-11-30" -> "30 November 2026" (tanpa zona waktu). */
function longDate(iso: string): string {
    const months = [
        'Januari',
        'Februari',
        'Maret',
        'April',
        'Mei',
        'Juni',
        'Juli',
        'Agustus',
        'September',
        'Oktober',
        'November',
        'Desember',
    ];

    return `${Number(iso.slice(8, 10))} ${months.at(Number(iso.slice(5, 7)) - 1) ?? ''} ${iso.slice(0, 4)}`;
}

type Chapter = ChapterPromoData['chapters'][number];

/** Satu baris per bab: nomor, judul, dan label Tersedia/Terisi. */
function drawSingleColumn(
    ctx: Ctx,
    chapters: Chapter[],
    top: number,
    rowHeight: number
) {
    const textSize = Math.round(Math.min(30, rowHeight * 0.46));

    chapters.forEach((chapter, index) => {
        const y = top + index * rowHeight;
        const mid = y + rowHeight / 2;

        ctx.fillStyle = index % 2 === 0 ? WHITE : PAPER;
        ctx.beginPath();
        ctx.roundRect(PAD - 16, y + 3, W - PAD * 2 + 32, rowHeight - 6, 14);
        ctx.fill();

        font(ctx, FONT_SANS, textSize, 800);
        ctx.fillStyle = chapter.open ? NAVY : MUTED;
        ctx.fillText(`Bab ${chapter.number}`, PAD, mid + textSize * 0.35);

        const status = chapter.open ? 'Tersedia' : 'Terisi';
        font(ctx, FONT_SANS, textSize - 4, 700);
        const statusWidth = ctx.measureText(status).width + 32;
        const chipHeight = Math.min(rowHeight - 16, textSize + 16);
        ctx.fillStyle = chapter.open ? SAGE : TAKEN;
        pill(
            ctx,
            W - PAD - statusWidth,
            mid - chipHeight / 2,
            statusWidth,
            chipHeight
        );
        ctx.fillStyle = chapter.open ? NAVY : WHITE;
        ctx.textAlign = 'center';
        ctx.fillText(
            status,
            W - PAD - statusWidth / 2,
            mid + (textSize - 4) * 0.35
        );
        ctx.textAlign = 'left';

        font(ctx, FONT_SANS, textSize, 400);
        ctx.fillStyle = chapter.open ? NAVY : MUTED;
        const titleX = PAD + Math.max(110, textSize * 4);
        ctx.fillText(
            clip(ctx, chapter.title, W - PAD - statusWidth - 24 - titleX),
            titleX,
            mid + textSize * 0.35
        );
    });
}

/**
 * Banyak bab: dua kolom ringkas, titik hijau = tersedia, abu-abu = terisi.
 * Bila tetap tidak muat, bab yang masih tersedia didahulukan.
 */
function drawTwoColumns(
    ctx: Ctx,
    chapters: Chapter[],
    top: number,
    available: number
) {
    const legendHeight = 40;
    const area = available - legendHeight;
    const perColumn = Math.ceil(chapters.length / 2);
    const rowHeight = Math.max(38, Math.min(56, area / perColumn));
    const capacity = Math.floor(area / rowHeight) * 2;

    let shown = chapters;
    if (chapters.length > capacity) {
        const picked = [
            ...chapters.filter((c) => c.open),
            ...chapters.filter((c) => !c.open),
        ].slice(0, capacity - 1);
        shown = chapters.filter((c) => picked.includes(c));
    }
    const hidden = chapters.length - shown.length;
    const rows = Math.ceil((shown.length + (hidden > 0 ? 1 : 0)) / 2);
    const gap = 24;
    const colWidth = (W - PAD * 2 - gap) / 2;
    const textSize = Math.round(Math.min(24, rowHeight * 0.5));

    // Keterangan warna.
    font(ctx, FONT_SANS, 22, 700);
    const legend: [string, string][] = [
        [SAGE_DARK, 'Tersedia'],
        [TAKEN, 'Terisi'],
    ];
    let lx = PAD;
    legend.forEach(([colour, text]) => {
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(lx + 8, top + 14, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = MUTED;
        ctx.fillText(text, lx + 24, top + 22);
        lx += ctx.measureText(text).width + 64;
    });

    const cell = (index: number) => ({
        x: PAD + (index < rows ? 0 : colWidth + gap),
        y: top + legendHeight + (index % rows) * rowHeight,
    });

    shown.forEach((chapter, index) => {
        const { x, y } = cell(index);
        const mid = y + rowHeight / 2;

        ctx.fillStyle = WHITE;
        ctx.beginPath();
        ctx.roundRect(x - 8, y + 3, colWidth + 16, rowHeight - 6, 10);
        ctx.fill();

        ctx.fillStyle = chapter.open ? SAGE_DARK : TAKEN;
        ctx.beginPath();
        ctx.arc(x + 8, mid, 7, 0, Math.PI * 2);
        ctx.fill();

        font(ctx, FONT_SANS, textSize, 800);
        ctx.fillStyle = chapter.open ? NAVY : MUTED;
        const label = `Bab ${chapter.number}`;
        ctx.fillText(label, x + 24, mid + textSize * 0.35);
        const labelWidth = ctx.measureText(label).width;

        font(ctx, FONT_SANS, textSize, 400);
        ctx.fillText(
            clip(ctx, chapter.title, colWidth - labelWidth - 44),
            x + 36 + labelWidth,
            mid + textSize * 0.35
        );
    });

    if (hidden > 0) {
        const { x, y } = cell(shown.length);
        font(ctx, FONT_SANS, textSize, 700);
        ctx.fillStyle = MUTED;
        ctx.fillText(
            chapters.some((c) => c.open && !shown.includes(c))
                ? `+ ${hidden} bab lainnya`
                : `+ ${hidden} bab lainnya (terisi)`,
            x + 24,
            y + rowHeight / 2 + textSize * 0.35
        );
    }
}

function drawChapterPromo(
    canvas: HTMLCanvasElement,
    data: ChapterPromoData,
    logo: HTMLImageElement | null,
    withEditor: boolean
) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // ---- Kepala: judul & bidang di atas biru tua (tingginya mengikuti judul).
    font(ctx, FONT_SERIF, 66, 700);
    let titleSize = 66;
    let titleLines = wrap(ctx, data.title, W - PAD * 2);
    while (titleLines.length > 3 && titleSize > 42) {
        titleSize -= 4;
        font(ctx, FONT_SERIF, titleSize, 700);
        titleLines = wrap(ctx, data.title, W - PAD * 2);
    }
    if (titleLines.length > 3) {
        titleLines = [
            ...titleLines.slice(0, 2),
            clip(ctx, titleLines.slice(2).join(' '), W - PAD * 2),
        ];
    }

    const titleTop = 330;
    const lineHeight = titleSize * 1.12;
    const titleBottom = titleTop + lineHeight * (titleLines.length - 1);
    const editorLine =
        withEditor && data.editor_name ? `Editor: ${data.editor_name}` : '';
    const headerBottom = titleBottom + (editorLine ? 96 : 56);

    ctx.fillStyle = NAVY;
    ctx.fillRect(0, 0, W, headerBottom);
    // Lingkaran hiasan, dipotong hanya di area kepala.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, headerBottom);
    ctx.clip();
    ctx.fillStyle = NAVY_SOFT;
    ctx.beginPath();
    ctx.arc(W - 40, 40, 230, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SAGE;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(W - 120, headerBottom - 10, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Logo.
    ctx.fillStyle = WHITE;
    pill(ctx, PAD - 8, 44, 330, 84);
    if (logo) {
        const h = 64;
        const w = (logo.naturalWidth / logo.naturalHeight) * h;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logo, PAD + 6, 54, w, h);
    }
    ctx.fillStyle = NAVY;
    font(ctx, FONT_SANS, 30, 800);
    ctx.fillText('TARTILA PRESS', PAD + 86, 98);

    ctx.fillStyle = SAGE;
    font(ctx, FONT_SANS, 28, 700);
    ctx.fillText('OPEN CALL', PAD, 186);
    ctx.fillStyle = WHITE;
    font(ctx, FONT_SANS, 74, 800);
    ctx.fillText('BOOK CHAPTER', PAD, 254);

    // Bidang keilmuan (dan kategori buku) di pita hijau muda.
    const fieldText = `BIDANG: ${(data.field ?? data.category ?? 'Umum').toUpperCase()}`;
    font(ctx, FONT_SANS, 26, 700);
    const fieldWidth = Math.min(
        ctx.measureText(fieldText).width + 48,
        W - PAD * 2
    );
    ctx.fillStyle = SAGE;
    pill(ctx, W - PAD - fieldWidth, 210, fieldWidth, 48);
    ctx.fillStyle = NAVY;
    ctx.textAlign = 'center';
    ctx.fillText(
        clip(ctx, fieldText, fieldWidth - 40),
        W - PAD - fieldWidth / 2,
        243
    );
    ctx.textAlign = 'left';

    ctx.fillStyle = WHITE;
    font(ctx, FONT_SERIF, titleSize, 700);
    titleLines.forEach((line, index) =>
        ctx.fillText(line, PAD, titleTop + lineHeight * index)
    );

    if (editorLine) {
        ctx.fillStyle = SAGE;
        font(ctx, FONT_SANS, 32, 700);
        ctx.fillText(clip(ctx, editorLine, W - PAD * 2), PAD, titleBottom + 62);
    }

    // ---- Ringkasan slot.
    const summaryTop = headerBottom + 56;
    ctx.fillStyle = NAVY;
    font(ctx, FONT_SANS, 64, 800);
    const openText = String(data.open_slots);
    ctx.fillText(openText, PAD, summaryTop + 52);
    const openWidth = ctx.measureText(openText).width;
    font(ctx, FONT_SANS, 32, 700);
    ctx.fillText(
        `dari ${data.total_slots} slot bab tersedia`,
        PAD + openWidth + 18,
        summaryTop + 48
    );

    const barTop = summaryTop + 80;
    const barWidth = W - PAD * 2;
    ctx.fillStyle = TAKEN;
    pill(ctx, PAD, barTop, barWidth, 18);
    if (data.total_slots > 0 && data.open_slots > 0) {
        ctx.fillStyle = SAGE_DARK;
        pill(
            ctx,
            PAD,
            barTop,
            Math.max(18, (barWidth * data.open_slots) / data.total_slots),
            18
        );
    }

    // ---- Daftar bab: satu kolom bila muat, dua kolom ringkas bila banyak.
    const footerTop = H - 150;
    const deadlineSpace = data.submission_deadline ? 64 : 0;
    const listTop = barTop + 56;
    const listBottom = footerTop - 24 - deadlineSpace;
    const available = listBottom - listTop;
    const total = data.chapters.length;

    if (total > 0 && total <= Math.floor(available / 48)) {
        drawSingleColumn(
            ctx,
            data.chapters,
            listTop,
            Math.min(70, available / total)
        );
    } else if (total > 0) {
        drawTwoColumns(ctx, data.chapters, listTop, available);
    }

    if (data.submission_deadline) {
        ctx.fillStyle = NAVY;
        font(ctx, FONT_SANS, 30, 700);
        ctx.fillText(
            `Batas pengumpulan naskah: ${longDate(data.submission_deadline)}`,
            PAD,
            footerTop - 36
        );
    }

    // ---- Kaki: ajakan + tautan + kontak.
    ctx.fillStyle = NAVY;
    ctx.fillRect(0, footerTop, W, H - footerTop);
    ctx.fillStyle = SAGE;
    font(ctx, FONT_SANS, 28, 700);
    ctx.fillText('Daftar & pilih bab Anda di', PAD, footerTop + 54);
    ctx.fillStyle = WHITE;
    font(ctx, FONT_SANS, 36, 800);
    ctx.fillText(
        clip(ctx, data.url.replace(/^https?:\/\//, ''), W - PAD * 2),
        PAD,
        footerTop + 100
    );
    ctx.fillStyle = SAGE;
    font(ctx, FONT_SANS, 24, 400);
    ctx.fillText(
        `${CONTACT.instagram}  ·  ${CONTACT.phone}  ·  ${CONTACT.email}`,
        PAD,
        footerTop + 136
    );
}

function loadLogo(): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = '/logo.png';
    });
}

/**
 * Buat gambar PNG dari data terbaru lalu buang kanvasnya. Pemanggil langsung
 * mengunduh Blob ini; tidak ada salinan yang disimpan.
 */
export async function renderChapterPromo(
    data: ChapterPromoData,
    withEditor: boolean
): Promise<Blob> {
    await loadPosterFonts(apiUrl('')).catch(() => undefined);
    const logo = await loadLogo();
    const canvas = document.createElement('canvas');

    try {
        drawChapterPromo(canvas, data, logo, withEditor);

        return await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
                (blob) =>
                    blob
                        ? resolve(blob)
                        : reject(new Error('Gambar gagal dibuat.')),
                'image/png'
            )
        );
    } finally {
        // Lepas memori kanvas segera.
        canvas.width = 0;
        canvas.height = 0;
    }
}

/** Nama berkas: promosi-book-chapter-<judul>-<tanggal>.png */
export function promoFilename(data: ChapterPromoData): string {
    const slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

    return `promosi-book-chapter-${slug || data.id}-${new Date().toISOString().slice(0, 10)}.png`;
}
