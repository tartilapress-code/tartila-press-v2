// Ilustrasi dekoratif untuk halaman Penulis & Editor (SVG murni, tanpa aset).

type ArtProps = { className?: string };

type Point = [number, number];

const COS_30 = Math.cos(Math.PI / 6);

// Proyeksi isometrik sederhana: x ke kanan-bawah, y ke kiri-bawah, z ke atas.
function project(
    x: number,
    y: number,
    z: number,
    origin: Point,
    scale: number
): Point {
    return [
        origin[0] + (x - y) * COS_30 * scale,
        origin[1] + (x + y) * 0.5 * scale - z * scale,
    ];
}

const toPoints = (points: Point[]) =>
    points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

type BookSpec = {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    h: number;
};

// Tiga sisi buku yang terlihat: sampul (atas), punggung (kiri-depan), dan
// tepi halaman (kanan-depan), plus garis halaman dan bingkai sampul.
function bookShapes(book: BookSpec, origin: Point, scale: number) {
    const { x, y, z, w, d, h } = book;
    const p = (dx: number, dy: number, dz: number) =>
        project(x + dx, y + dy, z + dz, origin, scale);
    const inset = Math.min(w, d) * 0.1;

    return {
        top: toPoints([p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)]),
        spine: toPoints([p(0, d, 0), p(w, d, 0), p(w, d, h), p(0, d, h)]),
        pages: toPoints([p(w, 0, 0), p(w, d, 0), p(w, d, h), p(w, 0, h)]),
        frame: toPoints([
            p(inset, inset, h),
            p(w - inset, inset, h),
            p(w - inset, d - inset, h),
            p(inset, d - inset, h),
        ]),
        pageLines: [0.3, 0.55, 0.8].map((k) => ({
            from: p(w, 0.06 * d, h * k),
            to: p(w, 0.94 * d, h * k),
        })),
    };
}

const LEAF = 'M0 0C8-10 26-11 40 0C26 11 8 10 0 0Z';

// Ranting: batang kurva M50 145 C44 100 54 60 68 10 dan titik tumbuh daun di
// sepanjang batang (rotasi negatif = menghadap kanan-atas, >180 = kiri-atas).
const STEM = 'M50 145C44 100 54 60 68 10';
const SPRIG_BASE: Point = [50, 145];
const sprigLeaves = [
    { x: 48.3, y: 109.9, r: -20, s: 0.9 },
    { x: 49.7, y: 91.4, r: 200, s: 0.85 },
    { x: 52.6, y: 72.3, r: -35, s: 0.95 },
    { x: 56.8, y: 52.6, r: 215, s: 0.85 },
    { x: 62, y: 31.9, r: -50, s: 0.8 },
    { x: 68, y: 10, r: -75, s: 0.7 },
];

// Bentuk ranting dalam koordinat 100×150 — dipakai sendiri maupun di dalam
// ilustrasi lain lewat transform.
function SprigShapes({ variant }: { variant: 'soft' | 'line' }) {
    const isLine = variant === 'line';

    return (
        <>
            <path
                d={STEM}
                className={
                    isLine
                        ? 'fill-none stroke-oxford-navy-700'
                        : 'fill-none stroke-forest-moss-500/80'
                }
                strokeWidth={isLine ? 1.8 : 2.4}
                strokeLinecap="round"
            />
            {sprigLeaves.map((leaf, index) => (
                <path
                    key={index}
                    d={LEAF}
                    transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.s * 1.25})`}
                    className={
                        isLine
                            ? 'fill-forest-moss-100 stroke-forest-moss-600'
                            : index % 2 === 0
                              ? 'fill-forest-moss-300/90'
                              : 'fill-forest-moss-400/85'
                    }
                    strokeWidth={isLine ? 1.4 : 0}
                    strokeLinejoin="round"
                />
            ))}
        </>
    );
}

// Menaruh pangkal ranting di (x, y) dengan skala & kemiringan tertentu.
const placeSprig = (x: number, y: number, scale: number, rotate = 0) =>
    `translate(${x} ${y}) rotate(${rotate}) scale(${scale}) translate(${-SPRIG_BASE[0]} ${-SPRIG_BASE[1]})`;

/** Ranting kecil berdaun; `line` = garis tepi biru tua seperti sketsa. */
export function Sprig({
    className,
    variant = 'soft',
}: ArtProps & { variant?: 'soft' | 'line' }) {
    return (
        <svg viewBox="0 0 100 150" className={className} aria-hidden>
            <SprigShapes variant={variant} />
        </svg>
    );
}

// Bukit hijau lembut di tepi kiri hero.
export function HeroHill({ className }: ArtProps) {
    return (
        <svg
            viewBox="0 0 400 260"
            preserveAspectRatio="none"
            className={className}
            aria-hidden
        >
            <path
                d="M0 40C70 30 150 70 215 140C260 190 320 235 400 260H0Z"
                className="fill-forest-moss-100/70"
            />
            <path
                d="M0 120C60 112 140 150 210 235C225 250 240 256 258 260H0Z"
                className="fill-forest-moss-200/55"
            />
        </svg>
    );
}

// Bentuk daun besar yang lembut di tepi kanan hero.
export function HeroLeafRight({ className }: ArtProps) {
    return (
        <svg
            viewBox="0 0 400 260"
            preserveAspectRatio="none"
            className={className}
            aria-hidden
        >
            <path
                d="M400 20C330 30 250 80 190 150C150 196 90 238 0 260H400Z"
                className="fill-forest-moss-100/75"
            />
            <path
                d="M400 120C350 130 290 175 245 235C238 246 230 254 220 260H400Z"
                className="fill-forest-moss-200/50"
            />
        </svg>
    );
}

// Garis lengkung tipis di bawah kutipan.
export function Swoosh({ className }: ArtProps) {
    return (
        <svg viewBox="0 0 120 12" className={className} aria-hidden>
            <path
                d="M2 9C30 3 70 2 118 6"
                className="fill-none stroke-forest-moss-500"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
        </svg>
    );
}

const colorBooks: { spec: BookSpec; top: string; spine: string }[] = [
    {
        spec: { x: 0, y: 0, z: 0, w: 124, d: 88, h: 17 },
        top: 'fill-[#4a9d92]',
        spine: 'fill-[#2f7a72]',
    },
    {
        spec: { x: 6, y: 8, z: 17, w: 112, d: 78, h: 14 },
        top: 'fill-[#2f83a6]',
        spine: 'fill-[#1f6485]',
    },
    {
        spec: { x: 16, y: 6, z: 31, w: 98, d: 70, h: 12 },
        top: 'fill-[#8cc09a]',
        spine: 'fill-[#5f9b70]',
    },
];

/** Tumpukan tiga buku berwarna dengan ranting daun (hero halaman daftar). */
export function BookStackColor({ className }: ArtProps) {
    const origin: Point = [100, 58];

    return (
        <svg viewBox="0 -62 260 242" className={className} aria-hidden>
            <ellipse
                cx="120"
                cy="168"
                rx="104"
                ry="9"
                className="fill-oxford-navy-900/10"
            />

            {/* Ranting di belakang buku, menjulur ke kiri-atas */}
            <g transform={placeSprig(40, 72, 0.78, -8)}>
                <SprigShapes variant="soft" />
            </g>

            {colorBooks.map(({ spec, top, spine }, index) => {
                const shape = bookShapes(spec, origin, 1);

                return (
                    <g key={index}>
                        <polygon points={shape.spine} className={spine} />
                        <polygon points={shape.pages} fill="#f5f0e4" />
                        {shape.pageLines.map((line, lineIndex) => (
                            <line
                                key={lineIndex}
                                x1={line.from[0]}
                                y1={line.from[1]}
                                x2={line.to[0]}
                                y2={line.to[1]}
                                stroke="#d9d0bd"
                                strokeWidth="0.8"
                            />
                        ))}
                        <polygon points={shape.top} className={top} />
                        <polygon
                            points={shape.frame}
                            fill="none"
                            stroke="#fff"
                            strokeOpacity="0.4"
                            strokeWidth="1"
                        />
                    </g>
                );
            })}

            {/* Daun kecil di sisi kanan tumpukan */}
            <g transform="translate(204 104) rotate(14)">
                <path
                    d="M0 58C0 30 8 10 22 0C34 20 32 46 0 58Z"
                    className="fill-forest-moss-400/85"
                />
                <path
                    d="M0 58C6 40 12 22 22 0"
                    className="fill-none stroke-white/60"
                    strokeWidth="1.4"
                />
            </g>
        </svg>
    );
}

const lineBooks: BookSpec[] = [
    { x: 0, y: 0, z: 0, w: 120, d: 84, h: 20 },
    { x: 8, y: 6, z: 20, w: 106, d: 72, h: 18 },
];

/** Dua buku bersusun bergaya sketsa garis dengan ranting daun (hero profil). */
export function BookStackLine({ className }: ArtProps) {
    const origin: Point = [98, 46];

    return (
        <svg viewBox="0 -70 270 250" className={className} aria-hidden>
            {/* Ranting menjulur dari belakang buku */}
            <g transform={placeSprig(150, 40, 0.62, 4)}>
                <SprigShapes variant="line" />
            </g>
            <g transform={placeSprig(36, 118, 0.42, -50)}>
                <SprigShapes variant="line" />
            </g>

            {lineBooks.map((spec, index) => {
                const shape = bookShapes(spec, origin, 1.02);

                return (
                    <g
                        key={index}
                        className="stroke-oxford-navy-700"
                        strokeWidth="2.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    >
                        <polygon points={shape.spine} fill="#fff" />
                        <polygon points={shape.pages} fill="#fff" />
                        {shape.pageLines.map((line, lineIndex) => (
                            <line
                                key={lineIndex}
                                x1={line.from[0]}
                                y1={line.from[1]}
                                x2={line.to[0]}
                                y2={line.to[1]}
                                strokeWidth="1.2"
                            />
                        ))}
                        <polygon points={shape.top} fill="#fff" />
                        <polygon
                            points={shape.frame}
                            fill="none"
                            strokeWidth="1"
                            strokeOpacity="0.45"
                        />
                    </g>
                );
            })}
        </svg>
    );
}
