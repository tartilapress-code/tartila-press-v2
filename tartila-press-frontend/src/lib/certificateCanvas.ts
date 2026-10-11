import type {
    CertificateFont,
    LayoutConfig,
    TemplateField,
} from '@/data/certificate/certificateApi';
import { fontFamily, usesBold } from '@/lib/certificateFonts';
import {
    fieldText,
    fitText,
    placeLines,
    type Measure,
} from '@/lib/certificateLayout';

export type DrawOptions = {
    image: CanvasImageSource | null;
    /** Drawing area in CSS pixels. */
    width: number;
    height: number;
    /** Page size in points (see pageSizePt). */
    page: { width: number; height: number };
    fields: TemplateField[];
    values: Record<string, string>;
    fonts: CertificateFont[];
    defaultFont: string;
    config: LayoutConfig;
};

/**
 * Draws the template image and every text field onto the canvas, using the
 * same layout as the server's PDF renderer. Fields whose font has not been
 * loaded yet are measured with a fallback face, so call this again once
 * loadCertificateFont() resolves.
 */
export function drawCertificate(
    ctx: CanvasRenderingContext2D,
    options: DrawOptions
): void {
    const { image, width, height, page, config } = options;

    ctx.clearRect(0, 0, width, height);

    if (image) {
        ctx.drawImage(image, 0, 0, width, height);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
    }

    // Pixels per point of the page.
    const scale = width / page.width;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // The fonts carry no kerning/ligature tables, but be explicit: the PDF
    // library sums plain advance widths.
    ctx.fontKerning = 'none';

    for (const field of options.fields) {
        const text = fieldText(field, options.values);

        if (text.trim() === '') {
            continue;
        }

        const font =
            options.fonts.find((candidate) => candidate.key === field.font) ??
            options.fonts.find(
                (candidate) => candidate.key === options.defaultFont
            );

        if (!font) {
            continue;
        }

        const weight = usesBold(font, field.bold) ? 700 : 400;
        const family = `"${fontFamily(font.key)}", serif`;

        // Width per point: measured once at 100px, then scaled.
        ctx.font = `${weight} 100px ${family}`;
        const measure: Measure = (value) => ctx.measureText(value).width / 100;

        const box = {
            x: field.x * page.width,
            y: field.y * page.height,
            w: field.w * page.width,
            h: field.h * page.height,
        };

        const layout = fitText(
            measure,
            text,
            box.w,
            box.h,
            field.size,
            field.autoFit,
            config
        );

        const placed = placeLines(
            measure,
            layout,
            box,
            field.align,
            field.valign,
            { ascent: font.ascent, descent: font.descent }
        );

        ctx.font = `${weight} ${layout.size * scale}px ${family}`;
        ctx.fillStyle = field.color;

        for (const line of placed) {
            if (line.text !== '') {
                ctx.fillText(line.text, line.x * scale, line.y * scale);
            }
        }
    }
}
