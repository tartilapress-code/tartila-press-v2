import { useEffect, useState } from 'react';
import type {
    CertificateFont,
    TemplateField,
} from '@/data/certificate/certificateApi';
import { loadCertificateFont } from '@/lib/certificateFonts';

/**
 * Loads the certificate fonts the given fields use and returns a counter that
 * increases every time one finishes loading, so a canvas can redraw with the
 * real glyphs (drawing before that measures with a fallback font).
 */
export function useCertificateFonts(
    fonts: CertificateFont[],
    fields: TemplateField[]
): number {
    const [version, setVersion] = useState<number>(0);

    // "cinzel:1,montserrat:0": one entry per distinct (font, bold) pair.
    const needed = [
        ...new Set(
            fields.map((field) => `${field.font}:${field.bold ? 1 : 0}`)
        ),
    ]
        .sort()
        .join(',');

    useEffect(() => {
        let cancelled = false;

        for (const entry of needed.split(',').filter(Boolean)) {
            const [key, bold] = entry.split(':');
            const font = fonts.find((candidate) => candidate.key === key);

            if (!font) {
                continue;
            }

            loadCertificateFont(font, bold === '1')
                .then(() => {
                    if (!cancelled) {
                        setVersion((current) => current + 1);
                    }
                })
                .catch(() => undefined);
        }

        return () => {
            cancelled = true;
        };
    }, [needed, fonts]);

    return version;
}
