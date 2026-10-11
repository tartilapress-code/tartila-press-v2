import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BookCover from '@/components/book/catalog/BookCover';
import type { HeroCover } from '@/data/book/bookApi';
import { smallImageUrl } from '@/lib/responsiveImage';

/*
 * Rak buku 3D (CSS). Semua ukuran dalam cqw = persen lebar panggung, supaya
 * adegan ikut mengecil di layar sempit. Koordinat: x dari kiri, y dari lantai
 * panggung ke atas, z ke arah penonton (negatif = makin ke belakang).
 */

const A5_RATIO = 210 / 148;

// Papan rak (permukaan atas) dan dinding belakang.
const SHELF_Y = 7;
const SHELF_FRONT_Z = 7;
const SHELF_DEPTH = 30;

// Buku pajangan di depan (sampul menghadap penonton).
const FRONT = { width: 26.5, depth: 4.6, z: 2.5, gap: 4.2 };
const FRONT_HEIGHT = FRONT.width * A5_RATIO;

// Sekat kecil di antara buku pajangan.
const DIVIDER = { width: 1.4, height: 26, depth: 18 };

// Barisan buku di belakang (punggung menghadap penonton): lebar, tinggi, warna.
const BACK_ROW: { w: number; h: number; tone: string }[] = [
    { w: 4.4, h: 48.8, tone: '#003153' },
    { w: 3.6, h: 43.9, tone: '#557650' },
    { w: 5, h: 52.5, tone: '#145480' },
    { w: 3.4, h: 46.4, tone: '#8fb88a' },
    { w: 4.2, h: 50.0, tone: '#3c5439' },
    { w: 3.8, h: 42.7, tone: '#2c6f9e' },
    { w: 4.8, h: 53.7, tone: '#01253f' },
    { w: 3.5, h: 47.6, tone: '#6f9a6a' },
    { w: 4.4, h: 51.2, tone: '#145480' },
    { w: 3.6, h: 43.9, tone: '#b0d1a4' },
    { w: 4.6, h: 52.5, tone: '#003153' },
    { w: 3.8, h: 46.4, tone: '#557650' },
    { w: 4.2, h: 50.0, tone: '#2c6f9e' },
    { w: 3.4, h: 45.1, tone: '#3c5439' },
    { w: 4.8, h: 53.7, tone: '#01253f' },
    { w: 3.8, h: 47.6, tone: '#6f9a6a' },
    { w: 4.4, h: 51.2, tone: '#145480' },
    { w: 3.6, h: 43.9, tone: '#8fb88a' },
    { w: 4.6, h: 52.5, tone: '#003153' },
    { w: 4, h: 48.8, tone: '#557650' },
    { w: 4.2, h: 46.4, tone: '#2c6f9e' },
    { w: 3.6, h: 51.2, tone: '#3c5439' },
];
// Posisi x tiap buku belakang: berjajar rapat dari kiri, yang melewati rak
// tidak dipakai.
const BACK_BOOKS = BACK_ROW.reduce<
    ((typeof BACK_ROW)[number] & { x: number })[]
>((books, book) => {
    const previous = books[books.length - 1];
    const x = previous ? previous.x + previous.w + 0.25 : -2;

    return x < 100 ? [...books, { ...book, x }] : books;
}, []);
const BACK_Z = -9;
const BACK_DEPTH = 13;

const cqw = (value: number) => `${value}cqw`;

type BoxProps = {
    x: number;
    y: number;
    // Bidang depan kotak.
    z: number;
    w: number;
    h: number;
    d: number;
    front: ReactNode;
    frontStyle?: CSSProperties;
    sideStyle: CSSProperties;
    topStyle: CSSProperties;
};

/** Kotak 3D: sisi depan, sisi kiri (terlihat dari kiri), sisi atas. */
function Box({
    x,
    y,
    z,
    w,
    h,
    d,
    front,
    frontStyle,
    sideStyle,
    topStyle,
}: BoxProps) {
    const base: CSSProperties = {
        position: 'absolute',
        left: cqw(x),
        bottom: cqw(y),
    };

    return (
        <>
            <span
                aria-hidden
                style={{
                    ...base,
                    width: cqw(d),
                    height: cqw(h),
                    transformOrigin: 'left center',
                    transform: `translateZ(${cqw(z)}) rotateY(90deg)`,
                    ...sideStyle,
                }}
            />
            <span
                aria-hidden
                style={{
                    ...base,
                    bottom: cqw(y + h),
                    width: cqw(w),
                    height: cqw(d),
                    transformOrigin: 'center bottom',
                    transform: `translateZ(${cqw(z)}) rotateX(90deg)`,
                    ...topStyle,
                }}
            />
            <span
                style={{
                    ...base,
                    width: cqw(w),
                    height: cqw(h),
                    transform: `translateZ(${cqw(z)})`,
                    ...frontStyle,
                }}
            >
                {front}
            </span>
        </>
    );
}

const PAGE_EDGES =
    'repeating-linear-gradient(90deg, #fbfaf6 0, #fbfaf6 1.5px, #e2ded3 1.5px, #e2ded3 2.5px)';
const SHELF_TOP = 'linear-gradient(180deg, #d9e8d4, #c3d9bb)';
const SHELF_EDGE = 'var(--color-forest-moss-700)';

/** Posisi kiri buku pajangan ke-n, rata tengah menurut jumlah buku. */
function frontX(index: number, count: number): number {
    const span = count * FRONT.width + (count - 1) * FRONT.gap;
    const start = (100 - span) / 2;

    return start + index * (FRONT.width + FRONT.gap);
}

/**
 * Rak buku dilihat agak dari kiri: buku terbaru dipajang menghadap depan
 * (sampul terbaru diunggah paling kiri) dengan sekat kecil di antaranya, dan
 * deretan buku lain di belakangnya.
 */
export default function BookShelfScene({ covers }: { covers: HeroCover[] }) {
    const { t } = useTranslation();
    const shown = covers.slice(0, 3);

    return (
        <div
            className="relative aspect-[100/62] w-full [container-type:inline-size]"
            style={{ perspective: '1300px', perspectiveOrigin: '42% 10%' }}
        >
            <div
                className="absolute inset-0"
                style={{
                    transformStyle: 'preserve-3d',
                    transform:
                        'translateX(4cqw) translateZ(-6cqw) rotateY(24deg)',
                }}
            >
                {/* Dinding belakang rak. */}
                <span
                    aria-hidden
                    className="absolute bg-linear-to-b from-forest-moss-100 to-forest-moss-200"
                    style={{
                        left: cqw(-12),
                        bottom: cqw(SHELF_Y),
                        width: cqw(124),
                        height: cqw(60),
                        transform: `translateZ(${cqw(SHELF_FRONT_Z - SHELF_DEPTH)})`,
                    }}
                />

                {/* Papan rak: permukaan atas dan tepi depan. */}
                <Box
                    x={-12}
                    y={SHELF_Y - 3.2}
                    z={SHELF_FRONT_Z}
                    w={124}
                    h={3.2}
                    d={SHELF_DEPTH}
                    front={null}
                    frontStyle={{ background: SHELF_EDGE }}
                    sideStyle={{ background: '#3c5439' }}
                    topStyle={{ background: SHELF_TOP }}
                />

                {/* Deretan buku di belakang. */}
                {BACK_BOOKS.map((book, index) => (
                    <Box
                        key={index}
                        x={book.x}
                        y={SHELF_Y}
                        z={BACK_Z}
                        w={book.w}
                        h={book.h}
                        d={BACK_DEPTH}
                        front={
                            <>
                                <span className="absolute inset-x-0 top-[9%] h-[1.5%] bg-white/45" />
                                <span className="absolute inset-x-0 top-[13%] h-[1%] bg-white/30" />
                                <span className="absolute inset-x-0 bottom-[10%] h-[1.5%] bg-white/45" />
                            </>
                        }
                        frontStyle={{
                            background: `linear-gradient(90deg, rgba(0,0,0,0.18), rgba(255,255,255,0.12) 35%, rgba(0,0,0,0.12)), ${book.tone}`,
                            borderRadius: '2px 2px 0 0',
                            overflow: 'hidden',
                        }}
                        sideStyle={{
                            background: book.tone,
                            filter: 'brightness(0.7)',
                        }}
                        topStyle={{ background: PAGE_EDGES }}
                    />
                ))}

                {/* Sekat kecil di antara buku pajangan. */}
                {shown.slice(1).map((cover, index) => {
                    const x =
                        frontX(index + 1, shown.length) -
                        FRONT.gap / 2 -
                        DIVIDER.width / 2;

                    return (
                        <Box
                            key={`sekat-${cover.id}`}
                            x={x}
                            y={SHELF_Y}
                            z={FRONT.z + 1.5}
                            w={DIVIDER.width}
                            h={DIVIDER.height}
                            d={DIVIDER.depth}
                            front={null}
                            frontStyle={{ background: SHELF_EDGE }}
                            sideStyle={{ background: '#6f9a6a' }}
                            topStyle={{ background: '#9ec594' }}
                        />
                    );
                })}

                {/* Buku pajangan (sampul menghadap depan). */}
                {shown.map((cover, index) => (
                    <Box
                        key={cover.id}
                        x={frontX(index, shown.length)}
                        y={SHELF_Y}
                        z={FRONT.z}
                        w={FRONT.width}
                        h={FRONT_HEIGHT}
                        d={FRONT.depth}
                        front={
                            <Link
                                to={`/buku/${cover.slug}`}
                                aria-label={t('home.hero.coverLink', {
                                    title: cover.title,
                                })}
                                className="relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxford-navy-500"
                            >
                                <BookCover
                                    src={cover.front_cover}
                                    title={cover.title}
                                    alt=""
                                    fill
                                    priority
                                    sizes="(min-width: 1024px) 180px, 30vw"
                                    className="h-full w-full shadow-none!"
                                />
                                {/* Engsel dekat punggung & kilap sampul. */}
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-y-0 left-[5%] w-[2.5%] bg-linear-to-r from-black/25 via-white/30 to-black/10"
                                />
                                <span
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/25 via-transparent to-black/15"
                                />
                            </Link>
                        }
                        sideStyle={{
                            // Punggung buku: tepi kiri sampul, digelapkan.
                            backgroundImage: `linear-gradient(90deg, rgba(1,26,44,0.55), rgba(1,26,44,0.25)), url(${JSON.stringify(smallImageUrl(cover.front_cover))})`,
                            backgroundSize: 'auto 100%',
                            backgroundPosition: 'left center',
                            backgroundColor: '#011a2c',
                        }}
                        topStyle={{ background: PAGE_EDGES }}
                    />
                ))}
            </div>
        </div>
    );
}
