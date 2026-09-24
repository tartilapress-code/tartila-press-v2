// Kata kunci pencarian buku yang dibawa lewat alamat katalog (/buku?cari=...),
// dipakai kolom cari di navbar dan dibaca halaman katalog.

export const CATALOG_SEARCH_PARAM = 'cari';

/** Alamat katalog yang langsung mencari `term`. */
export function catalogSearchPath(term: string): string {
    const trimmed = term.trim();

    return trimmed
        ? `/buku?${CATALOG_SEARCH_PARAM}=${encodeURIComponent(trimmed)}`
        : '/buku';
}
