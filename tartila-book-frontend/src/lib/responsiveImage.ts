// Versi kecil (WebP) gambar unggahan, dibuat backend saat unggah
// (app/Support/ResponsiveImages.php): ".../abc.png" -> ".../abc.w400.webp" dan
// ".../abc.w900.webp". Lebar & aturan nama HARUS sama dengan backend.
export const VARIANT_WIDTHS = [400, 900] as const;

type VariantWidth = (typeof VARIANT_WIDTHS)[number];

const UPLOAD_IMAGE = /\/storage\/uploads\/[^?#]+\.(jpe?g|png|webp)$/i;
const VARIANT = /\.w\d+\.webp$/i;

function isUploadImage(url: string | null | undefined): url is string {
    return Boolean(url) && UPLOAD_IMAGE.test(url!) && !VARIANT.test(url!);
}

function variantUrl(url: string, width: VariantWidth) {
    return `${url.replace(/\.[^./]+$/, '')}.w${width}.webp`;
}

/**
 * `srcset` berisi versi kecil sebuah gambar unggahan, atau undefined bila
 * gambar bukan unggahan situs ini (mis. URL luar, aset lokal).
 */
export function responsiveSrcSet(url: string | null | undefined) {
    if (!isUploadImage(url)) {
        return undefined;
    }

    return VARIANT_WIDTHS.map(
        (width) => `${variantUrl(url, width)} ${width}w`
    ).join(', ');
}

/**
 * Satu versi kecil untuk pemakaian tanpa srcset (mis. background CSS);
 * gambar yang bukan unggahan dikembalikan apa adanya.
 */
export function smallImageUrl(url: string, width: VariantWidth = 400) {
    return isUploadImage(url) ? variantUrl(url, width) : url;
}
