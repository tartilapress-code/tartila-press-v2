import { useState, type SyntheticEvent } from 'react';

// Sampul buku Tartila Press berukuran A5 (148 × 210 mm).
const A5_WIDTH = 148;
const A5_HEIGHT = 210;
const A5_RATIO = A5_WIDTH / A5_HEIGHT;

// Selisih rasio (relatif terhadap A5) yang masih aman dipotong (object-cover).
// Lebih dari itu gambar ditampilkan utuh di atas latar buram supaya teks di
// tepi sampul tidak terpotong.
const CROP_TOLERANCE = 0.08;

type CoverFit = 'cover' | 'contain';

type BookCoverProps = {
    src: string | null;
    // Gambar cadangan bila `src` kosong atau gagal dimuat (mis. sampul bawaan
    // Book Chapter). Tanpanya, tampil sampul pengganti bertuliskan judul.
    fallbackSrc?: string;
    // Judul buku: tulisan pada sampul pengganti (dan teks alternatif bawaan).
    title: string;
    // Isi "" bila judul sudah tertulis di dekat gambar (mis. dalam tautan yang
    // sama) supaya pembaca layar tidak membacanya dua kali.
    alt?: string;
    // Lebar/posisi ditentukan pemakai; tinggi mengikuti rasio A5.
    className?: string;
};

// Sampul pengganti (belum ada gambar / gambar gagal dimuat): panel navy
// dengan judul, supaya katalog tetap rapi.
function CoverPlaceholder({ title }: { title: string }) {
    return (
        <div
            aria-hidden
            className="absolute inset-0 flex flex-col items-center justify-between bg-linear-to-br from-oxford-navy-600 via-oxford-navy-700 to-oxford-navy-900 p-[9cqw] text-center"
        >
            <span className="h-px w-[28cqw] bg-forest-moss-300/70" />
            <span className="font-display line-clamp-5 text-[10.5cqw] font-semibold leading-tight text-white">
                {title}
            </span>
            <span className="text-[6cqw] font-medium uppercase tracking-[0.25em] text-forest-moss-200/80">
                Tartila Press
            </span>
        </div>
    );
}

/**
 * Sampul buku dalam bingkai A5 dengan sedikit efek punggung buku.
 * - Gambar mendekati A5 → memenuhi bingkai (object-cover).
 * - Gambar dengan rasio jauh berbeda → tampil utuh (object-contain) di atas
 *   salinan buramnya sendiri.
 * - Gambar kosong/gagal dimuat → gambar cadangan; bila itu pun tidak ada,
 *   sampul pengganti.
 */
export default function BookCover({
    src,
    fallbackSrc,
    title,
    alt = title,
    className = '',
}: BookCoverProps) {
    const candidates = [src, fallbackSrc].filter((url): url is string =>
        Boolean(url)
    );
    // Hasil pemuatan disimpan bersama daftar gambar yang dicoba, sehingga
    // otomatis kembali ke awal bila sampul diganti.
    const key = candidates.join('\n');
    const [state, setState] = useState<{
        key: string;
        index: number;
        fit: CoverFit | null;
    }>({ key, index: 0, fit: null });

    const current = state.key === key ? state : { key, index: 0, fit: null };
    const currentSrc = candidates[current.index] ?? null;

    function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        const ratio = naturalHeight > 0 ? naturalWidth / naturalHeight : 0;
        const isCloseToA5 =
            Math.abs(ratio - A5_RATIO) / A5_RATIO <= CROP_TOLERANCE;

        setState({
            key,
            index: current.index,
            fit: isCloseToA5 ? 'cover' : 'contain',
        });
    }

    function handleError() {
        setState({ key, index: current.index + 1, fit: null });
    }

    return (
        <div
            className={`@container relative aspect-[148/210] overflow-hidden rounded-l-[3px] rounded-r-md bg-oxford-navy-50 shadow-[6px_10px_22px_-8px_rgba(1,26,44,0.5),1px_2px_4px_rgba(1,26,44,0.22)] ${
                currentSrc && current.fit === null ? 'animate-pulse' : ''
            } ${className}`}
        >
            {currentSrc ? (
                <>
                    {current.fit === 'contain' && (
                        <img
                            src={currentSrc}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl"
                        />
                    )}
                    <img
                        src={currentSrc}
                        alt={alt}
                        width={A5_WIDTH}
                        height={A5_HEIGHT}
                        loading="lazy"
                        decoding="async"
                        onLoad={handleLoad}
                        onError={handleError}
                        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
                            current.fit === 'contain'
                                ? 'object-contain'
                                : 'object-cover'
                        } ${current.fit === null ? 'opacity-0' : 'opacity-100'}`}
                    />
                </>
            ) : (
                <CoverPlaceholder title={title} />
            )}

            {/* Punggung buku: bayangan tipis di sisi kiri */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-linear-to-r from-black/25 via-white/20 to-transparent"
            />
            {/* Garis tepi halus supaya sampul putih tetap terlihat batasnya */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/10"
            />
        </div>
    );
}
