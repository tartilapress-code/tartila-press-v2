import type {
    LayoutConfig,
    TemplateField,
} from '@/data/certificate/certificateApi';

/*
 * Text layout for certificate templates: word wrapping, auto-fit shrinking
 * and line placement inside a box.
 *
 * This is a line-by-line port of the PHP class
 * App\Support\Certificates\TextLayout. The editor preview draws with it and
 * the server draws the real PDF with the PHP one, so both must produce the
 * same lines, size and positions. If you change an algorithm here, change it
 * there too (and the constants in config/certificates.php).
 */

const EPSILON = 0.01;

/** Width of a string at a font size of 1pt. */
export type Measure = (text: string) => number;

export type FitResult = {
    size: number;
    lines: string[];
    lineHeight: number;
};

export type PlacedLine = { text: string; x: number; y: number };

export type Box = { x: number; y: number; w: number; h: number };

export type FontMetrics = { ascent: number; descent: number };

/** Page size in points: the longest image side maps to `longSide`. */
export function pageSizePt(
    imageWidth: number,
    imageHeight: number,
    longSide: number
): { width: number; height: number } {
    const round2 = (value: number) => Math.round(value * 100) / 100;

    if (imageWidth >= imageHeight) {
        return {
            width: longSide,
            height: round2((longSide * imageHeight) / Math.max(1, imageWidth)),
        };
    }

    return {
        width: round2((longSide * imageWidth) / Math.max(1, imageHeight)),
        height: longSide,
    };
}

export function wrapText(
    measure: Measure,
    text: string,
    size: number,
    maxWidth: number
): string[] {
    const lines: string[] = [];

    for (const paragraph of text.split(/\r\n|\r|\n/)) {
        const words = paragraph
            .trim()
            .split(/\s+/)
            .filter((word) => word !== '');

        if (words.length === 0) {
            lines.push('');
            continue;
        }

        let line = '';

        for (const word of words) {
            const candidate = line === '' ? word : `${line} ${word}`;

            if (line === '' || measure(candidate) * size <= maxWidth) {
                line = candidate;
            } else {
                lines.push(line);
                line = word;
            }
        }

        lines.push(line);
    }

    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }

    return lines;
}

export function fitText(
    measure: Measure,
    text: string,
    boxWidth: number,
    boxHeight: number,
    size: number,
    autoFit: boolean,
    config: LayoutConfig
): FitResult {
    const minSize = Math.max(
        config.min_font_size_pt,
        size * config.min_font_size_ratio
    );

    let current = size;

    for (;;) {
        const lines = wrapText(measure, text, current, boxWidth);
        const lineHeight = current * config.line_height;

        let widest = 0;
        for (const line of lines) {
            widest = Math.max(widest, measure(line) * current);
        }

        const fits =
            lines.length * lineHeight <= boxHeight + EPSILON &&
            widest <= boxWidth + EPSILON;

        if (!autoFit || fits || current <= minSize + 1e-9) {
            return { size: current, lines, lineHeight };
        }

        current = Math.max(minSize, current - config.step_pt);
    }
}

export function placeLines(
    measure: Measure,
    layout: FitResult,
    box: Box,
    align: TemplateField['align'],
    valign: TemplateField['valign'],
    metrics: FontMetrics
): PlacedLine[] {
    const { size, lines, lineHeight } = layout;
    const blockHeight = lines.length * lineHeight;

    let top = box.y + (box.h - blockHeight) / 2;
    if (valign === 'top') {
        top = box.y;
    } else if (valign === 'bottom') {
        top = box.y + box.h - blockHeight;
    }

    return lines.map((text, index) => {
        const lineTop = top + index * lineHeight;
        const baseline =
            lineTop +
            (lineHeight - (metrics.ascent + metrics.descent) * size) / 2 +
            metrics.ascent * size;
        const width = measure(text) * size;

        let x = box.x + (box.w - width) / 2;
        if (align === 'left') {
            x = box.x;
        } else if (align === 'right') {
            x = box.x + box.w - width;
        }

        return { text, x, y: baseline };
    });
}

/** Replaces {token}s; unknown tokens become empty, like the server does. */
export function applyVariables(
    text: string,
    values: Record<string, string>
): string {
    return text.replace(
        /\{([a-zA-Z0-9_]+)\}/g,
        (_match, token: string) => values[token] ?? ''
    );
}

/** The text a field prints: tokens filled in, optionally UPPERCASE. */
export function fieldText(
    field: TemplateField,
    values: Record<string, string>
): string {
    const text = applyVariables(field.text, values);

    return field.uppercase ? text.toUpperCase() : text;
}

/**
 * Preview values for `{answer_xxx}` tokens the template mentions, so the
 * column does not look empty in the editor.
 */
export function withSampleAnswers(
    fields: TemplateField[],
    values: Record<string, string>
): Record<string, string> {
    const result = { ...values };

    for (const field of fields) {
        for (const match of field.text.matchAll(
            /\{(answer_[a-zA-Z0-9_]*)\}/g
        )) {
            result[match[1]] ??= 'Contoh jawaban';
        }
    }

    return result;
}
