// Poster "TERBIT" untuk sosmed, digambar di kanvas 2D dengan desain yang
// mengikuti template Tartila Press (A4 portrait, 1414 × 2000). Teks bisa
// berubah-ubah, jadi semua ukuran dihitung ulang (auto-fit / wrap).

export const POSTER_WIDTH = 1414;
export const POSTER_HEIGHT = 2000;

export const FONT_SANS = 'tp-sans';
export const FONT_SERIF = 'tp-serif';

export type PosterData = {
    /** Judul; baris dipisah dengan \n. */
    title: string;
    /** Tulisan di bawah judul (manual). */
    blurb: string;
    authors: string;
    isbn: string;
    price: string;
    link: string;
    /** Tulisan di bilah bawah (opsional, manual). */
    quote: string;
};

const NAVY = '#10315f';
const NAVY_CARD = '#0f3264';
const BG = '#96a2b5';
const SLATE = '#6f7f9c';
const SAGE = '#c7d6b1';
const WHITE = '#ffffff';

export const CONTACT = {
    phone: '0812-7034-8598',
    instagram: '@tartilapress',
    email: 'tartilapress@gmail.com',
    website: 'www.tartilapress.com',
};

type Ctx = CanvasRenderingContext2D;

/** Teks "condensed": font biasa dipipihkan secara horizontal. */
function setFont(ctx: Ctx, family: string, size: number, weight = 400) {
    ctx.font = `${weight} ${size}px "${family}", Arial, sans-serif`;
}

function width(ctx: Ctx, text: string, sx: number): number {
    return ctx.measureText(text).width * sx;
}

function drawText(
    ctx: Ctx,
    text: string,
    x: number,
    y: number,
    options: {
        sx?: number;
        align?: 'left' | 'center' | 'right';
        shear?: number;
    } = {}
) {
    const { sx = 1, align = 'left', shear = 0 } = options;

    ctx.save();
    ctx.translate(x, y);
    ctx.transform(sx, 0, -shear * sx, 1, 0, 0);
    ctx.textAlign = align;
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

/** Bungkus teks ke lebar maksimum (dalam piksel setelah dipipihkan). */
function wrap(ctx: Ctx, text: string, maxWidth: number, sx: number): string[] {
    const lines: string[] = [];

    for (const paragraph of text.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';

        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;

            if (line && width(ctx, candidate, sx) > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        }

        lines.push(line);
    }

    return lines;
}

/** Perkecil ukuran font sampai teks muat dalam lebar maksimum. */
function fitSize(
    ctx: Ctx,
    family: string,
    weight: number,
    text: string,
    size: number,
    maxWidth: number,
    sx: number,
    minSize = 24
): number {
    let current = size;

    while (current > minSize) {
        setFont(ctx, family, current, weight);

        if (width(ctx, text, sx) <= maxWidth) {
            break;
        }

        current -= 2;
    }

    setFont(ctx, family, current, weight);

    return current;
}

function roundRect(
    ctx: Ctx,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

/** Judul dua baris: pisah di ":" / baris baru, atau di tengah kata. */
export function splitTitle(title: string): string[] {
    const trimmed = title.trim();

    if (trimmed.includes('\n')) {
        return trimmed
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    }

    const colon = trimmed.indexOf(':');

    if (colon > 0) {
        return [
            trimmed.slice(0, colon).trim(),
            trimmed.slice(colon + 1).trim(),
        ];
    }

    const words = trimmed.split(/\s+/);

    if (words.length < 4) {
        return [trimmed];
    }

    const half = Math.ceil(words.length / 2);

    return [words.slice(0, half).join(' '), words.slice(half).join(' ')];
}

/** "A & B" untuk dua penulis, "A, B, dkk" untuk lebih dari dua. */
export function formatAuthors(authors: string[]): string {
    const names = authors.map((name) => name.trim()).filter(Boolean);

    if (names.length <= 1) {
        return names[0] ?? '';
    }

    if (names.length === 2) {
        return `${names[0]} & ${names[1]}`;
    }

    return `${names[0]}, ${names[1]}, dkk`;
}

// ---------------------------------------------------------------- dekorasi

function drawBackground(ctx: Ctx) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

    // Gelombang pucat di belakang kanan atas.
    ctx.fillStyle = SLATE;
    ctx.beginPath();
    ctx.moveTo(960, 300);
    ctx.bezierCurveTo(1040, 470, 1200, 560, 1414, 545);
    ctx.lineTo(1414, 440);
    ctx.bezierCurveTo(1230, 400, 1040, 330, 960, 300);
    ctx.fill();

    // Bentuk biru tua kanan atas.
    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.moveTo(625, 0);
    ctx.lineTo(1414, 0);
    ctx.lineTo(1414, 430);
    ctx.bezierCurveTo(1230, 400, 1000, 320, 880, 235);
    ctx.bezierCurveTo(760, 145, 650, 90, 625, 0);
    ctx.fill();

    // Gelombang bawah.
    ctx.fillStyle = SLATE;
    ctx.beginPath();
    ctx.moveTo(470, 2000);
    ctx.bezierCurveTo(430, 1850, 480, 1730, 560, 1690);
    ctx.bezierCurveTo(760, 1760, 830, 1900, 840, 2000);
    ctx.fill();

    ctx.fillStyle = NAVY;
    ctx.beginPath();
    ctx.moveTo(560, 2000);
    ctx.bezierCurveTo(540, 1900, 560, 1840, 620, 1800);
    ctx.bezierCurveTo(740, 1860, 790, 1940, 800, 2000);
    ctx.fill();

    // Sudut kertas putih kiri bawah.
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.moveTo(0, 1580);
    ctx.lineTo(505, 1572);
    ctx.bezierCurveTo(520, 1700, 535, 1900, 545, 2000);
    ctx.lineTo(0, 2000);
    ctx.closePath();
    ctx.fill();

    const fold = ctx.createLinearGradient(0, 1580, 560, 2000);
    fold.addColorStop(0, '#c7ced9');
    fold.addColorStop(0.5, '#eef1f6');
    fold.addColorStop(1, '#ffffff');
    ctx.fillStyle = fold;
    ctx.beginPath();
    ctx.moveTo(0, 1580);
    ctx.lineTo(505, 1572);
    ctx.lineTo(0, 1700);
    ctx.closePath();
    ctx.fill();
}

function drawLogoPill(ctx: Ctx, logo: CanvasImageSource | null) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = WHITE;
    roundRect(ctx, 50, 60, 372, 112, 56);
    ctx.fill();
    ctx.restore();

    if (logo) {
        // Rasio asli logo dipertahankan dan diperkecil dengan mutu tinggi.
        const dims = logo as {
            width?: number;
            height?: number;
            naturalWidth?: number;
            naturalHeight?: number;
        };
        const lw = dims.naturalWidth ?? dims.width ?? 1;
        const lh = dims.naturalHeight ?? dims.height ?? 1;
        const h = 92;
        const w = (lw / lh) * h;

        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(logo, 70 + (84 - w) / 2, 70, w, h);
        ctx.restore();
    }

    // "TARTILA PRESS" dengan huruf kapital kecil (small caps).
    const left = 168;
    let x = left;
    ctx.fillStyle = NAVY;

    for (const [big, small] of [
        ['T', 'ARTILA'],
        ['P', 'RESS'],
    ]) {
        setFont(ctx, FONT_SERIF, 50, 700);
        drawText(ctx, big, x, 122, { sx: 0.8 });
        x += width(ctx, big, 0.8) + 1;
        setFont(ctx, FONT_SERIF, 38, 700);
        drawText(ctx, small, x, 122, { sx: 0.8 });
        x += width(ctx, small, 0.8) + 14;
    }

    ctx.fillStyle = '#4c7a2d';
    setFont(ctx, FONT_SANS, 17, 400);
    drawText(ctx, 'Menata Ilmu, Menguatkan Peradaban.', left, 152, {
        sx: 0.78,
        shear: 0.15,
    });
}

function drawTerbit(ctx: Ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = WHITE;
    setFont(ctx, FONT_SANS, 200, 800);
    drawText(ctx, 'TERBIT', 1366, 214, {
        sx: 0.74,
        align: 'right',
        shear: 0.2,
    });
    ctx.restore();
}

function drawTitle(ctx: Ctx, title: string) {
    const lines = splitTitle(title).map((line) => line.toUpperCase());
    ctx.fillStyle = NAVY;

    // Ukuran tunggal untuk semua baris: yang terpanjang harus muat.
    let size = 128;

    for (const line of lines) {
        size = Math.min(
            size,
            fitSize(ctx, FONT_SERIF, 700, line, size, 690, 0.74, 48)
        );
    }

    setFont(ctx, FONT_SERIF, size, 700);

    const lineHeight = size * 0.72;
    const baseline = lines.length > 1 ? 288 : 330;

    lines.forEach((line, index) => {
        drawText(ctx, line, 48, baseline + index * lineHeight * 1.22, {
            sx: 0.72,
        });
    });
}

/**
 * Paragraf dalam kotak: ukuran font mengecil sampai seluruh teks muat di
 * tinggi kotak; kalau pada ukuran terkecil masih terlalu panjang, dipotong
 * dengan "…". Mengembalikan baris dan ukurannya.
 */
function fitParagraph(
    ctx: Ctx,
    text: string,
    box: { width: number; height: number },
    sx: number,
    family: string,
    maxSize: number,
    minSize: number,
    lineRatio: number
): { lines: string[]; size: number; lineHeight: number } {
    let size = maxSize;

    for (;;) {
        setFont(ctx, family, size, 400);
        const lineHeight = size * lineRatio;
        const maxLines = Math.max(
            1,
            Math.floor((box.height - size * 0.3) / lineHeight) + 1
        );
        const lines = wrap(ctx, text, box.width, sx);

        if (lines.length <= maxLines) {
            return { lines, size, lineHeight };
        }

        if (size <= minSize) {
            const kept = lines.slice(0, maxLines);
            let last = kept[maxLines - 1];

            while (last.length > 1 && width(ctx, `${last}…`, sx) > box.width) {
                last = last.slice(0, -1).trimEnd();
            }

            kept[maxLines - 1] = `${last}…`;

            return { lines: kept, size, lineHeight };
        }

        size -= 1;
    }
}

/** Kotak tulisan di bawah judul: x 62..1322, baris pertama di `top`, sampai y = bottom. */
const BLURB_BOX = { top: 452, bottom: 556, left: 62, width: 1260 };

function drawBlurb(ctx: Ctx, blurb: string) {
    if (!blurb.trim()) {
        return;
    }

    const sx = 0.86;
    ctx.fillStyle = NAVY;

    const { lines, size, lineHeight } = fitParagraph(
        ctx,
        blurb.trim(),
        { width: BLURB_BOX.width, height: BLURB_BOX.bottom - BLURB_BOX.top },
        sx,
        FONT_SANS,
        34,
        20,
        1.3
    );

    setFont(ctx, FONT_SANS, size, 400);

    lines.forEach((line, index) => {
        const y = BLURB_BOX.top + index * lineHeight;
        const isLast = index === lines.length - 1;
        const words = line.split(' ');

        if (isLast || words.length < 2) {
            drawText(ctx, line, BLURB_BOX.left, y, { sx });

            return;
        }

        // Rata kiri-kanan: sebar sisa lebar ke sela kata.
        const wordsWidth = words.reduce(
            (sum, word) => sum + width(ctx, word, sx),
            0
        );
        const gap = (BLURB_BOX.width - wordsWidth) / (words.length - 1);
        let x = BLURB_BOX.left;

        for (const word of words) {
            drawText(ctx, word, x, y, { sx });
            x += width(ctx, word, sx) + gap;
        }
    });
}

// ---------------------------------------------------------------- ikon kartu

function strokeIcon(ctx: Ctx, draw: () => void) {
    ctx.save();
    ctx.strokeStyle = WHITE;
    ctx.fillStyle = WHITE;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    draw();
    ctx.restore();
}

function iconPen(ctx: Ctx, x: number, y: number) {
    strokeIcon(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x + 62, y + 4);
        ctx.bezierCurveTo(x + 20, y + 20, x + 14, y + 70, x + 8, y + 112);
        ctx.bezierCurveTo(x + 40, y + 90, x + 70, y + 50, x + 62, y + 4);
        ctx.moveTo(x + 8, y + 112);
        ctx.lineTo(x + 36, y + 56);
        ctx.moveTo(x - 24, y + 122);
        ctx.bezierCurveTo(x - 10, y + 116, x, y + 126, x + 12, y + 118);
        ctx.stroke();
    });
}

function iconBook(ctx: Ctx, x: number, y: number) {
    strokeIcon(ctx, () => {
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x + 52, y + 24);
        ctx.lineTo(x + 104, y + 14);
        ctx.lineTo(x + 104, y + 78);
        ctx.lineTo(x + 52, y + 90);
        ctx.lineTo(x, y + 78);
        ctx.closePath();
        ctx.moveTo(x + 52, y + 24);
        ctx.lineTo(x + 52, y + 90);
        ctx.stroke();
    });
}

function iconTag(ctx: Ctx, x: number, y: number) {
    strokeIcon(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x + 14, y + 52);
        ctx.lineTo(x + 66, y + 4);
        ctx.lineTo(x + 100, y + 10);
        ctx.lineTo(x + 94, y + 44);
        ctx.lineTo(x + 44, y + 96);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 80, y + 28, 8, 0, Math.PI * 2);
        ctx.stroke();
    });
}

function iconCart(ctx: Ctx, x: number, y: number) {
    strokeIcon(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y + 8);
        ctx.lineTo(x + 22, y + 8);
        ctx.lineTo(x + 40, y + 72);
        ctx.lineTo(x + 100, y + 72);
        ctx.lineTo(x + 112, y + 22);
        ctx.lineTo(x + 28, y + 22);
        ctx.moveTo(x + 52, y + 22);
        ctx.lineTo(x + 56, y + 72);
        ctx.moveTo(x + 78, y + 22);
        ctx.lineTo(x + 78, y + 72);
        ctx.moveTo(x + 36, y + 46);
        ctx.lineTo(x + 108, y + 46);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 48, y + 90, 7, 0, Math.PI * 2);
        ctx.arc(x + 90, y + 90, 7, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawCards(ctx: Ctx, data: PosterData) {
    const cards: {
        label: string;
        value: string;
        icon: (ctx: Ctx, x: number, y: number) => void;
        iconAt: [number, number];
    }[] = [
        {
            label: 'PENULIS',
            value: data.authors,
            icon: iconPen,
            iconAt: [150, 650],
        },
        { label: 'ISBN', value: data.isbn, icon: iconBook, iconAt: [118, 862] },
        {
            label: 'HARGA',
            value: data.price,
            icon: iconTag,
            iconAt: [128, 1050],
        },
        {
            label: 'DAPATKAN DI',
            value: '',
            icon: iconCart,
            iconAt: [124, 1248],
        },
    ];

    cards.forEach((card, index) => {
        const y = 615 + index * 199.5;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = NAVY_CARD;
        roundRect(ctx, 88, y, 564, 172, 86);
        ctx.fill();
        ctx.restore();

        card.icon(ctx, card.iconAt[0], card.iconAt[1]);

        ctx.fillStyle = SAGE;
        setFont(ctx, FONT_SANS, 52, 700);
        drawText(ctx, card.label, 252, y + 66, { sx: 0.82 });

        if (card.value) {
            ctx.fillStyle = WHITE;
            fitSize(ctx, FONT_SANS, 400, card.value, 42, 372, 0.82, 22);
            drawText(ctx, card.value, 252, y + 118, { sx: 0.82 });
        }
    });

    // Link di dalam kartu keempat, dalam pil hijau muda.
    const linkY = 615 + 3 * 199.5;
    ctx.fillStyle = '#d3e3c8';
    roundRect(ctx, 242, linkY + 96, 408, 40, 10);
    ctx.fill();
    ctx.fillStyle = NAVY;
    const shown = data.link.replace(/^https?:\/\//, '');
    fitSize(ctx, FONT_SANS, 400, shown, 36, 388, 0.76, 16);
    drawText(ctx, shown, 252, linkY + 127, { sx: 0.76 });
}

const trimmed = new WeakMap<object, CanvasImageSource>();

/** Buang tepi transparan (mis. mockup dengan latar kosong) supaya cover memenuhi bingkai. */
export function trimTransparent(image: CanvasImageSource): CanvasImageSource {
    const source = image as {
        width: number;
        height: number;
        naturalWidth?: number;
        naturalHeight?: number;
    };
    const cached = trimmed.get(image as object);

    if (cached) {
        return cached;
    }

    const sw = source.naturalWidth ?? source.width;
    const sh = source.naturalHeight ?? source.height;
    const probe = document.createElement('canvas');
    probe.width = sw;
    probe.height = sh;
    const pctx = probe.getContext('2d', { willReadFrequently: true });

    if (!pctx) {
        return image;
    }

    pctx.drawImage(image, 0, 0);
    const { data } = pctx.getImageData(0, 0, sw, sh);
    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            if (data[(y * sw + x) * 4 + 3] > 16) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }

    let result: CanvasImageSource = image;

    if (
        maxX >= minX &&
        maxY >= minY &&
        (maxX - minX + 1 < sw || maxY - minY + 1 < sh)
    ) {
        const out = document.createElement('canvas');
        out.width = maxX - minX + 1;
        out.height = maxY - minY + 1;
        out.getContext('2d')?.drawImage(
            probe,
            minX,
            minY,
            out.width,
            out.height,
            0,
            0,
            out.width,
            out.height
        );
        result = out;
    }

    trimmed.set(image as object, result);

    return result;
}

function drawCover(ctx: Ctx, source: CanvasImageSource | null) {
    const cover = source ? trimTransparent(source) : null;

    // Bingkai.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#9aa6b9';
    roundRect(ctx, 712, 577, 651, 878, 80);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 12;
    roundRect(ctx, 712, 577, 651, 878, 80);
    ctx.stroke();

    const boxW = 445;
    const boxH = 700;
    const boxX = 810;
    const boxY = 660;

    if (!cover) {
        ctx.fillStyle = 'rgba(16,49,95,0.15)';
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.fillStyle = NAVY;
        setFont(ctx, FONT_SANS, 34, 400);
        drawText(ctx, 'Foto cover', boxX + boxW / 2, boxY + boxH / 2, {
            align: 'center',
        });

        return;
    }

    const dims = cover as {
        width?: number;
        height?: number;
        naturalWidth?: number;
        naturalHeight?: number;
    };
    const sw = dims.naturalWidth ?? dims.width ?? boxW;
    const sh = dims.naturalHeight ?? dims.height ?? boxH;
    const scale = Math.min(boxW / sw, boxH / sh);
    const w = sw * scale;
    const h = sh * scale;
    const x = boxX + (boxW - w) / 2;
    const y = boxY + (boxH - h) / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(cover, x, y, w, h);
    ctx.restore();
}

function drawQuote(ctx: Ctx, quote: string) {
    const text = quote.trim();

    if (!text) {
        return;
    }

    ctx.fillStyle = NAVY;
    roundRect(ctx, 205, 1487, 1115, 161, 80);
    ctx.fill();

    ctx.fillStyle = '#eef2f8';
    const sx = 0.84;
    const { lines, size, lineHeight } = fitParagraph(
        ctx,
        text,
        { width: 980, height: 112 },
        sx,
        FONT_SANS,
        44,
        20,
        1.32
    );

    setFont(ctx, FONT_SANS, size, 400);
    const block = (lines.length - 1) * lineHeight;
    const first = 1567 + size * 0.34 - block / 2;

    lines.forEach((line, index) => {
        drawText(ctx, line, 762, first + index * lineHeight, {
            sx,
            align: 'center',
            shear: 0.16,
        });
    });
}

function drawFooter(ctx: Ctx) {
    ctx.fillStyle = NAVY;
    roundRect(ctx, 682, 1680, 198, 12, 6);
    ctx.fill();

    const rows = [
        CONTACT.phone,
        CONTACT.instagram,
        CONTACT.email,
        CONTACT.website,
    ];

    rows.forEach((row, index) => {
        const y = 1778 + index * 51;

        ctx.fillStyle = NAVY;
        setFont(ctx, FONT_SANS, 40, 400);
        drawText(ctx, row, 1290, y, { sx: 0.82, align: 'right' });

        ctx.beginPath();
        ctx.arc(1322, y - 12, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BG;
        ctx.beginPath();
        ctx.arc(1322, y - 12, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    // Ajakan di sudut kertas.
    ctx.fillStyle = NAVY;
    setFont(ctx, FONT_SANS, 27, 400);
    drawText(ctx, 'Terbitkan karya', 47, 1808, { sx: 0.86 });
    drawText(ctx, 'terbaikmu hanya di', 47, 1843, { sx: 0.86 });
    setFont(ctx, FONT_SANS, 27, 700);
    drawText(ctx, 'Tartila', 47, 1878, { sx: 0.86 });
    ctx.fillStyle = '#3a37a8';
    drawText(ctx, 'Press', 47 + width(ctx, 'Tartila ', 0.86), 1878, {
        sx: 0.86,
    });
    ctx.fillStyle = NAVY;
    setFont(ctx, FONT_SANS, 24, 700);
    drawText(ctx, 'Wujudkan Impian Menjadi Nyata', 47, 1912, {
        sx: 0.86,
        shear: 0.15,
    });
}

/** Menggambar seluruh poster ke kanvas (ukuran POSTER_WIDTH × POSTER_HEIGHT). */
export function drawPoster(
    canvas: HTMLCanvasElement,
    data: PosterData,
    images: { cover: CanvasImageSource | null; logo: CanvasImageSource | null }
) {
    canvas.width = POSTER_WIDTH;
    canvas.height = POSTER_HEIGHT;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return;
    }

    drawBackground(ctx);
    drawLogoPill(ctx, images.logo);
    drawTerbit(ctx);
    drawTitle(ctx, data.title);
    drawBlurb(ctx, data.blurb);
    drawCards(ctx, data);
    drawCover(ctx, images.cover);
    drawQuote(ctx, data.quote);
    drawFooter(ctx);
}

/** Memuat font poster (file TTF yang sama dengan sertifikat) sekali saja. */
let fontsPromise: Promise<void> | null = null;

export function loadPosterFonts(baseUrl: string): Promise<void> {
    fontsPromise ??= Promise.all(
        [
            { family: FONT_SANS, file: 'OpenSans-Regular.ttf', weight: '400' },
            { family: FONT_SANS, file: 'OpenSans-Bold.ttf', weight: '700' },
            { family: FONT_SANS, file: 'OpenSans-Bold.ttf', weight: '800' },
            {
                family: FONT_SERIF,
                file: 'CrimsonPro-Regular.ttf',
                weight: '400',
            },
            { family: FONT_SERIF, file: 'CrimsonPro-Bold.ttf', weight: '700' },
        ].map(async ({ family, file, weight }) => {
            const face = new FontFace(
                family,
                `url(${baseUrl}/certificate-fonts/${file})`,
                { weight }
            );
            document.fonts.add(await face.load());
        })
    ).then(() => undefined);

    fontsPromise.catch(() => {
        fontsPromise = null;
    });

    return fontsPromise;
}

// ---------------------------------------------------------------- caption

export const DEFAULT_CTA =
    '📚 Dapatkan bukunya sekarang!\nISBN: {isbn}\nHarga: {harga}\n🛒 Pesan di: {link}';

export const DEFAULT_HASHTAGS =
    '#TartilaPress #BukuTerbit #BukuBaru #PenerbitIndependen #TerbitkanBukumu #Literasi #RekomendasiBuku';

export function buildCaption(input: {
    synopsis: string;
    cta: string;
    hashtags: string;
    title: string;
    isbn: string;
    price: string;
    link: string;
}): string {
    const cta = input.cta
        .replaceAll('{judul}', input.title)
        .replaceAll('{isbn}', input.isbn)
        .replaceAll('{harga}', input.price)
        .replaceAll('{link}', input.link);

    return [input.synopsis.trim(), cta.trim(), input.hashtags.trim()]
        .filter(Boolean)
        .join('\n\n');
}
