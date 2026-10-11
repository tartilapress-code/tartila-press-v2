<?php

namespace App\Support\ManuscriptTemplates;

/**
 * Template bawaan. "Embedded System" mengikuti tata letak buku
 * "EBook_Embedded System.pdf" (Tartila Press, 2026): B5, Constantia 11 pt,
 * rata kiri-kanan tanpa indentasi dengan spasi 6 pt antar-alenia, judul bab
 * "BAB 1: JUDUL" 18 pt tebal biru tua di tengah, sub bab 11 pt tebal, footer
 * "Judul | nomor" di sisi luar (romawi di bagian awal), caption 10 pt miring,
 * tabel bergaris kotak, daftar pustaka gaya IEEE, biodata penulis.
 */
final class DefaultTemplates
{
    public const EMBEDDED_SYSTEM_NAME = 'Bawaan — Embedded System (B5)';

    /** @return array<string, mixed> config (sebelum dinormalisasi skema) */
    public static function embeddedSystem(): array
    {
        $font = 'Constantia';
        $navy = '#2E4057';
        $caption = fn (string $label, string $position) => [
            'label' => $label, 'separator' => '', 'position' => $position, 'numbering' => 'per_chapter',
            'font' => $font, 'size_pt' => 10, 'bold_label' => false, 'italic' => true, 'align' => 'center',
            'space_mm' => 2, 'color' => '#0E2841',
        ];

        return [
            'page' => ['format' => 'B5'],
            'margins' => ['top_mm' => 20, 'bottom_mm' => 22, 'inner_mm' => 20, 'outer_mm' => 19, 'mirror' => false],
            'gutter' => ['width_mm' => 0, 'position' => 'inner'],
            'typography' => ['body' => ['font' => $font, 'size_pt' => 11, 'color' => '#000000', 'hyphenation' => false]],
            'paragraph' => [
                'line_spacing' => 1, 'first_line_indent_mm' => 0, 'space_before_pt' => 0, 'space_after_pt' => 6,
                'alignment' => 'justify', 'no_indent_after_heading' => true, 'widow_orphan' => true,
            ],
            'drop_cap' => ['enabled' => false],
            'heading' => [
                'h1' => [
                    'font' => $font, 'size_pt' => 18, 'bold' => true, 'italic' => false, 'uppercase' => true, 'align' => 'center',
                    'color' => $navy, 'space_before_pt' => 0, 'space_after_pt' => 18, 'numbering' => 'bab', 'label' => 'BAB',
                    'starts_on' => 'any', 'top_offset_mm' => 0, 'number_on_own_line' => false, 'number_separator' => ': ',
                    'keep_with_next' => true, 'in_toc' => true,
                ],
                'h2' => [
                    'font' => $font, 'size_pt' => 11, 'bold' => true, 'italic' => false, 'uppercase' => false, 'align' => 'left',
                    'color' => '#000000', 'space_before_pt' => 6, 'space_after_pt' => 6, 'numbering' => 'decimal',
                    'keep_with_next' => true, 'in_toc' => true,
                ],
                'h3' => [
                    'font' => $font, 'size_pt' => 11, 'bold' => true, 'italic' => false, 'uppercase' => false, 'align' => 'left',
                    'color' => '#000000', 'space_before_pt' => 6, 'space_after_pt' => 6, 'numbering' => 'none',
                    'keep_with_next' => true, 'in_toc' => false,
                ],
            ],
            'header' => ['enabled' => false],
            'footer' => [
                'enabled' => true, 'font' => $font, 'size_pt' => 11, 'italic' => false, 'color' => '#000000',
                'distance_mm' => 11, 'line' => false, 'different_odd_even' => true,
                'odd_left' => '', 'odd_center' => '', 'odd_right' => '{judul} | {nomor}',
                'even_left' => '{judul} | {nomor}', 'even_center' => '', 'even_right' => '',
                'hide_on_chapter_opening' => false, 'hide_on_blank' => true,
            ],
            'pagination' => [
                'position' => 'footer', 'align' => 'outer', 'format' => '{n}', 'front_style' => 'roman_lower',
                'body_style' => 'arabic', 'back_style' => 'arabic', 'body_start' => 1, 'continue_back' => true,
                'hide_on_chapter_opening' => false, 'hide_on_blank' => true, 'font' => $font, 'size_pt' => 11,
            ],
            'figures' => [
                'align' => 'center', 'max_width_percent' => 100, 'space_before_pt' => 6, 'space_after_pt' => 6,
                'border' => false, 'keep_with_caption' => true, 'chart_label' => 'Grafik', 'source_note' => false,
                'caption' => $caption('Gambar', 'below'),
            ],
            'tables' => [
                'border_style' => 'grid', 'font_size_pt' => 11, 'cell_padding_pt' => 5, 'header_bold' => true,
                'header_background' => '#FFFFFF', 'zebra' => false, 'repeat_header' => true, 'align' => 'center',
                'space_before_pt' => 6, 'space_after_pt' => 6,
                'caption' => $caption('Tabel', 'above'),
            ],
            'front_matter' => [
                'order' => ['cover', 'title_page', 'title_verso', 'preface', 'toc', 'list_of_figures', 'list_of_tables'],
                'cover' => ['enabled' => true, 'full_bleed' => true, 'bleed_mm' => 3, 'separate_file' => true],
                'title_page' => [
                    'enabled' => true, 'starts_on' => 'any', 'font' => $font, 'title_size_pt' => 20, 'subtitle_size_pt' => 14,
                    'author_size_pt' => 16, 'align' => 'center', 'top_offset_mm' => 0, 'show_publisher' => true,
                    'publisher_text' => 'TARTILA PRESS',
                ],
                'title_verso' => [
                    'enabled' => true,
                    'text' => "Judul Buku : {judul}\nPenulis : {penulis}\nEditor : {editor}\n\nDiterbitkan oleh :\nTartila Press\nJl. Sumatera Blok A12 No 3 RT 10 RW 5 Kelurahan Sadai Kec. Bengkong,\nKota Batam, Prov. Kepulauan Riau\nEmail : tartilapress@gmail.com\nWebsite : www.tartilapress.com\nISBN : {isbn}\nCetakan Pertama, {bulan_tahun}\n\n© Hak cipta dilindungi undang-undang.\nDilarang keras memperbanyak, memfotokopi, sebagian atau seluruh isi buku tanpa izin tertulis dari penerbit.",
                    'size_pt' => 12, 'vertical' => 'top', 'align' => 'center',
                ],
                'preface' => ['enabled' => true, 'heading' => 'KATA PENGANTAR', 'starts_on' => 'any', 'heading_align' => 'center', 'signature_block' => true, 'signature_align' => 'right'],
                'toc' => ['enabled' => true, 'heading' => 'DAFTAR ISI', 'starts_on' => 'any', 'heading_align' => 'center', 'depth' => 2, 'dot_leader' => true, 'size_pt' => 11, 'indent_mm' => 4, 'bold_chapters' => false, 'line_spacing' => 1.2],
                'list_of_figures' => ['enabled' => true, 'heading' => 'DAFTAR GAMBAR', 'starts_on' => 'any', 'heading_align' => 'center', 'dot_leader' => true, 'size_pt' => 11, 'skip_if_empty' => true],
                'list_of_tables' => ['enabled' => true, 'heading' => 'DAFTAR TABEL', 'starts_on' => 'any', 'heading_align' => 'center', 'dot_leader' => true, 'size_pt' => 11, 'skip_if_empty' => true],
            ],
            'body' => [
                'start_on' => 'any', 'columns' => '1', 'column_gap_mm' => 6,
                'chapter_opening' => ['blank_verso' => false, 'rule_under_title' => false, 'epigraph' => false],
                'block_quote' => ['indent_mm' => 10, 'size_pt' => 10, 'italic' => false],
                'list' => ['indent_mm' => 6.5, 'space_pt' => 2],
                'footnote' => ['size_pt' => 9],
            ],
            'back_matter' => [
                'order' => ['bibliography', 'appendix', 'glossary', 'index', 'author_bio'],
                'bibliography' => ['enabled' => true, 'heading' => 'DAFTAR PUSTAKA', 'starts_on' => 'any', 'heading_align' => 'center', 'style' => 'ieee', 'sort' => 'citation', 'hanging_indent_mm' => 0, 'size_pt' => 11, 'line_spacing' => 1, 'entry_space_pt' => 6, 'alignment' => 'left'],
                'appendix' => ['enabled' => true, 'heading' => 'LAMPIRAN', 'starts_on' => 'any', 'heading_align' => 'center', 'numbering' => 'number', 'each_new_page' => true, 'size_pt' => 11],
                'glossary' => ['enabled' => false, 'heading' => 'GLOSARI', 'starts_on' => 'any', 'heading_align' => 'center'],
                'index' => ['enabled' => false, 'heading' => 'INDEKS', 'starts_on' => 'any', 'heading_align' => 'center'],
                'author_bio' => ['enabled' => true, 'heading' => 'BIODATA PENULIS', 'starts_on' => 'any', 'heading_align' => 'center', 'show_photo' => true, 'photo_position' => 'top', 'photo_width_mm' => 30, 'each_author' => true, 'size_pt' => 11, 'alignment' => 'justify'],
            ],
        ];
    }
}
