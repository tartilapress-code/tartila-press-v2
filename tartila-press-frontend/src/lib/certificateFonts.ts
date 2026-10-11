import { apiUrl } from '@/lib/http';
import type { CertificateFont } from '@/data/certificate/certificateApi';

const loading = new Map<string, Promise<void>>();

/** CSS font-family name a certificate font is registered under. */
export function fontFamily(key: string): string {
    return `cert-${key}`;
}

/** Whether a bold file exists; fonts without one are always drawn regular. */
export function usesBold(font: CertificateFont, bold: boolean): boolean {
    return bold && font.bold_file !== null;
}

/**
 * Loads one weight of a certificate font into `document.fonts`, once. The
 * files are the very TTFs the server embeds in the PDF, so text measured in
 * the editor has the same widths as in the final file.
 */
export function loadCertificateFont(
    font: CertificateFont,
    bold: boolean
): Promise<void> {
    const useBold = usesBold(font, bold);
    const file = useBold ? font.bold_file : font.regular_file;
    const weight = useBold ? '700' : '400';
    const id = `${font.key}:${weight}`;

    let promise = loading.get(id);

    if (!promise) {
        const face = new FontFace(
            fontFamily(font.key),
            `url(${apiUrl(`/certificate-fonts/${file}`)})`,
            { weight }
        );

        promise = face.load().then((loaded) => {
            document.fonts.add(loaded);
        });

        // A failed load may be retried the next time it is requested.
        promise.catch(() => loading.delete(id));
        loading.set(id, promise);
    }

    return promise;
}
