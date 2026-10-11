// Ilustrasi dekoratif untuk halaman katalog (SVG murni, tanpa aset gambar).

type ArtProps = { className?: string };

const PLANT_LEAF = 'M0 0C25-20 75-22 100 0C75 22 25 20 0 0Z';

// Urutan gambar: daun terluar (gelap) dulu, daun tengah (terang) di atasnya.
const plantLeaves = [
    { r: -172, s: 0.62, tone: 'fill-forest-moss-700' },
    { r: -8, s: 0.6, tone: 'fill-forest-moss-700' },
    { r: -150, s: 0.8, tone: 'fill-forest-moss-600' },
    { r: -30, s: 0.8, tone: 'fill-forest-moss-600' },
    { r: -128, s: 0.95, tone: 'fill-forest-moss-500' },
    { r: -52, s: 0.92, tone: 'fill-forest-moss-500' },
    { r: -108, s: 1.05, tone: 'fill-forest-moss-400' },
    { r: -72, s: 1.02, tone: 'fill-forest-moss-300' },
    { r: -90, s: 1.12, tone: 'fill-forest-moss-600' },
];

const BASELINE = 210;

const books = [
    { x: 172, w: 30, h: 150, fill: '#0d4270', band: '#e6c26a' },
    { x: 202, w: 26, h: 172, fill: '#0a2d4d', band: '#e6c26a', label: true },
    { x: 228, w: 34, h: 192, fill: '#f3efe4', band: '#0d4270', ink: '#0d4270' },
    { x: 262, w: 28, h: 174, fill: '#dde4e2', band: '#557650', ink: '#557650' },
    { x: 290, w: 38, h: 204, fill: '#4f8a5f', band: '#f0e2b0' },
    { x: 328, w: 30, h: 160, fill: '#2b5d43', band: '#e6c26a' },
    { x: 358, w: 26, h: 184, fill: '#b5d3ac', band: '#3c5439', ink: '#3c5439' },
];

/** Tanaman dalam pot di samping deretan buku bersampul kain. */
export function BooksAndPlant({ className }: ArtProps) {
    return (
        <svg viewBox="0 0 440 220" className={className} aria-hidden>
            <defs>
                <linearGradient
                    id="catalogBookShade"
                    x1="0"
                    x2="1"
                    y1="0"
                    y2="0"
                >
                    <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
                    <stop offset="0.14" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.82" stopColor="#000" stopOpacity="0" />
                    <stop offset="1" stopColor="#000" stopOpacity="0.28" />
                </linearGradient>
            </defs>

            <ellipse
                cx="215"
                cy={BASELINE + 1}
                rx="205"
                ry="5"
                fill="#011a2c"
                opacity="0.09"
            />

            {/* Tanaman */}
            <g transform="translate(86 156)">
                {plantLeaves.map((leaf, index) => (
                    <g
                        key={index}
                        transform={`rotate(${leaf.r}) scale(${leaf.s})`}
                    >
                        <path d={PLANT_LEAF} className={leaf.tone} />
                        <path
                            d="M4 0L92 0"
                            className="fill-none stroke-white/40"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </g>
                ))}
            </g>
            <path
                d="M50 160H122L114 210H58Z"
                fill="#fff"
                stroke="#d5dfda"
                strokeWidth="1.2"
            />
            <rect
                x="44"
                y="152"
                width="84"
                height="12"
                rx="5"
                fill="#f4f7f5"
                stroke="#d5dfda"
                strokeWidth="1.2"
            />
            <ellipse cx="86" cy="153" rx="35" ry="3.5" fill="#5d4a39" />

            {/* Buku */}
            {books.map((book) => {
                const top = BASELINE - book.h;

                return (
                    <g key={book.x}>
                        <rect
                            x={book.x}
                            y={top}
                            width={book.w}
                            height={book.h}
                            rx="2"
                            fill={book.fill}
                        />
                        <rect
                            x={book.x}
                            y={top}
                            width={book.w}
                            height={book.h}
                            rx="2"
                            fill="url(#catalogBookShade)"
                        />
                        <rect
                            x={book.x}
                            y={top + 16}
                            width={book.w}
                            height="3"
                            fill={book.band}
                            opacity="0.85"
                        />
                        <rect
                            x={book.x}
                            y={BASELINE - 28}
                            width={book.w}
                            height="3"
                            fill={book.band}
                            opacity="0.85"
                        />
                        {book.ink && (
                            <>
                                <rect
                                    x={book.x + 7}
                                    y={top + 40}
                                    width={book.w - 14}
                                    height="2.5"
                                    rx="1"
                                    fill={book.ink}
                                    opacity="0.55"
                                />
                                <rect
                                    x={book.x + 10}
                                    y={top + 48}
                                    width={book.w - 20}
                                    height="2.5"
                                    rx="1"
                                    fill={book.ink}
                                    opacity="0.4"
                                />
                            </>
                        )}
                        {book.label && (
                            <rect
                                x={book.x + 6}
                                y={top + 36}
                                width={book.w - 12}
                                height="26"
                                rx="2"
                                fill="#f3efe4"
                                opacity="0.9"
                            />
                        )}
                    </g>
                );
            })}

            {/* Satu buku bersandar di ujung kanan */}
            <g transform={`rotate(8 400 ${BASELINE})`}>
                <rect
                    x="388"
                    y={BASELINE - 168}
                    width="24"
                    height="168"
                    rx="2"
                    className="fill-forest-moss-600"
                />
                <rect
                    x="388"
                    y={BASELINE - 168}
                    width="24"
                    height="168"
                    rx="2"
                    fill="url(#catalogBookShade)"
                />
                <rect
                    x="388"
                    y={BASELINE - 152}
                    width="24"
                    height="3"
                    fill="#f0e2b0"
                    opacity="0.85"
                />
            </g>
        </svg>
    );
}
