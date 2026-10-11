import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { responsiveSrcSet } from '@/lib/responsiveImage';

type ResponsiveImgProps = Omit<
    ImgHTMLAttributes<HTMLImageElement>,
    'srcSet'
> & {
    src: string;
    // Lebar tampil gambar, mis. "(min-width: 1024px) 320px, 100vw".
    sizes: string;
};

/**
 * <img> yang memakai versi kecil (WebP) gambar unggahan bila ada. Bila versi
 * kecil gagal dimuat (belum dibuat), otomatis kembali ke berkas asli; baru
 * setelah itu `onError` milik pemakai dipanggil.
 */
export default function ResponsiveImg({
    src,
    sizes,
    onError,
    loading = 'lazy',
    decoding = 'async',
    ...rest
}: ResponsiveImgProps) {
    // Disimpan per src supaya kembali mencoba versi kecil bila gambar diganti.
    const [plainFor, setPlainFor] = useState<string | null>(null);
    const srcSet = plainFor === src ? undefined : responsiveSrcSet(src);

    function handleError(event: SyntheticEvent<HTMLImageElement>) {
        if (srcSet) {
            setPlainFor(src);
            return;
        }

        onError?.(event);
    }

    return (
        <img
            {...rest}
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            loading={loading}
            decoding={decoding}
            onError={handleError}
        />
    );
}
