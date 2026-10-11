<?php

namespace App\Support\ManuscriptTemplates;

use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * Skema satu-satunya untuk template naskah (tata letak buku otomatis):
 * daftar kolom pengaturan beserta jenis, rentang, pilihan, dan nilai bawaan.
 * Dari skema ini dibuat nilai bawaan, aturan validasi, normalisasi, dan
 * definisi form untuk editor admin -- jadi backend dan frontend selalu
 * sama. Semua ukuran: mm untuk panjang halaman, pt untuk huruf dan spasi.
 */
final class TemplateSchema
{
    public const FONTS = [
        'Times New Roman', 'Cambria', 'Constantia', 'Georgia', 'Garamond', 'Book Antiqua',
        'Palatino Linotype', 'Calibri', 'Arial', 'Verdana', 'Tahoma',
        'Open Sans', 'Crimson Pro', 'EB Garamond', 'Libre Caslon Text',
        'Montserrat', 'Poppins', 'Cinzel', 'Consolas',
    ];

    /** Ukuran halaman baku (lebar × tinggi, mm). */
    public const PAGE_FORMATS = [
        'A4' => ['label' => 'A4 (210 × 297 mm)', 'w' => 210, 'h' => 297],
        'A5' => ['label' => 'A5 (148 × 210 mm)', 'w' => 148, 'h' => 210],
        'B5' => ['label' => 'B5 (176 × 250 mm)', 'w' => 176, 'h' => 250],
        'B6' => ['label' => 'B6 (125 × 176 mm)', 'w' => 125, 'h' => 176],
        'UNESCO' => ['label' => 'UNESCO (155 × 230 mm)', 'w' => 155, 'h' => 230],
        'F14x20' => ['label' => '14 × 20 cm', 'w' => 140, 'h' => 200],
        'F16x24' => ['label' => '16 × 24 cm', 'w' => 160, 'h' => 240],
        'custom' => ['label' => 'Ukuran kustom', 'w' => null, 'h' => null],
    ];

    public const FRONT_ITEMS = [
        'cover' => 'Cover',
        'title_page' => 'Halaman judul',
        'title_verso' => 'Balik halaman judul',
        'preface' => 'Kata pengantar',
        'toc' => 'Daftar isi',
        'list_of_figures' => 'Daftar gambar',
        'list_of_tables' => 'Daftar tabel',
    ];

    public const BACK_ITEMS = [
        'bibliography' => 'Daftar pustaka',
        'appendix' => 'Lampiran',
        'glossary' => 'Glosari',
        'index' => 'Indeks',
        'author_bio' => 'Biografi penulis',
    ];

    public const BODY_ITEMS = [
        'chapters' => 'Bab dan sub bab',
        'tables' => 'Tabel',
        'figures' => 'Gambar',
    ];

    public const TABS = [
        'umum' => 'Halaman & Margin',
        'tipografi' => 'Tipografi & Paragraf',
        'heading' => 'Heading',
        'headerfooter' => 'Header, Footer & Nomor',
        'visual' => 'Gambar, Tabel & Caption',
        'awal' => 'Bagian Awal',
        'isi' => 'Bagian Isi',
        'penutup' => 'Bagian Penutup',
    ];

    /** @var list<array<string, mixed>>|null */
    private static ?array $groups = null;

    /**
     * Grup kolom (satu kartu di editor). Tiap kolom: path, label, type,
     * default, dan opsional unit/min/max/step/options/help.
     *
     * @return list<array{key: string, tab: string, title: string, description: string|null, fields: list<array<string, mixed>>}>
     */
    public static function groups(): array
    {
        return self::$groups ??= self::build();
    }

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        $config = [];

        foreach (self::fields() as $field) {
            Arr::set($config, $field['path'], $field['default']);
        }

        return $config;
    }

    /** @return array<string, array<string, mixed>> path => definisi kolom */
    public static function fields(): array
    {
        $fields = [];

        foreach (self::groups() as $group) {
            foreach ($group['fields'] as $field) {
                $fields[$field['path']] = $field;
            }
        }

        return $fields;
    }

    /**
     * Aturan validasi untuk input `config` (kolom boleh tidak dikirim: yang
     * kosong memakai nilai bawaan).
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(string $prefix = 'config'): array
    {
        $rules = [$prefix => ['sometimes', 'array']];

        foreach (self::fields() as $path => $field) {
            $key = $prefix.'.'.$path;

            $rules[$key] = match ($field['type']) {
                'number' => ['sometimes', 'numeric', 'min:'.$field['min'], 'max:'.$field['max']],
                'toggle' => ['sometimes', 'boolean'],
                'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
                'font' => ['sometimes', 'string', Rule::in(self::FONTS)],
                'select' => ['sometimes', 'string', Rule::in(array_keys($field['options']))],
                'order' => ['sometimes', 'array', 'max:'.count($field['options'])],
                'textarea' => ['sometimes', 'nullable', 'string', 'max:1000'],
                default => ['sometimes', 'nullable', 'string', 'max:200'],
            };

            if ($field['type'] === 'order') {
                $rules[$key.'.*'] = ['string', Rule::in(array_keys($field['options'])), 'distinct'];
            }
        }

        return $rules;
    }

    /**
     * Gabungkan input dengan nilai bawaan, ubah ke tipe yang benar, buang
     * kolom yang tidak dikenal. Ukuran halaman baku mengisi lebar/tinggi.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function normalize(array $input): array
    {
        $config = [];

        foreach (self::fields() as $path => $field) {
            $value = Arr::get($input, $path, $field['default']);

            Arr::set($config, $path, match ($field['type']) {
                'number' => self::number($value, $field),
                'toggle' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
                'order' => self::order($value, $field),
                default => $value === null ? '' : (string) $value,
            });
        }

        $format = self::PAGE_FORMATS[$config['page']['format']] ?? null;

        if ($format && $format['w'] !== null) {
            $config['page']['width_mm'] = $format['w'];
            $config['page']['height_mm'] = $format['h'];
        }

        return $config;
    }

    /** @param  array<string, mixed>  $field */
    private static function number(mixed $value, array $field): int|float
    {
        $number = is_numeric($value) ? (float) $value : (float) $field['default'];
        $number = max($field['min'], min($field['max'], $number));

        return floor($number) == $number ? (int) $number : round($number, 3);
    }

    /**
     * @param  array<string, mixed>  $field
     * @return list<string>
     */
    private static function order(mixed $value, array $field): array
    {
        $known = array_keys($field['options']);
        $given = array_values(array_unique(array_filter((array) $value, fn ($key) => in_array($key, $known, true))));

        return [...$given, ...array_values(array_diff($known, $given))];
    }

    // ------------------------------------------------------------- definisi

    /** @return list<array<string, mixed>> */
    private static function build(): array
    {
        $groups = [];

        $add = function (string $tab, string $key, string $title, array $fields, ?string $description = null) use (&$groups) {
            $groups[] = ['key' => $key, 'tab' => $tab, 'title' => $title, 'description' => $description, 'fields' => $fields];
        };

        $num = fn (string $path, string $label, $default, $min, $max, string $unit = '', $step = 1, ?string $help = null) => [
            'path' => $path, 'label' => $label, 'type' => 'number', 'default' => $default,
            'min' => $min, 'max' => $max, 'unit' => $unit, 'step' => $step, 'help' => $help,
        ];
        $sel = fn (string $path, string $label, string $default, array $options, ?string $help = null) => [
            'path' => $path, 'label' => $label, 'type' => 'select', 'default' => $default, 'options' => $options, 'help' => $help,
        ];
        $tog = fn (string $path, string $label, bool $default, ?string $help = null) => [
            'path' => $path, 'label' => $label, 'type' => 'toggle', 'default' => $default, 'help' => $help,
        ];
        $txt = fn (string $path, string $label, string $default, ?string $help = null) => [
            'path' => $path, 'label' => $label, 'type' => 'text', 'default' => $default, 'help' => $help,
        ];
        $area = fn (string $path, string $label, string $default, ?string $help = null) => [
            'path' => $path, 'label' => $label, 'type' => 'textarea', 'default' => $default, 'help' => $help,
        ];
        $col = fn (string $path, string $label, string $default) => [
            'path' => $path, 'label' => $label, 'type' => 'color', 'default' => $default, 'help' => null,
        ];
        $font = fn (string $path, string $label, string $default) => [
            'path' => $path, 'label' => $label, 'type' => 'font', 'default' => $default, 'help' => null,
        ];
        $order = fn (string $path, string $label, array $options, ?string $help = null) => [
            'path' => $path, 'label' => $label, 'type' => 'order', 'default' => array_keys($options), 'options' => $options, 'help' => $help,
        ];

        $align = ['left' => 'Rata kiri', 'center' => 'Tengah', 'right' => 'Rata kanan', 'justify' => 'Rata kiri-kanan'];
        $alignShort = ['left' => 'Kiri', 'center' => 'Tengah', 'right' => 'Kanan'];
        $startsOn = ['any' => 'Halaman berikutnya (kiri/kanan)', 'right' => 'Selalu di halaman kanan (ganjil)'];
        $pageStyle = ['arabic' => '1, 2, 3', 'roman_lower' => 'i, ii, iii', 'roman_upper' => 'I, II, III', 'none' => 'Tanpa nomor'];

        // ---------------------------------------------------- 1. umum
        $formatOptions = array_map(fn ($format) => $format['label'], self::PAGE_FORMATS);

        $add('umum', 'page', 'Ukuran Halaman (Format)', [
            $sel('page.format', 'Format kertas', 'A5', $formatOptions),
            $num('page.width_mm', 'Lebar (kustom)', 148, 80, 500, 'mm', 0.5, 'Dipakai bila format = kustom.'),
            $num('page.height_mm', 'Tinggi (kustom)', 210, 80, 700, 'mm', 0.5),
        ]);
        $add('umum', 'margins', 'Margin (Batas Tepi)', [
            $num('margins.top_mm', 'Atas', 20, 0, 100, 'mm', 0.5),
            $num('margins.bottom_mm', 'Bawah', 20, 0, 100, 'mm', 0.5),
            $num('margins.inner_mm', 'Dalam (sisi jilid)', 22, 0, 100, 'mm', 0.5),
            $num('margins.outer_mm', 'Luar', 18, 0, 100, 'mm', 0.5),
            $tog('margins.mirror', 'Margin cermin (halaman kiri/kanan berseberangan)', true, 'Margin dalam selalu di sisi jilid.'),
        ]);
        $add('umum', 'gutter', 'Gutter (Talang Jilidan)', [
            $num('gutter.width_mm', 'Lebar gutter', 5, 0, 40, 'mm', 0.5, 'Tambahan ruang di sisi jilid, di luar margin dalam.'),
            $sel('gutter.position', 'Posisi gutter', 'inner', ['inner' => 'Sisi dalam (buku)', 'left' => 'Selalu kiri', 'top' => 'Atas (jilid kalender)']),
        ]);

        // ---------------------------------------------------- 2. tipografi
        $add('tipografi', 'body', 'Tipografi (Jenis & Ukuran Font)', [
            $font('typography.body.font', 'Jenis font isi', 'Times New Roman'),
            $num('typography.body.size_pt', 'Ukuran font isi', 11, 6, 24, 'pt', 0.5),
            $col('typography.body.color', 'Warna teks', '#000000'),
            $tog('typography.body.hyphenation', 'Pemenggalan kata otomatis', false),
        ]);
        $add('tipografi', 'spacing', 'Spasi Antarbaris (Leading), Alenia & Perataan', [
            $num('paragraph.line_spacing', 'Spasi antarbaris (leading)', 1.3, 1, 3, '×', 0.05, '1 = rapat, 1,5 = sedang, 2 = ganda.'),
            $num('paragraph.first_line_indent_mm', 'Indentasi baris pertama alenia', 8, 0, 30, 'mm', 0.5),
            $num('paragraph.space_before_pt', 'Spasi sebelum alenia', 0, 0, 48, 'pt', 0.5),
            $num('paragraph.space_after_pt', 'Spasi sesudah alenia', 0, 0, 48, 'pt', 0.5),
            $sel('paragraph.alignment', 'Perataan teks (alignment)', 'justify', $align),
            $tog('paragraph.no_indent_after_heading', 'Alenia pertama setelah heading tanpa indentasi', true),
            $tog('paragraph.widow_orphan', 'Cegah baris yatim/janda (widow & orphan)', true),
        ]);
        $add('tipografi', 'dropcap', 'Drop Cap', [
            $tog('drop_cap.enabled', 'Aktifkan drop cap', false),
            $sel('drop_cap.apply_to', 'Berlaku untuk', 'chapter_first', ['chapter_first' => 'Alenia pertama tiap bab', 'section_first' => 'Alenia pertama tiap bab dan sub bab']),
            $num('drop_cap.lines', 'Tinggi (jumlah baris)', 3, 2, 6, 'baris'),
            $font('drop_cap.font', 'Font', 'Times New Roman'),
            $col('drop_cap.color', 'Warna', '#000000'),
            $tog('drop_cap.bold', 'Tebal', true),
            $num('drop_cap.padding_mm', 'Jarak ke teks', 1.5, 0, 10, 'mm', 0.5),
        ]);

        // ---------------------------------------------------- 3. heading
        $headings = [
            'h1' => ['Heading 1 — Judul Bab', 20, 'center', true, true, 'BAB', 48, 24],
            'h2' => ['Heading 2 — Sub Bab', 14, 'left', true, false, '', 18, 8],
            'h3' => ['Heading 3 — Sub-sub Bab', 12, 'left', true, false, '', 12, 6],
        ];

        foreach ($headings as $key => [$title, $size, $hAlign, $bold, $upper, $label, $before, $after]) {
            $fields = [
                $font("heading.$key.font", 'Font', 'Times New Roman'),
                $num("heading.$key.size_pt", 'Ukuran font', $size, 8, 72, 'pt', 0.5),
                $tog("heading.$key.bold", 'Tebal', $bold),
                $tog("heading.$key.italic", 'Miring', false),
                $tog("heading.$key.uppercase", 'HURUF KAPITAL', $key === 'h1'),
                $sel("heading.$key.align", 'Perataan', $hAlign, $alignShort),
                $col("heading.$key.color", 'Warna', '#000000'),
                $num("heading.$key.space_before_pt", 'Spasi sebelum', $before, 0, 200, 'pt', 0.5),
                $num("heading.$key.space_after_pt", 'Spasi sesudah', $after, 0, 120, 'pt', 0.5),
                $sel("heading.$key.numbering", 'Penomoran', $key === 'h1' ? 'bab' : ($key === 'h2' ? 'decimal' : 'decimal'), [
                    'none' => 'Tanpa nomor',
                    'bab' => $key === 'h1' ? 'BAB 1, BAB 2, ...' : '1, 2, 3',
                    'decimal' => $key === 'h1' ? '1, 2, 3' : ($key === 'h2' ? '1.1, 1.2, ...' : '1.1.1, 1.1.2, ...'),
                    'roman' => 'I, II, III',
                    'letter' => 'A, B, C',
                ]),
                $tog("heading.$key.keep_with_next", 'Tidak boleh terpisah dari alenia sesudahnya', true),
                $tog("heading.$key.in_toc", 'Masuk daftar isi', true),
            ];

            if ($key === 'h1') {
                $fields[] = $txt('heading.h1.label', 'Kata label nomor bab', 'BAB', 'Dipakai bila penomoran "BAB 1". Kosongkan untuk tanpa label.');
                $fields[] = $sel('heading.h1.starts_on', 'Bab baru dimulai di', 'right', $startsOn);
                $fields[] = $num('heading.h1.top_offset_mm', 'Turun dari tepi atas (pembuka bab)', 30, 0, 120, 'mm', 0.5);
                $fields[] = $tog('heading.h1.number_on_own_line', 'Nomor bab di baris terpisah dari judul', true);
                $fields[] = $txt('heading.h1.number_separator', 'Pemisah nomor dan judul (bila satu baris)', ': ', 'Mis. ": " menjadi "BAB 1: PENDAHULUAN".');
            }

            $add('heading', "heading_$key", $title, $fields);
        }

        // ---------------------------------------------------- 4. header/footer/nomor
        foreach (['header' => ['Header (Kepala Halaman)', 'top', ['{judul}', '', '{nomor}']], 'footer' => ['Footer (Kaki Halaman)', 'bottom', ['', '', '']]] as $key => [$title, $edge, $texts]) {
            $add('headerfooter', $key, $title, [
                $tog("$key.enabled", 'Aktifkan '.($key === 'header' ? 'header' : 'footer'), $key === 'header'),
                $font("$key.font", 'Font', 'Times New Roman'),
                $num("$key.size_pt", 'Ukuran font', 9, 6, 16, 'pt', 0.5),
                $tog("$key.italic", 'Miring', false),
                $col("$key.color", 'Warna', '#444444'),
                $num("$key.distance_mm", 'Jarak dari tepi '.($edge === 'top' ? 'atas' : 'bawah').' halaman', 10, 0, 40, 'mm', 0.5),
                $tog("$key.line", 'Garis pemisah', $key === 'header'),
                $tog("$key.different_odd_even", 'Beda halaman kiri (genap) dan kanan (ganjil)', true),
                $txt("$key.odd_left", 'Halaman kanan — kiri', $texts[0], 'Penanda: {judul} {bab} {sub_bab} {penulis} {nomor}'),
                $txt("$key.odd_center", 'Halaman kanan — tengah', $texts[1]),
                $txt("$key.odd_right", 'Halaman kanan — kanan', $texts[2]),
                $txt("$key.even_left", 'Halaman kiri — kiri', $key === 'header' ? '{nomor}' : '', 'Dipakai bila beda kiri/kanan.'),
                $txt("$key.even_center", 'Halaman kiri — tengah', ''),
                $txt("$key.even_right", 'Halaman kiri — kanan', $key === 'header' ? '{penulis}' : ''),
                $tog("$key.hide_on_chapter_opening", 'Sembunyikan di halaman pembuka bab', true),
                $tog("$key.hide_on_blank", 'Sembunyikan di halaman kosong', true),
            ]);
        }

        $add('headerfooter', 'pagination', 'Nomor Halaman (Pagination)', [
            $sel('pagination.position', 'Letak nomor', 'footer', ['footer' => 'Footer', 'header' => 'Header']),
            $sel('pagination.align', 'Rata', 'center', ['center' => 'Tengah', 'outer' => 'Sisi luar', 'inner' => 'Sisi dalam', 'left' => 'Kiri', 'right' => 'Kanan']),
            $txt('pagination.format', 'Format nomor', '{n}', 'Mis. {n} atau "— {n} —" atau "Halaman {n}".'),
            $sel('pagination.front_style', 'Nomor bagian awal', 'roman_lower', $pageStyle),
            $sel('pagination.body_style', 'Nomor bagian isi', 'arabic', $pageStyle),
            $sel('pagination.back_style', 'Nomor bagian penutup', 'arabic', $pageStyle),
            $num('pagination.body_start', 'Bagian isi mulai dari nomor', 1, 1, 999),
            $tog('pagination.continue_back', 'Bagian penutup melanjutkan nomor bagian isi', true),
            $tog('pagination.hide_on_chapter_opening', 'Sembunyikan nomor di halaman pembuka bab', false),
            $tog('pagination.hide_on_blank', 'Sembunyikan nomor di halaman kosong', true),
            $font('pagination.font', 'Font nomor', 'Times New Roman'),
            $num('pagination.size_pt', 'Ukuran nomor', 10, 6, 18, 'pt', 0.5),
        ]);

        // ---------------------------------------------------- 5. visual
        $captionFields = function (string $prefix, string $label, string $position) use ($num, $sel, $tog, $txt, $font, $align, $col) {
            return [
                $txt("$prefix.caption.label", 'Kata label', $label),
                $txt("$prefix.caption.separator", 'Pemisah nomor dan keterangan', '.', 'Mis. "." atau ":" atau " —".'),
                $sel("$prefix.caption.position", 'Letak caption', $position, ['above' => 'Di atas', 'below' => 'Di bawah']),
                $sel("$prefix.caption.numbering", 'Penomoran', 'per_chapter', ['per_chapter' => 'Per bab (1.1, 1.2, 2.1)', 'continuous' => 'Berurutan (1, 2, 3)']),
                $font("$prefix.caption.font", 'Font', 'Times New Roman'),
                $num("$prefix.caption.size_pt", 'Ukuran font', 9.5, 6, 18, 'pt', 0.5),
                $tog("$prefix.caption.bold_label", 'Label tebal', true),
                $tog("$prefix.caption.italic", 'Keterangan miring', false),
                $col("$prefix.caption.color", 'Warna', '#000000'),
                $sel("$prefix.caption.align", 'Perataan', 'center', $align),
                $num("$prefix.caption.space_mm", 'Jarak ke '.($prefix === 'figures' ? 'gambar' : 'tabel'), 2, 0, 20, 'mm', 0.5),
            ];
        };

        $add('visual', 'figures', 'Elemen Visual — Gambar & Grafik', [
            $sel('figures.align', 'Perataan gambar', 'center', $alignShort),
            $num('figures.max_width_percent', 'Lebar maksimum (% lebar teks)', 100, 10, 100, '%'),
            $num('figures.space_before_pt', 'Spasi sebelum', 10, 0, 60, 'pt', 0.5),
            $num('figures.space_after_pt', 'Spasi sesudah', 10, 0, 60, 'pt', 0.5),
            $tog('figures.border', 'Bingkai tipis di sekeliling gambar', false),
            $tog('figures.keep_with_caption', 'Gambar tidak boleh terpisah dari caption', true),
            $txt('figures.chart_label', 'Kata label untuk grafik', 'Grafik'),
            $tog('figures.source_note', 'Sediakan baris sumber di bawah caption', true),
        ]);
        $add('visual', 'figure_caption', 'Keterangan Gambar (Caption)', $captionFields('figures', 'Gambar', 'below'));
        $add('visual', 'tables', 'Elemen Visual — Tabel', [
            $sel('tables.border_style', 'Gaya garis tabel', 'three_line', [
                'three_line' => 'Tiga garis (akademik)', 'grid' => 'Kotak penuh', 'horizontal' => 'Garis horizontal', 'none' => 'Tanpa garis',
            ]),
            $num('tables.font_size_pt', 'Ukuran font tabel', 9.5, 6, 16, 'pt', 0.5),
            $num('tables.cell_padding_pt', 'Ruang dalam sel', 3, 0, 14, 'pt', 0.5),
            $tog('tables.header_bold', 'Baris judul tebal', true),
            $col('tables.header_background', 'Warna latar baris judul', '#ffffff'),
            $tog('tables.zebra', 'Baris selang-seling berwarna', false),
            $tog('tables.repeat_header', 'Ulangi baris judul di halaman berikutnya', true),
            $sel('tables.align', 'Perataan tabel', 'center', $alignShort),
            $num('tables.space_before_pt', 'Spasi sebelum', 10, 0, 60, 'pt', 0.5),
            $num('tables.space_after_pt', 'Spasi sesudah', 10, 0, 60, 'pt', 0.5),
        ]);
        $add('visual', 'table_caption', 'Keterangan Tabel (Caption)', $captionFields('tables', 'Tabel', 'above'));

        // ---------------------------------------------------- 6. awal
        $sectionHeading = function (string $prefix, string $heading, bool $upper = true) use ($txt, $sel, $tog, $startsOn, $alignShort) {
            return [
                $tog("$prefix.enabled", 'Sertakan bagian ini', true),
                $txt("$prefix.heading", 'Judul bagian', $heading),
                $sel("$prefix.starts_on", 'Mulai di', 'right', $startsOn),
                $sel("$prefix.heading_align", 'Perataan judul bagian', 'center', $alignShort),
            ];
        };

        $add('awal', 'front_order', 'Urutan Bagian Awal', [
            $order('front_matter.order', 'Urutan halaman', self::FRONT_ITEMS, 'Geser untuk mengatur urutan; bagian yang dimatikan dilewati.'),
        ]);
        $add('awal', 'cover', 'Cover', [
            $tog('front_matter.cover.enabled', 'Sertakan cover', true),
            $tog('front_matter.cover.full_bleed', 'Gambar cover penuh sampai tepi (bleed)', true),
            $num('front_matter.cover.bleed_mm', 'Bleed', 3, 0, 10, 'mm', 0.5),
            $tog('front_matter.cover.separate_file', 'Cover dibuat sebagai berkas terpisah dari isi', true),
        ]);
        $add('awal', 'title_page', 'Halaman Judul', [
            $tog('front_matter.title_page.enabled', 'Sertakan halaman judul', true),
            $sel('front_matter.title_page.starts_on', 'Mulai di', 'right', $startsOn),
            $font('front_matter.title_page.font', 'Font judul', 'Times New Roman'),
            $num('front_matter.title_page.title_size_pt', 'Ukuran judul', 26, 10, 60, 'pt', 0.5),
            $num('front_matter.title_page.subtitle_size_pt', 'Ukuran subjudul', 14, 8, 40, 'pt', 0.5),
            $num('front_matter.title_page.author_size_pt', 'Ukuran nama penulis', 14, 8, 40, 'pt', 0.5),
            $sel('front_matter.title_page.align', 'Perataan', 'center', $alignShort),
            $num('front_matter.title_page.top_offset_mm', 'Turun dari tepi atas', 55, 0, 150, 'mm', 0.5),
            $tog('front_matter.title_page.show_publisher', 'Tampilkan nama & logo penerbit di bawah', true),
            $txt('front_matter.title_page.publisher_text', 'Teks penerbit', 'Tartila Press'),
        ]);
        $add('awal', 'title_verso', 'Balik Halaman Judul', [
            $tog('front_matter.title_verso.enabled', 'Sertakan balik halaman judul', true),
            $area('front_matter.title_verso.text', 'Isi (hak cipta, ISBN, penerbit)', "Judul: {judul}\nPenulis: {penulis}\nEditor: {editor}\nPenerbit: Tartila Press\nISBN: {isbn}\nCetakan pertama, {bulan_tahun}\n\nHak cipta dilindungi undang-undang. Dilarang memperbanyak karya ini dalam bentuk apa pun tanpa izin tertulis dari penerbit.", 'Penanda: {judul} {penulis} {editor} {isbn} {bulan_tahun}.'),
            $num('front_matter.title_verso.size_pt', 'Ukuran font', 9, 6, 14, 'pt', 0.5),
            $sel('front_matter.title_verso.vertical', 'Letak teks', 'bottom', ['top' => 'Atas', 'center' => 'Tengah', 'bottom' => 'Bawah']),
            $sel('front_matter.title_verso.align', 'Perataan', 'left', $alignShort),
        ]);
        $add('awal', 'preface', 'Kata Pengantar', [
            ...$sectionHeading('front_matter.preface', 'KATA PENGANTAR'),
            $tog('front_matter.preface.signature_block', 'Blok penutup (tempat, tanggal, nama penulis)', true),
            $sel('front_matter.preface.signature_align', 'Letak blok penutup', 'right', $alignShort),
        ]);
        $add('awal', 'toc', 'Daftar Isi', [
            ...$sectionHeading('front_matter.toc', 'DAFTAR ISI'),
            $num('front_matter.toc.depth', 'Kedalaman (level heading)', 2, 1, 3, 'level'),
            $tog('front_matter.toc.dot_leader', 'Titik-titik penghubung ke nomor halaman', true),
            $num('front_matter.toc.size_pt', 'Ukuran font', 11, 6, 16, 'pt', 0.5),
            $num('front_matter.toc.indent_mm', 'Indentasi per level', 6, 0, 20, 'mm', 0.5),
            $tog('front_matter.toc.bold_chapters', 'Bab dicetak tebal', true),
            $num('front_matter.toc.line_spacing', 'Spasi antarbaris', 1.4, 1, 3, '×', 0.05),
        ]);
        $add('awal', 'list_of_figures', 'Daftar Gambar', [
            ...$sectionHeading('front_matter.list_of_figures', 'DAFTAR GAMBAR'),
            $tog('front_matter.list_of_figures.dot_leader', 'Titik-titik penghubung', true),
            $num('front_matter.list_of_figures.size_pt', 'Ukuran font', 11, 6, 16, 'pt', 0.5),
            $tog('front_matter.list_of_figures.skip_if_empty', 'Lewati bila naskah tidak punya gambar', true),
        ]);
        $add('awal', 'list_of_tables', 'Daftar Tabel', [
            ...$sectionHeading('front_matter.list_of_tables', 'DAFTAR TABEL'),
            $tog('front_matter.list_of_tables.dot_leader', 'Titik-titik penghubung', true),
            $num('front_matter.list_of_tables.size_pt', 'Ukuran font', 11, 6, 16, 'pt', 0.5),
            $tog('front_matter.list_of_tables.skip_if_empty', 'Lewati bila naskah tidak punya tabel', true),
        ]);

        // ---------------------------------------------------- 7. isi
        $add('isi', 'body_order', 'Bagian Isi — Struktur', [
            $sel('body.start_on', 'Bagian isi dimulai di', 'right', $startsOn),
            $sel('body.columns', 'Jumlah kolom teks', '1', ['1' => '1 kolom', '2' => '2 kolom']),
            $num('body.column_gap_mm', 'Jarak antarkolom', 6, 2, 20, 'mm', 0.5),
            $order('body.order', 'Elemen isi', self::BODY_ITEMS, 'Elemen yang dikelola: bab/sub bab (heading di tab Heading), tabel dan gambar (tab Gambar, Tabel & Caption).'),
        ]);
        $add('isi', 'chapter_opening', 'Pembuka Bab', [
            $tog('body.chapter_opening.blank_verso', 'Sisipkan halaman kosong bila perlu agar bab mulai di kanan', true),
            $tog('body.chapter_opening.rule_under_title', 'Garis di bawah judul bab', false),
            $num('body.chapter_opening.rule_width_mm', 'Panjang garis', 40, 5, 150, 'mm', 0.5),
            $tog('body.chapter_opening.epigraph', 'Sediakan ruang kutipan pembuka bab (epigraf)', false),
            $sel('body.chapter_opening.epigraph_align', 'Perataan epigraf', 'right', $alignShort),
        ]);
        $add('isi', 'quotes', 'Kutipan Panjang & Daftar', [
            $num('body.block_quote.indent_mm', 'Indentasi kutipan blok', 10, 0, 40, 'mm', 0.5),
            $num('body.block_quote.size_pt', 'Ukuran font kutipan blok', 10, 6, 18, 'pt', 0.5),
            $tog('body.block_quote.italic', 'Kutipan blok miring', false),
            $num('body.list.indent_mm', 'Indentasi poin/daftar', 8, 0, 30, 'mm', 0.5),
            $num('body.list.space_pt', 'Jarak antarpoin', 2, 0, 20, 'pt', 0.5),
            $num('body.footnote.size_pt', 'Ukuran font catatan kaki', 9, 6, 14, 'pt', 0.5),
        ]);

        // ---------------------------------------------------- 8. penutup
        $add('penutup', 'back_order', 'Urutan Bagian Penutup', [
            $order('back_matter.order', 'Urutan halaman', self::BACK_ITEMS, 'Geser untuk mengatur urutan; bagian yang dimatikan dilewati.'),
        ]);
        $add('penutup', 'bibliography', 'Daftar Pustaka', [
            ...$sectionHeading('back_matter.bibliography', 'DAFTAR PUSTAKA'),
            $sel('back_matter.bibliography.style', 'Gaya kutipan', 'apa', ['apa' => 'APA', 'ieee' => 'IEEE', 'chicago' => 'Chicago', 'vancouver' => 'Vancouver', 'harvard' => 'Harvard', 'free' => 'Bebas (apa adanya)']),
            $sel('back_matter.bibliography.sort', 'Urutan entri', 'alphabetical', ['alphabetical' => 'Abjad nama penulis', 'citation' => 'Urutan kemunculan']),
            $num('back_matter.bibliography.hanging_indent_mm', 'Indentasi menggantung', 10, 0, 30, 'mm', 0.5),
            $num('back_matter.bibliography.size_pt', 'Ukuran font', 10.5, 6, 16, 'pt', 0.5),
            $num('back_matter.bibliography.line_spacing', 'Spasi antarbaris', 1.15, 1, 3, '×', 0.05),
            $num('back_matter.bibliography.entry_space_pt', 'Jarak antarentri', 6, 0, 24, 'pt', 0.5),
            $sel('back_matter.bibliography.alignment', 'Perataan', 'left', $align),
        ]);
        $add('penutup', 'appendix', 'Lampiran', [
            ...$sectionHeading('back_matter.appendix', 'LAMPIRAN'),
            $sel('back_matter.appendix.numbering', 'Penomoran lampiran', 'number', ['number' => 'Lampiran 1, 2, 3', 'letter' => 'Lampiran A, B, C', 'none' => 'Tanpa nomor']),
            $tog('back_matter.appendix.each_new_page', 'Tiap lampiran di halaman baru', true),
            $num('back_matter.appendix.size_pt', 'Ukuran font', 10.5, 6, 16, 'pt', 0.5),
        ]);
        $add('penutup', 'glossary', 'Glosari', [
            ...$sectionHeading('back_matter.glossary', 'GLOSARI'),
            $sel('back_matter.glossary.layout', 'Bentuk', 'list', ['list' => 'Daftar (istilah: arti)', 'table' => 'Tabel dua kolom']),
            $sel('back_matter.glossary.columns', 'Jumlah kolom teks', '1', ['1' => '1 kolom', '2' => '2 kolom']),
            $tog('back_matter.glossary.term_bold', 'Istilah dicetak tebal', true),
            $num('back_matter.glossary.size_pt', 'Ukuran font', 10.5, 6, 16, 'pt', 0.5),
        ]);
        $add('penutup', 'index', 'Indeks', [
            ...$sectionHeading('back_matter.index', 'INDEKS'),
            $sel('back_matter.index.columns', 'Jumlah kolom', '2', ['1' => '1 kolom', '2' => '2 kolom', '3' => '3 kolom']),
            $num('back_matter.index.column_gap_mm', 'Jarak antarkolom', 5, 2, 20, 'mm', 0.5),
            $num('back_matter.index.size_pt', 'Ukuran font', 9.5, 6, 14, 'pt', 0.5),
            $tog('back_matter.index.letter_dividers', 'Pemisah huruf awal (A, B, C, ...)', true),
            $tog('back_matter.index.dot_leader', 'Titik-titik penghubung ke halaman', false),
        ]);
        $add('penutup', 'author_bio', 'Biografi Penulis', [
            ...$sectionHeading('back_matter.author_bio', 'BIOGRAFI PENULIS'),
            $tog('back_matter.author_bio.show_photo', 'Tampilkan foto penulis', true),
            $sel('back_matter.author_bio.photo_position', 'Letak foto', 'left', ['left' => 'Kiri teks', 'right' => 'Kanan teks', 'top' => 'Di atas teks']),
            $num('back_matter.author_bio.photo_width_mm', 'Lebar foto', 30, 15, 80, 'mm', 0.5),
            $tog('back_matter.author_bio.each_author', 'Satu halaman untuk tiap penulis', true, 'Kalau penulisnya lebih dari satu, biografi penulis berikutnya dimulai di halaman baru.'),
            $num('back_matter.author_bio.size_pt', 'Ukuran font', 10.5, 6, 16, 'pt', 0.5),
            $sel('back_matter.author_bio.alignment', 'Perataan', 'justify', $align),
        ], 'Nama, foto, dan bio diambil dari isian penulis saat upload naskah; kalau kosong dari Profil Publik penulis. Biografi yang diketik di naskah diganti dengan data ini.');

        return $groups;
    }
}
