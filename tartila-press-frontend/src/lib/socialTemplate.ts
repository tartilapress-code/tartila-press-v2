import type {
    CertificateTemplate,
    EditorMeta,
} from '@/data/certificate/certificateApi';
import { drawCertificate } from '@/lib/certificateCanvas';
import { pageSizePt } from '@/lib/certificateLayout';
import { trimTransparent, type PosterData } from '@/lib/socialPoster';

/** Kotak yang hanya berisi {cover} dipakai untuk foto cover, bukan teks. */
export const isCoverField = (text: string): boolean =>
    text.trim() === '{cover}';

/** Nilai untuk penanda {judul}, {penulis}, ... di templat poster. */
export function posterValues(data: PosterData): Record<string, string> {
    return {
        judul: data.title.replace(/\s*\n\s*/g, ' ').trim(),
        penulis: data.authors,
        isbn: data.isbn,
        harga: data.price,
        link: data.link.replace(/^https?:\/\//, ''),
        blurb: data.blurb,
        quote: data.quote,
        cover: '',
    };
}

/**
 * Menggambar poster dari templat buatan admin (gambar latar + kotak teks
 * seperti sertifikat). Teks memakai tata letak yang sama dengan editor;
 * kotak {cover} diisi foto cover (utuh, di tengah kotak).
 */
export function drawTemplatePoster(
    canvas: HTMLCanvasElement,
    options: {
        template: CertificateTemplate;
        background: CanvasImageSource & { width: number; height: number };
        meta: EditorMeta;
        data: PosterData;
        cover: (CanvasImageSource & { width: number; height: number }) | null;
    }
) {
    const { template, background, meta, data } = options;
    // Tepi transparan mockup cover dibuang supaya memenuhi kotak.
    const cover = options.cover
        ? (trimTransparent(options.cover) as CanvasImageSource & {
              width: number;
              height: number;
          })
        : null;
    const width = background.width;
    const height = background.height;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return;
    }

    drawCertificate(ctx, {
        image: background,
        width,
        height,
        page: pageSizePt(width, height, meta.layout.page_long_side_pt),
        fields: template.fields.filter((field) => !isCoverField(field.text)),
        values: posterValues(data),
        fonts: meta.fonts,
        defaultFont: meta.default_font,
        config: meta.layout,
    });

    for (const field of template.fields.filter((item) =>
        isCoverField(item.text)
    )) {
        const box = {
            x: field.x * width,
            y: field.y * height,
            w: field.w * width,
            h: field.h * height,
        };

        if (!cover) {
            continue;
        }

        const scale = Math.min(box.w / cover.width, box.h / cover.height);
        const w = cover.width * scale;
        const h = cover.height * scale;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = Math.round(width * 0.015);
        ctx.shadowOffsetX = Math.round(width * 0.006);
        ctx.shadowOffsetY = Math.round(width * 0.008);
        ctx.drawImage(
            cover,
            box.x + (box.w - w) / 2,
            box.y + (box.h - h) / 2,
            w,
            h
        );
        ctx.restore();
    }
}
