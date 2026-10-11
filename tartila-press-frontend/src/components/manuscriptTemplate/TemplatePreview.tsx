import {
    useCallback,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import {
    getPath,
    type TemplateConfig,
    type TemplateMeta,
} from '@/data/manuscriptTemplate/manuscriptTemplateApi';

export type PreviewMode = 'body' | 'front' | 'back';

const LOREM = [
    'Pendidikan adalah proses panjang yang membentuk cara manusia memahami dunia. Setiap generasi menerima pengetahuan dari generasi sebelumnya, menyaringnya, lalu mewariskannya kembali dengan sentuhan pengalaman sendiri.',
    'Dalam praktiknya, tata letak sebuah buku bukan sekadar urusan estetika. Margin yang lega, spasi yang nyaman, dan huruf yang tepat membuat pembaca bertahan lebih lama dari halaman pertama sampai halaman terakhir.',
    'Karena itu setiap keputusan kecil, dari ukuran huruf hingga jarak antarparagraf, perlu dipertimbangkan bersama-sama sebagai satu kesatuan yang utuh.',
];

const SAMPLE = {
    judul: 'Judul Buku Contoh',
    penulis: 'Nama Penulis',
    bab: 'Bab 1',
    sub_bab: '1.1 Sub Bab Contoh',
};

function roman(n: number, upper: boolean): string {
    const map: [number, string][] = [
        [1000, 'm'],
        [900, 'cm'],
        [500, 'd'],
        [400, 'cd'],
        [100, 'c'],
        [90, 'xc'],
        [50, 'l'],
        [40, 'xl'],
        [10, 'x'],
        [9, 'ix'],
        [5, 'v'],
        [4, 'iv'],
        [1, 'i'],
    ];
    let rest = n;
    let out = '';

    for (const [value, symbol] of map) {
        while (rest >= value) {
            out += symbol;
            rest -= value;
        }
    }

    return upper ? out.toUpperCase() : out;
}

function formatNumber(n: number, style: string): string {
    if (style === 'roman_lower') return roman(n, false);
    if (style === 'roman_upper') return roman(n, true);
    if (style === 'none') return '';

    return String(n);
}

type PreviewContext = {
    g: <T>(path: string, fallback: T) => T;
    mm: (v: number) => number;
    pt: (v: number) => number;
    k: number;
    pageW: number;
    pageH: number;
    body: { color: string; size: number; leading: number };
    bodyStyle: CSSProperties;
    mirror: boolean;
    gutter: number;
    gutterPosition: string;
};

type PageProps = {
    ctx: PreviewContext;
    side: 'left' | 'right';
    number: number | null;
    numberStyle?: string;
    opening?: boolean;
    blank?: boolean;
    showFurniture?: boolean;
    children: ReactNode;
    label?: string;
};

/** Satu halaman contoh: area teks bermargin, header, footer, dan nomor halaman. */
function PageFrame({
    ctx,
    side,
    number,
    numberStyle = 'arabic',
    opening = false,
    blank = false,
    showFurniture = true,
    children,
    label,
}: PageProps) {
    const {
        g,
        mm,
        pt,
        k,
        pageW,
        pageH,
        body,
        bodyStyle,
        mirror,
        gutter,
        gutterPosition,
    } = ctx;
    const inner =
        g('margins.inner_mm', 20) + (gutterPosition === 'inner' ? gutter : 0);
    const outer = g('margins.outer_mm', 18);
    const leftIsInner = mirror ? side === 'right' : true;
    const left =
        (leftIsInner ? inner : outer) +
        (gutterPosition === 'left' ? gutter : 0);
    const right = leftIsInner ? outer : inner;
    const top =
        g('margins.top_mm', 20) + (gutterPosition === 'top' ? gutter : 0);
    const bottom = g('margins.bottom_mm', 20);

    const furniture = (kind: 'header' | 'footer') => {
        if (!showFurniture || !g(`${kind}.enabled`, false)) return null;
        if (opening && g(`${kind}.hide_on_chapter_opening`, true)) return null;
        if (blank && g(`${kind}.hide_on_blank`, true)) return null;

        const different = g(`${kind}.different_odd_even`, true);
        const set = side === 'right' || !different ? 'odd' : 'even';
        const fill = (t: string) =>
            t
                .replaceAll('{judul}', SAMPLE.judul)
                .replaceAll('{penulis}', SAMPLE.penulis)
                .replaceAll('{bab}', SAMPLE.bab)
                .replaceAll('{sub_bab}', SAMPLE.sub_bab)
                .replaceAll(
                    '{nomor}',
                    number === null ? '' : formatNumber(number, numberStyle)
                );
        const style: CSSProperties = {
            position: 'absolute',
            left: mm(left),
            right: mm(right),
            [kind === 'header' ? 'top' : 'bottom']: mm(
                g(`${kind}.distance_mm`, 10)
            ),
            display: 'flex',
            justifyContent: 'space-between',
            gap: 4,
            fontFamily: `"${g(`${kind}.font`, 'Times New Roman')}", serif`,
            fontSize: pt(g(`${kind}.size_pt`, 9)),
            fontStyle: g(`${kind}.italic`, false) ? 'italic' : 'normal',
            color: g(`${kind}.color`, '#444444'),
            paddingBottom: kind === 'header' && g('header.line', false) ? 2 : 0,
            paddingTop: kind === 'footer' && g('footer.line', false) ? 2 : 0,
            [kind === 'header' ? 'borderBottom' : 'borderTop']: g(
                `${kind}.line`,
                false
            )
                ? `${Math.max(0.5, k * 0.2)}px solid #888`
                : 'none',
        };

        return (
            <div style={style}>
                <span style={{ flex: 1, textAlign: 'left' }}>
                    {fill(g(`${kind}.${set}_left`, ''))}
                </span>
                <span style={{ flex: 1, textAlign: 'center' }}>
                    {fill(g(`${kind}.${set}_center`, ''))}
                </span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                    {fill(g(`${kind}.${set}_right`, ''))}
                </span>
            </div>
        );
    };

    const pageNumber = () => {
        if (!showFurniture || number === null || numberStyle === 'none')
            return null;
        if (opening && g('pagination.hide_on_chapter_opening', false))
            return null;
        if (blank && g('pagination.hide_on_blank', true)) return null;

        const place = g<string>('pagination.position', 'footer');
        const alignRaw = g<string>('pagination.align', 'center');
        const align =
            alignRaw === 'outer'
                ? side === 'right'
                    ? 'right'
                    : 'left'
                : alignRaw === 'inner'
                  ? side === 'right'
                      ? 'left'
                      : 'right'
                  : alignRaw;
        const text = g('pagination.format', '{n}').replaceAll(
            '{n}',
            formatNumber(number, numberStyle)
        );

        return (
            <div
                style={{
                    position: 'absolute',
                    left: mm(left),
                    right: mm(right),
                    [place === 'header' ? 'top' : 'bottom']: mm(
                        Math.max(
                            2,
                            g(`${place}.distance_mm`, 10) -
                                (place === 'footer' &&
                                g('footer.enabled', false)
                                    ? 0
                                    : 0)
                        )
                    ),
                    textAlign: align as CSSProperties['textAlign'],
                    fontFamily: `"${g('pagination.font', 'Times New Roman')}", serif`,
                    fontSize: pt(g('pagination.size_pt', 10)),
                    color: body.color,
                }}
            >
                {text}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-1">
            <div
                className="relative bg-white shadow ring-1 ring-black/10 overflow-hidden"
                style={{ width: mm(pageW), height: mm(pageH) }}
            >
                {/* area teks */}
                <div
                    style={{
                        position: 'absolute',
                        left: mm(left),
                        right: mm(right),
                        top: mm(top),
                        bottom: mm(bottom),
                        outline: '1px dashed rgba(16,49,95,0.18)',
                        overflow: 'hidden',
                        ...bodyStyle,
                    }}
                >
                    {children}
                </div>
                {furniture('header')}
                {furniture('footer')}
                {pageNumber()}
            </div>
            {label && (
                <p className="text-oxford-navy-900/55 text-center text-[11px]">
                    {label}
                </p>
            )}
        </div>
    );
}

/**
 * Pratinjau tata letak template: halaman-halaman contoh digambar dengan HTML
 * memakai ukuran sebenarnya (mm/pt) yang diskalakan ke lebar panel. Hanya
 * ilustrasi -- hasil akhir dibuat mesin tata letak di tahap berikutnya.
 */
export default function TemplatePreview({
    config,
    meta,
    mode,
}: {
    config: TemplateConfig;
    meta: TemplateMeta;
    mode: PreviewMode;
}) {
    const [width, setWidth] = useState<number>(0);

    // Lebar panel diukur saat dipasang (tanpa menunggu frame) lalu diikuti
    // perubahan ukurannya.
    const containerRef = useCallback((element: HTMLDivElement | null) => {
        if (!element) {
            return;
        }

        setWidth(element.getBoundingClientRect().width);

        const observer = new ResizeObserver((entries) =>
            setWidth(entries[0].contentRect.width)
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const g = <T,>(path: string, fallback: T): T => {
        const value = getPath<T>(config, path);

        return value === undefined ||
            value === null ||
            (value as unknown) === ''
            ? fallback
            : value;
    };

    const format = g<string>('page.format', 'A5');
    const preset = meta.page_formats[format];
    const pageW = preset?.w ?? g<number>('page.width_mm', 148);
    const pageH = preset?.h ?? g<number>('page.height_mm', 210);

    const gap = 12;
    const k = width > 0 ? (width - gap) / (2 * pageW) : 1; // px per mm
    const mm = (v: number) => v * k;
    const pt = (v: number) => v * 0.352778 * k;

    // ----------------------------------------------------------- gaya dasar
    const body = {
        font: g('typography.body.font', 'Times New Roman'),
        size: g('typography.body.size_pt', 11),
        color: g('typography.body.color', '#000000'),
        leading: g('paragraph.line_spacing', 1.3),
        align: g<string>('paragraph.alignment', 'justify'),
        indent: g('paragraph.first_line_indent_mm', 8),
        before: g('paragraph.space_before_pt', 0),
        after: g('paragraph.space_after_pt', 0),
        noIndentAfterHeading: g('paragraph.no_indent_after_heading', true),
        hyphens: g('typography.body.hyphenation', false),
    };

    const bodyStyle: CSSProperties = {
        fontFamily: `"${body.font}", serif`,
        fontSize: pt(body.size),
        // Spasi Word: 1 = satu spasi (kira-kira 1,2 x ukuran huruf).
        lineHeight: body.leading * 1.2,
        color: body.color,
        textAlign: body.align as CSSProperties['textAlign'],
        hyphens: body.hyphens ? 'auto' : 'manual',
    };

    const paragraph = (
        text: string,
        first = false,
        extra: CSSProperties = {}
    ) => (
        <p
            key={text.slice(0, 20) + String(first)}
            style={{
                margin: 0,
                marginTop: pt(body.before),
                marginBottom: pt(body.after),
                textIndent:
                    first && body.noIndentAfterHeading ? 0 : mm(body.indent),
                ...extra,
            }}
        >
            {text}
        </p>
    );

    const headingStyle = (key: 'h1' | 'h2' | 'h3'): CSSProperties => ({
        fontFamily: `"${g(`heading.${key}.font`, 'Times New Roman')}", serif`,
        fontSize: pt(g(`heading.${key}.size_pt`, 14)),
        fontWeight: g(`heading.${key}.bold`, true) ? 700 : 400,
        fontStyle: g(`heading.${key}.italic`, false) ? 'italic' : 'normal',
        textTransform: g(`heading.${key}.uppercase`, false)
            ? 'uppercase'
            : 'none',
        textAlign: g<string>(
            `heading.${key}.align`,
            'left'
        ) as CSSProperties['textAlign'],
        color: g(`heading.${key}.color`, '#000000'),
        marginTop: pt(g(`heading.${key}.space_before_pt`, 12)),
        marginBottom: pt(g(`heading.${key}.space_after_pt`, 6)),
        lineHeight: 1.2,
    });

    const numberLabel = (key: 'h1' | 'h2' | 'h3', n: number): string => {
        const style = g<string>(`heading.${key}.numbering`, 'none');
        const label = key === 'h1' ? g<string>('heading.h1.label', '') : '';

        if (style === 'none') return '';
        if (style === 'bab')
            return key === 'h1' ? `${label ? `${label} ` : ''}${n}` : String(n);
        if (style === 'roman') return roman(n, true);
        if (style === 'letter') return String.fromCharCode(64 + n);
        if (key === 'h2') return `1.${n}`;
        if (key === 'h3') return `1.1.${n}`;

        return String(n);
    };

    const caption = (
        kind: 'figures' | 'tables',
        number: string,
        text: string
    ) => (
        <p
            style={{
                margin: 0,
                fontFamily: `"${g(`${kind}.caption.font`, 'Times New Roman')}", serif`,
                fontSize: pt(g(`${kind}.caption.size_pt`, 9.5)),
                textAlign: g<string>(
                    `${kind}.caption.align`,
                    'center'
                ) as CSSProperties['textAlign'],
                fontStyle: g(`${kind}.caption.italic`, false)
                    ? 'italic'
                    : 'normal',
                [g<string>(`${kind}.caption.position`, 'below') === 'below'
                    ? 'marginTop'
                    : 'marginBottom']: mm(g(`${kind}.caption.space_mm`, 2)),
                color: g(`${kind}.caption.color`, body.color),
            }}
        >
            <span
                style={{
                    fontWeight: g(`${kind}.caption.bold_label`, true)
                        ? 700
                        : 400,
                }}
            >
                {g(
                    `${kind}.caption.label`,
                    kind === 'figures' ? 'Gambar' : 'Tabel'
                )}{' '}
                {number}
            </span>
            {g(`${kind}.caption.separator`, '.')} {text}
        </p>
    );

    // ----------------------------------------------------------- halaman
    const mirror = g('margins.mirror', true);
    const gutter = g('gutter.width_mm', 0);
    const gutterPosition = g<string>('gutter.position', 'inner');

    const ctx: PreviewContext = {
        g,
        mm,
        pt,
        k,
        pageW,
        pageH,
        body,
        bodyStyle,
        mirror,
        gutter,
        gutterPosition,
    };

    // ----------------------------------------------------------- isi bab
    const figureBlock = (
        <div
            key="fig"
            style={{
                marginTop: pt(g('figures.space_before_pt', 10)),
                marginBottom: pt(g('figures.space_after_pt', 10)),
                display: 'flex',
                flexDirection:
                    g<string>('figures.caption.position', 'below') === 'below'
                        ? 'column'
                        : 'column-reverse',
                alignItems:
                    { left: 'flex-start', center: 'center', right: 'flex-end' }[
                        g<string>('figures.align', 'center')
                    ] ?? 'center',
            }}
        >
            <div
                style={{
                    width: `${g('figures.max_width_percent', 100)}%`,
                    height: mm(pageH * 0.17),
                    background:
                        'repeating-linear-gradient(45deg,#e5e9f0,#e5e9f0 6px,#d7dde8 6px,#d7dde8 12px)',
                    border: g('figures.border', false)
                        ? '1px solid #666'
                        : 'none',
                }}
            />
            {caption(
                'figures',
                g<string>('figures.caption.numbering', 'per_chapter') ===
                    'per_chapter'
                    ? '1.1'
                    : '1',
                'Keterangan gambar contoh'
            )}
        </div>
    );

    const border = g<string>('tables.border_style', 'three_line');
    const cell = (head: boolean, last = false): CSSProperties => ({
        padding: pt(g('tables.cell_padding_pt', 3)),
        fontWeight: head && g('tables.header_bold', true) ? 700 : 400,
        background: head
            ? g('tables.header_background', '#ffffff')
            : 'transparent',
        borderTop:
            border === 'grid' ||
            (border === 'three_line' && head) ||
            border === 'horizontal'
                ? '1px solid #333'
                : 'none',
        borderBottom:
            border === 'grid' ||
            border === 'horizontal' ||
            (border === 'three_line' && (head || last))
                ? '1px solid #333'
                : 'none',
        borderLeft: border === 'grid' ? '1px solid #333' : 'none',
        borderRight: border === 'grid' ? '1px solid #333' : 'none',
        textAlign: 'left',
    });

    const tableBlock = (
        <div
            key="tbl"
            style={{
                marginTop: pt(g('tables.space_before_pt', 10)),
                marginBottom: pt(g('tables.space_after_pt', 10)),
                display: 'flex',
                flexDirection:
                    g<string>('tables.caption.position', 'above') === 'above'
                        ? 'column'
                        : 'column-reverse',
            }}
        >
            {caption(
                'tables',
                g<string>('tables.caption.numbering', 'per_chapter') ===
                    'per_chapter'
                    ? '1.1'
                    : '1',
                'Keterangan tabel contoh'
            )}
            <table
                style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    fontSize: pt(g('tables.font_size_pt', 9.5)),
                    textIndent: 0,
                    alignSelf:
                        g<string>('tables.align', 'center') === 'center'
                            ? 'center'
                            : g<string>('tables.align', 'center') === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                }}
            >
                <tbody>
                    {[
                        ['Kolom A', 'Kolom B', 'Kolom C'],
                        ['12', '34', '56'],
                        ['78', '90', '12'],
                    ].map((row, index, all) => (
                        <tr
                            key={index}
                            style={{
                                background:
                                    g('tables.zebra', false) &&
                                    index % 2 === 0 &&
                                    index > 0
                                        ? '#eef1f6'
                                        : 'transparent',
                            }}
                        >
                            {row.map((text) => (
                                <td
                                    key={text}
                                    style={cell(
                                        index === 0,
                                        index === all.length - 1
                                    )}
                                >
                                    {text}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const dropCap = (text: string) => {
        if (!g('drop_cap.enabled', false)) return paragraph(text, true);

        const lines = g('drop_cap.lines', 3);
        const lineHeight = pt(body.size) * body.leading;

        return (
            <p style={{ margin: 0, textIndent: 0 }}>
                <span
                    style={{
                        float: 'left',
                        fontFamily: `"${g('drop_cap.font', 'Times New Roman')}", serif`,
                        fontWeight: g('drop_cap.bold', true) ? 700 : 400,
                        color: g('drop_cap.color', '#000000'),
                        fontSize: lineHeight * lines * 0.92,
                        lineHeight: 0.82,
                        paddingRight: mm(g('drop_cap.padding_mm', 1.5)),
                        paddingTop: lineHeight * 0.06,
                    }}
                >
                    {text.charAt(0)}
                </span>
                {text.slice(1)}
            </p>
        );
    };

    const chapterOpening = (
        <>
            <div style={{ height: mm(g('heading.h1.top_offset_mm', 30)) }} />
            <div style={headingStyle('h1')}>
                {numberLabel('h1', 1) && (
                    <span
                        style={{
                            display: g('heading.h1.number_on_own_line', true)
                                ? 'block'
                                : 'inline',
                        }}
                    >
                        {numberLabel('h1', 1)}
                        {g('heading.h1.number_on_own_line', true)
                            ? ''
                            : g('heading.h1.number_separator', ': ')}
                    </span>
                )}
                <div
                    style={{
                        display: g('heading.h1.number_on_own_line', true)
                            ? 'block'
                            : 'inline',
                    }}
                >
                    Pendahuluan
                </div>
            </div>
            {g('body.chapter_opening.rule_under_title', false) && (
                <div
                    style={{
                        height: 1,
                        width: mm(g('body.chapter_opening.rule_width_mm', 40)),
                        background: '#333',
                        margin: `0 ${g<string>('heading.h1.align', 'center') === 'center' ? 'auto' : '0'} ${pt(8)}px`,
                    }}
                />
            )}
            {g('body.chapter_opening.epigraph', false) && (
                <p
                    style={{
                        margin: `0 0 ${pt(10)}px`,
                        fontStyle: 'italic',
                        textAlign: g<string>(
                            'body.chapter_opening.epigraph_align',
                            'right'
                        ) as CSSProperties['textAlign'],
                        textIndent: 0,
                    }}
                >
                    “Belajar tak pernah berhenti.”
                </p>
            )}
            {dropCap(LOREM[0])}
            {paragraph(LOREM[1])}
            {paragraph(LOREM[2])}
        </>
    );

    const bodyContent = (
        <>
            <div style={headingStyle('h2')}>
                {numberLabel('h2', 1)} Sub Bab Contoh
            </div>
            {paragraph(LOREM[1], true)}
            {paragraph(LOREM[0])}
            <div style={headingStyle('h3')}>
                {numberLabel('h3', 1)} Sub-sub Bab Contoh
            </div>
            {paragraph(LOREM[2], true)}
            {figureBlock}
            {paragraph(LOREM[0])}
            {tableBlock}
        </>
    );

    // ----------------------------------------------------------- bagian awal
    const sectionTitle = (prefix: string, fallback: string) => (
        <div
            style={{
                ...headingStyle('h1'),
                fontSize: pt(Math.min(16, g('heading.h1.size_pt', 16))),
                textAlign: g<string>(
                    `${prefix}.heading_align`,
                    'center'
                ) as CSSProperties['textAlign'],
                marginTop: 0,
            }}
        >
            {g(`${prefix}.heading`, fallback)}
        </div>
    );

    const dots = (
        title: string,
        pageNo: string,
        indent = 0,
        bold = false,
        size = 11
    ) => (
        <div
            key={title}
            style={{
                display: 'flex',
                alignItems: 'baseline',
                paddingLeft: mm(indent),
                fontWeight: bold ? 700 : 400,
                fontSize: pt(size),
                textIndent: 0,
                textAlign: 'left',
            }}
        >
            <span>{title}</span>
            <span
                style={{
                    flex: 1,
                    borderBottom: g('front_matter.toc.dot_leader', true)
                        ? '1px dotted #555'
                        : 'none',
                    margin: '0 3px',
                    transform: 'translateY(-2px)',
                }}
            />
            <span>{pageNo}</span>
        </div>
    );

    const frontPages = (() => {
        const verso = g<string>('front_matter.title_verso.text', '')
            .replaceAll('{judul}', SAMPLE.judul)
            .replaceAll('{penulis}', SAMPLE.penulis)
            .replaceAll('{editor}', 'Nama Editor')
            .replaceAll('{isbn}', '978-623-0000-00-0')
            .replaceAll('{bulan_tahun}', 'Oktober 2026');
        const toc = [
            ['Kata Pengantar', 'v', 0, true],
            ['Daftar Isi', 'vii', 0, true],
            [
                'Bab 1 Pendahuluan',
                '1',
                0,
                g('front_matter.toc.bold_chapters', true),
            ],
            [
                '1.1 Latar Belakang',
                '3',
                g('front_matter.toc.indent_mm', 6),
                false,
            ],
            ['1.2 Tujuan', '7', g('front_matter.toc.indent_mm', 6), false],
            [
                'Bab 2 Tinjauan Pustaka',
                '15',
                0,
                g('front_matter.toc.bold_chapters', true),
            ],
            ['Daftar Pustaka', '88', 0, true],
        ] as [string, string, number, boolean][];

        return [
            {
                key: 'title_page',
                label: 'Halaman judul',
                el: g('front_matter.title_page.enabled', true) && (
                    <PageFrame
                        ctx={ctx}
                        side="right"
                        number={null}
                        numberStyle="none"
                        showFurniture={false}
                    >
                        <div
                            style={{
                                height: mm(
                                    g(
                                        'front_matter.title_page.top_offset_mm',
                                        55
                                    )
                                ),
                                textIndent: 0,
                            }}
                        />
                        <div
                            style={{
                                textAlign: g<string>(
                                    'front_matter.title_page.align',
                                    'center'
                                ) as CSSProperties['textAlign'],
                                fontFamily: `"${g('front_matter.title_page.font', 'Times New Roman')}", serif`,
                                textIndent: 0,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: pt(
                                        g(
                                            'front_matter.title_page.title_size_pt',
                                            26
                                        )
                                    ),
                                    fontWeight: 700,
                                    lineHeight: 1.15,
                                }}
                            >
                                {SAMPLE.judul.toUpperCase()}
                            </div>
                            <div
                                style={{
                                    fontSize: pt(
                                        g(
                                            'front_matter.title_page.subtitle_size_pt',
                                            14
                                        )
                                    ),
                                    marginTop: pt(8),
                                }}
                            >
                                Subjudul buku contoh
                            </div>
                            <div
                                style={{
                                    fontSize: pt(
                                        g(
                                            'front_matter.title_page.author_size_pt',
                                            14
                                        )
                                    ),
                                    marginTop: pt(40),
                                }}
                            >
                                {SAMPLE.penulis}
                            </div>
                        </div>
                        {g('front_matter.title_page.show_publisher', true) && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    textAlign: 'center',
                                    fontSize: pt(11),
                                    textIndent: 0,
                                }}
                            >
                                {g(
                                    'front_matter.title_page.publisher_text',
                                    'Tartila Press'
                                )}
                            </div>
                        )}
                    </PageFrame>
                ),
            },
            {
                key: 'title_verso',
                label: 'Balik halaman judul',
                el: g('front_matter.title_verso.enabled', true) && (
                    <PageFrame
                        ctx={ctx}
                        side="left"
                        number={null}
                        numberStyle="none"
                        showFurniture={false}
                        blank
                    >
                        <div
                            style={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent:
                                    {
                                        top: 'flex-start',
                                        center: 'center',
                                        bottom: 'flex-end',
                                    }[
                                        g<string>(
                                            'front_matter.title_verso.vertical',
                                            'bottom'
                                        )
                                    ] ?? 'flex-end',
                                fontSize: pt(
                                    g('front_matter.title_verso.size_pt', 9)
                                ),
                                textAlign: g<string>(
                                    'front_matter.title_verso.align',
                                    'left'
                                ) as CSSProperties['textAlign'],
                                whiteSpace: 'pre-line',
                                textIndent: 0,
                            }}
                        >
                            {verso}
                        </div>
                    </PageFrame>
                ),
            },
            {
                key: 'preface',
                label: 'Kata pengantar',
                el: g('front_matter.preface.enabled', true) && (
                    <PageFrame
                        ctx={ctx}
                        side="right"
                        number={5}
                        numberStyle={g('pagination.front_style', 'roman_lower')}
                        opening
                    >
                        {sectionTitle('front_matter.preface', 'KATA PENGANTAR')}
                        {paragraph(LOREM[0], true)}
                        {paragraph(LOREM[1])}
                        {g('front_matter.preface.signature_block', true) && (
                            <p
                                style={{
                                    margin: `${pt(14)}px 0 0`,
                                    textAlign: g<string>(
                                        'front_matter.preface.signature_align',
                                        'right'
                                    ) as CSSProperties['textAlign'],
                                    textIndent: 0,
                                }}
                            >
                                Batam, Oktober 2026
                                <br />
                                <br />
                                <br />
                                {SAMPLE.penulis}
                            </p>
                        )}
                    </PageFrame>
                ),
            },
            {
                key: 'toc',
                label: 'Daftar isi',
                el: g('front_matter.toc.enabled', true) && (
                    <PageFrame
                        ctx={ctx}
                        side="left"
                        number={6}
                        numberStyle={g('pagination.front_style', 'roman_lower')}
                        opening
                    >
                        {sectionTitle('front_matter.toc', 'DAFTAR ISI')}
                        <div
                            style={{
                                lineHeight: g(
                                    'front_matter.toc.line_spacing',
                                    1.4
                                ),
                            }}
                        >
                            {toc
                                .filter(
                                    (row) =>
                                        row[2] === 0 ||
                                        g('front_matter.toc.depth', 2) >= 2
                                )
                                .map(([title, no, indent, bold]) =>
                                    dots(
                                        title,
                                        no,
                                        indent,
                                        bold,
                                        g('front_matter.toc.size_pt', 11)
                                    )
                                )}
                        </div>
                    </PageFrame>
                ),
            },
        ];
    })();

    // ----------------------------------------------------------- bagian penutup
    const backPages = [
        {
            key: 'bibliography',
            label: 'Daftar pustaka',
            el: g('back_matter.bibliography.enabled', true) && (
                <PageFrame
                    ctx={ctx}
                    side="right"
                    number={89}
                    numberStyle={g('pagination.back_style', 'arabic')}
                    opening
                >
                    {sectionTitle('back_matter.bibliography', 'DAFTAR PUSTAKA')}
                    <div
                        style={{
                            fontSize: pt(
                                g('back_matter.bibliography.size_pt', 10.5)
                            ),
                            lineHeight: g(
                                'back_matter.bibliography.line_spacing',
                                1.15
                            ),
                            textAlign: g<string>(
                                'back_matter.bibliography.alignment',
                                'left'
                            ) as CSSProperties['textAlign'],
                        }}
                    >
                        {[
                            'Ahmad, R. (2020). Pendidikan dan perubahan sosial. Jakarta: Pustaka Maju.',
                            'Budi, S., & Citra, L. (2019). Tata letak buku akademik. Bandung: Media Ilmu.',
                            'Dewi, A. (2021). Literasi di era digital. Surabaya: Cahaya Aksara.',
                        ].map((entry) => (
                            <p
                                key={entry}
                                style={{
                                    margin: 0,
                                    marginBottom: pt(
                                        g(
                                            'back_matter.bibliography.entry_space_pt',
                                            6
                                        )
                                    ),
                                    paddingLeft: mm(
                                        g(
                                            'back_matter.bibliography.hanging_indent_mm',
                                            10
                                        )
                                    ),
                                    textIndent: -mm(
                                        g(
                                            'back_matter.bibliography.hanging_indent_mm',
                                            10
                                        )
                                    ),
                                }}
                            >
                                {entry}
                            </p>
                        ))}
                    </div>
                </PageFrame>
            ),
        },
        {
            key: 'glossary',
            label: 'Glosari',
            el: g('back_matter.glossary.enabled', true) && (
                <PageFrame
                    ctx={ctx}
                    side="left"
                    number={90}
                    numberStyle={g('pagination.back_style', 'arabic')}
                    opening
                >
                    {sectionTitle('back_matter.glossary', 'GLOSARI')}
                    <div
                        style={{
                            columnCount: Number(
                                g('back_matter.glossary.columns', '1')
                            ),
                            fontSize: pt(
                                g('back_matter.glossary.size_pt', 10.5)
                            ),
                        }}
                    >
                        {[
                            ['Literasi', 'kemampuan membaca dan menulis'],
                            ['Kurikulum', 'rancangan pembelajaran'],
                            ['Evaluasi', 'penilaian hasil belajar'],
                        ].map(([term, meaning]) => (
                            <p
                                key={term}
                                style={{
                                    margin: 0,
                                    marginBottom: pt(4),
                                    textIndent: 0,
                                    textAlign: 'left',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: g(
                                            'back_matter.glossary.term_bold',
                                            true
                                        )
                                            ? 700
                                            : 400,
                                    }}
                                >
                                    {term}
                                </span>
                                : {meaning}
                            </p>
                        ))}
                    </div>
                </PageFrame>
            ),
        },
        {
            key: 'index',
            label: 'Indeks',
            el: g('back_matter.index.enabled', true) && (
                <PageFrame
                    ctx={ctx}
                    side="right"
                    number={91}
                    numberStyle={g('pagination.back_style', 'arabic')}
                    opening
                >
                    {sectionTitle('back_matter.index', 'INDEKS')}
                    <div
                        style={{
                            columnCount: Number(
                                g('back_matter.index.columns', '2')
                            ),
                            columnGap: mm(
                                g('back_matter.index.column_gap_mm', 5)
                            ),
                            fontSize: pt(g('back_matter.index.size_pt', 9.5)),
                            textAlign: 'left',
                        }}
                    >
                        {[
                            'A',
                            'Alenia, 12',
                            'Anggaran, 40',
                            'B',
                            'Bab, 1',
                            'Bibliografi, 88',
                            'D',
                            'Daftar isi, vii',
                            'Drop cap, 5',
                        ].map((entry) => (
                            <p
                                key={entry}
                                style={{
                                    margin: 0,
                                    textIndent: 0,
                                    fontWeight:
                                        entry.length === 1 &&
                                        g(
                                            'back_matter.index.letter_dividers',
                                            true
                                        )
                                            ? 700
                                            : 400,
                                    marginTop: entry.length === 1 ? pt(4) : 0,
                                }}
                            >
                                {entry}
                            </p>
                        ))}
                    </div>
                </PageFrame>
            ),
        },
        {
            key: 'author_bio',
            label: 'Biografi penulis',
            el: g('back_matter.author_bio.enabled', true) && (
                <PageFrame
                    ctx={ctx}
                    side="left"
                    number={92}
                    numberStyle={g('pagination.back_style', 'arabic')}
                    opening
                >
                    {sectionTitle('back_matter.author_bio', 'BIOGRAFI PENULIS')}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection:
                                g<string>(
                                    'back_matter.author_bio.photo_position',
                                    'left'
                                ) === 'top'
                                    ? 'column'
                                    : g<string>(
                                            'back_matter.author_bio.photo_position',
                                            'left'
                                        ) === 'right'
                                      ? 'row-reverse'
                                      : 'row',
                            gap: mm(4),
                            fontSize: pt(
                                g('back_matter.author_bio.size_pt', 10.5)
                            ),
                            textAlign: g<string>(
                                'back_matter.author_bio.alignment',
                                'justify'
                            ) as CSSProperties['textAlign'],
                        }}
                    >
                        {g('back_matter.author_bio.show_photo', true) && (
                            <div
                                style={{
                                    width: mm(
                                        g(
                                            'back_matter.author_bio.photo_width_mm',
                                            30
                                        )
                                    ),
                                    height: mm(
                                        g(
                                            'back_matter.author_bio.photo_width_mm',
                                            30
                                        ) * 1.3
                                    ),
                                    background: '#d7dde8',
                                    flexShrink: 0,
                                }}
                            />
                        )}
                        <p style={{ margin: 0, textIndent: 0 }}>
                            {SAMPLE.penulis} lahir di Batam dan aktif menulis
                            tentang pendidikan. {LOREM[2]}
                        </p>
                    </div>
                </PageFrame>
            ),
        },
    ];

    const sectionPages = mode === 'front' ? frontPages : backPages;

    return (
        <div ref={containerRef} className="w-full">
            {width > 0 && mode === 'body' && (
                <div className="flex flex-row" style={{ gap }}>
                    <PageFrame
                        ctx={ctx}
                        side="left"
                        number={2}
                        numberStyle={g('pagination.body_style', 'arabic')}
                        label="Halaman isi (kiri/genap)"
                    >
                        {bodyContent}
                    </PageFrame>
                    <PageFrame
                        ctx={ctx}
                        side="right"
                        number={3}
                        numberStyle={g('pagination.body_style', 'arabic')}
                        opening
                        label="Pembuka bab (kanan/ganjil)"
                    >
                        {chapterOpening}
                    </PageFrame>
                </div>
            )}

            {width > 0 && mode !== 'body' && (
                <div className="grid grid-cols-2" style={{ gap }}>
                    {sectionPages.map((page) => (
                        <div key={page.key} className="flex flex-col gap-1">
                            {page.el ? (
                                page.el
                            ) : (
                                <div
                                    className="flex items-center justify-center bg-forest-moss-50 text-oxford-navy-900/55 text-xs ring-1 ring-forest-moss-100"
                                    style={{
                                        width: mm(pageW),
                                        height: mm(pageH),
                                    }}
                                >
                                    {page.label} (dimatikan)
                                </div>
                            )}
                            {page.el && (
                                <p className="text-oxford-navy-900/55 text-center text-[11px]">
                                    {page.label}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
