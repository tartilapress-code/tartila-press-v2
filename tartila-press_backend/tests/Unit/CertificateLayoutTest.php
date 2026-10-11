<?php

namespace Tests\Unit;

use App\Support\Certificates\CertificateRenderer;
use App\Support\Certificates\CertificateVariables;
use App\Support\Certificates\TemplateFields;
use App\Support\Certificates\TextLayout;
use Carbon\Carbon;
use Tests\TestCase;

class CertificateLayoutTest extends TestCase
{
    /**
     * Pengukur palsu: tiap karakter selebar 0,5 em, jadi pada ukuran 10pt
     * "abcd" selebar 20pt.
     */
    private function measure(): callable
    {
        return fn (string $text): float => mb_strlen($text) * 0.5;
    }

    public function test_wrap_breaks_lines_at_the_box_width(): void
    {
        // 10pt, kotak 60pt => maksimal 12 karakter per baris.
        $lines = TextLayout::wrap($this->measure(), 'satu dua tiga empat lima', 10, 60);

        $this->assertSame(['satu dua', 'tiga empat', 'lima'], $lines);
        foreach ($lines as $line) {
            $this->assertLessThanOrEqual(60, mb_strlen($line) * 0.5 * 10);
        }
    }

    public function test_wrap_keeps_explicit_newlines_and_drops_trailing_blank_lines(): void
    {
        $lines = TextLayout::wrap($this->measure(), "baris satu\n\nbaris tiga\n\n", 10, 1000);

        $this->assertSame(['baris satu', '', 'baris tiga'], $lines);
    }

    public function test_wrap_puts_a_word_longer_than_the_box_on_its_own_line(): void
    {
        $lines = TextLayout::wrap($this->measure(), 'a superkalifragilistik b', 10, 40);

        $this->assertSame(['a', 'superkalifragilistik', 'b'], $lines);
    }

    public function test_fit_without_auto_fit_keeps_the_requested_size(): void
    {
        $layout = TextLayout::fit($this->measure(), 'satu dua tiga empat lima enam tujuh', 100, 10, 20, false);

        $this->assertSame(20.0, $layout['size']);
        $this->assertSame(20 * 1.25, $layout['line_height']);
    }

    public function test_fit_with_auto_fit_shrinks_until_the_text_fits_the_box(): void
    {
        // 30 karakter di ukuran 20pt = 300pt, kotak hanya 150pt x 30pt (1 baris).
        $layout = TextLayout::fit($this->measure(), str_repeat('x', 30), 150, 30, 20, true);

        $this->assertLessThan(20, $layout['size']);
        $this->assertCount(1, $layout['lines']);
        $this->assertLessThanOrEqual(150.01, 30 * 0.5 * $layout['size']);
    }

    public function test_fit_never_shrinks_below_the_minimum_size(): void
    {
        $layout = TextLayout::fit($this->measure(), str_repeat('x', 500), 50, 10, 20, true);

        $this->assertSame(20 * (float) config('certificates.min_font_size_ratio'), $layout['size']);
    }

    public function test_place_centers_a_line_and_puts_the_baseline_by_the_font_metrics(): void
    {
        $layout = ['size' => 10.0, 'lines' => ['abcd'], 'line_height' => 12.5];

        [$line] = TextLayout::place($this->measure(), $layout, 100, 200, 100, 50, 'center', 'middle', 0.9, 0.3);

        // lebar 20pt di kotak 100pt => mulai di 100 + 40.
        $this->assertEqualsWithDelta(140.0, $line['x'], 0.0001);
        // blok 12,5pt di kotak 50pt => atas 200 + 18,75; garis dasar =
        // atas + (12,5 - 1,2*10)/2 + 0,9*10 = 218,75 + 0,25 + 9.
        $this->assertEqualsWithDelta(228.0, $line['y'], 0.0001);
    }

    public function test_place_aligns_left_right_and_vertically_top_bottom(): void
    {
        $layout = ['size' => 10.0, 'lines' => ['abcd'], 'line_height' => 12.5];

        [$left] = TextLayout::place($this->measure(), $layout, 100, 200, 100, 50, 'left', 'top', 0.9, 0.3);
        [$right] = TextLayout::place($this->measure(), $layout, 100, 200, 100, 50, 'right', 'bottom', 0.9, 0.3);

        $this->assertEqualsWithDelta(100.0, $left['x'], 0.0001);
        $this->assertEqualsWithDelta(200.0 + 0.25 + 9, $left['y'], 0.0001);
        $this->assertEqualsWithDelta(180.0, $right['x'], 0.0001);
        $this->assertEqualsWithDelta(250.0 - 12.5 + 0.25 + 9, $right['y'], 0.0001);
    }

    public function test_page_size_maps_the_longest_side_to_the_configured_length(): void
    {
        $long = (float) config('certificates.page_long_side_pt');

        $this->assertSame([$long, round($long * 1754 / 2480, 2)], CertificateRenderer::pageSize(2480, 1754));
        $this->assertSame([round($long * 1754 / 2480, 2), $long], CertificateRenderer::pageSize(1754, 2480));
        $this->assertSame([$long, $long], CertificateRenderer::pageSize(1000, 1000));
    }

    public function test_fields_are_normalized_and_kept_inside_the_page(): void
    {
        [$field] = TemplateFields::normalize([[
            'id' => 'a',
            'text' => '{name}',
            'x' => 0.9,
            'y' => 0.95,
            'w' => 0.5,
            'h' => 0.2,
            'font' => 'cinzel',
            'size' => '24',
            'color' => '#ABCDEF',
            'align' => 'center',
            'valign' => 'middle',
        ]]);

        $this->assertEqualsWithDelta(0.5, $field['x'], 0.00001);
        $this->assertEqualsWithDelta(0.8, $field['y'], 0.00001);
        $this->assertSame(24.0, $field['size']);
        $this->assertSame('#abcdef', $field['color']);
        $this->assertFalse($field['bold']);
        $this->assertTrue($field['autoFit']);
    }

    public function test_variables_are_replaced_and_unknown_ones_become_empty(): void
    {
        $text = CertificateVariables::apply('{name} - {isbn} - {tidak_ada}!', ['name' => 'Budi', 'isbn' => '978']);

        $this->assertSame('Budi - 978 - !', $text);
    }

    public function test_preview_answers_get_a_sample_for_unknown_answer_tokens(): void
    {
        $values = CertificateVariables::withSampleAnswers(
            [['text' => '{name} dari {answer_institusi}']],
            ['name' => 'Budi']
        );

        $this->assertSame('Contoh jawaban', $values['answer_institusi']);
        $this->assertSame('Budi', $values['name']);
    }

    public function test_event_date_ranges_are_written_in_indonesian_in_local_time(): void
    {
        $range = fn (string $start, ?string $end) => CertificateVariables::dateRange(
            Carbon::parse($start, 'UTC'),
            $end ? Carbon::parse($end, 'UTC') : null
        );

        $this->assertSame('12 Agustus 2026', $range('2026-08-12 03:00:00', null));
        $this->assertSame('12 Agustus 2026', $range('2026-08-12 03:00:00', '2026-08-12 08:00:00'));
        $this->assertSame('12–14 Agustus 2026', $range('2026-08-12 03:00:00', '2026-08-14 03:00:00'));
        $this->assertSame('30 Agustus – 2 September 2026', $range('2026-08-30 03:00:00', '2026-09-02 03:00:00'));
        $this->assertSame('30 Desember 2026 – 2 Januari 2027', $range('2026-12-30 03:00:00', '2027-01-02 03:00:00'));
        // 20:00 UTC = 03:00 WIB keesokan harinya.
        $this->assertSame('13 Agustus 2026', $range('2026-08-12 20:00:00', null));
    }
}
