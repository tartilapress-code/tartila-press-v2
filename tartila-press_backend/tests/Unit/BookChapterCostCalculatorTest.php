<?php

namespace Tests\Unit;

use App\Models\BookChapterSetting;
use App\Services\BookChapterCostCalculator;
use Tests\TestCase;

/**
 * Rumus biaya & fee proyek Book Chapter (tanpa database).
 */
class BookChapterCostCalculatorTest extends TestCase
{
    private function settings(array $overrides = []): BookChapterSetting
    {
        return new BookChapterSetting(array_merge([
            'max_discount' => 10,
            'hki_cost' => 300000,
            'isbn_print_cost' => 300000,
            'isbn_electronic_cost' => 200000,
            'min_book_cost' => 500000,
        ], $overrides));
    }

    /**
     * @param  array<int, array<string, mixed>>  $chapters
     */
    private function input(int $price, int $chapterCount, array $extra = [], array $chapters = []): array
    {
        return array_merge([
            'price' => $price,
            'discount' => 0,
            'chapters' => $chapters ?: array_fill(0, $chapterCount, ['price' => null, 'discount' => null]),
            'includes_hki' => false,
            'includes_isbn_print' => false,
            'includes_isbn_electronic' => false,
            'item_costs' => [],
        ], $extra);
    }

    public function test_remaining_cost_is_chapter_total_minus_hki_isbn_and_item_costs(): void
    {
        $result = (new BookChapterCostCalculator)->calculate($this->input(200000, 8, [
            'includes_hki' => true,
            'includes_isbn_print' => true,
            'includes_isbn_electronic' => true,
            'item_costs' => [100000, null],
        ]), $this->settings());

        $this->assertSame(1600000.0, $result['chapters_total']);
        $this->assertSame(300000.0, $result['deductions']['hki']);
        $this->assertSame(300000.0, $result['deductions']['isbn_print']);
        $this->assertSame(200000.0, $result['deductions']['isbn_electronic']);
        $this->assertSame(100000.0, $result['deductions']['items']);
        $this->assertSame(900000.0, $result['deductions']['total']);
        $this->assertSame(700000.0, $result['net']);
        $this->assertTrue($result['meets_minimum']);
        $this->assertSame(0.0, $result['shortfall']);
    }

    public function test_it_reports_the_shortfall_when_the_remaining_cost_is_below_the_minimum(): void
    {
        $result = (new BookChapterCostCalculator)->calculate($this->input(200000, 4, [
            'includes_hki' => true,
            'includes_isbn_print' => true,
            'includes_isbn_electronic' => true,
        ]), $this->settings());

        // 800.000 − (300.000 + 300.000 + 200.000) = 0, minimal 500.000
        $this->assertSame(0.0, $result['net']);
        $this->assertFalse($result['meets_minimum']);
        $this->assertSame(500000.0, $result['shortfall']);
    }

    public function test_exactly_the_minimum_is_enough(): void
    {
        $result = (new BookChapterCostCalculator)->calculate(
            $this->input(250000, 2),
            $this->settings()
        );

        $this->assertSame(500000.0, $result['net']);
        $this->assertTrue($result['meets_minimum']);
    }

    public function test_print_isbn_and_electronic_isbn_have_different_costs(): void
    {
        $calculator = new BookChapterCostCalculator;

        $print = $calculator->calculate($this->input(200000, 8, ['includes_isbn_print' => true]), $this->settings());
        $electronic = $calculator->calculate($this->input(200000, 8, ['includes_isbn_electronic' => true]), $this->settings());
        $both = $calculator->calculate($this->input(200000, 8, [
            'includes_isbn_print' => true,
            'includes_isbn_electronic' => true,
        ]), $this->settings());

        $this->assertSame(300000.0, $print['deductions']['total']);
        $this->assertSame(200000.0, $electronic['deductions']['total']);
        $this->assertSame(500000.0, $both['deductions']['total']);
    }

    public function test_unticked_options_cost_nothing(): void
    {
        $result = (new BookChapterCostCalculator)->calculate($this->input(200000, 8), $this->settings());

        $this->assertSame(0.0, $result['deductions']['total']);
        $this->assertSame(1600000.0, $result['net']);
    }

    public function test_a_blank_item_cost_means_free(): void
    {
        $result = (new BookChapterCostCalculator)->calculate(
            $this->input(200000, 8, ['item_costs' => [null, null]]),
            $this->settings()
        );

        $this->assertSame(0.0, $result['deductions']['items']);
    }

    public function test_discount_does_not_change_the_minimum_cost_check(): void
    {
        $calculator = new BookChapterCostCalculator;

        $noDiscount = $calculator->calculate($this->input(200000, 4, ['discount' => 0]), $this->settings());
        $withDiscount = $calculator->calculate($this->input(200000, 4, ['discount' => 10]), $this->settings());

        $this->assertSame($noDiscount['net'], $withDiscount['net']);
        $this->assertSame($noDiscount['meets_minimum'], $withDiscount['meets_minimum']);
        $this->assertSame($noDiscount['shortfall'], $withDiscount['shortfall']);
    }

    public function test_editor_fee_is_the_max_discount_minus_the_discount_given(): void
    {
        $result = (new BookChapterCostCalculator)->calculate(
            $this->input(200000, 8, ['discount' => 4]),
            $this->settings(['max_discount' => 10])
        );

        // (10% − 4%) = 6% dari Rp 200.000 = Rp 12.000 per bab × 8 bab
        $this->assertSame(10, $result['max_discount']);
        $this->assertSame(6, $result['fee_percent']);
        $this->assertSame(96000.0, $result['potential_fee']);
    }

    public function test_no_discount_means_the_full_max_discount_is_the_fee(): void
    {
        $result = (new BookChapterCostCalculator)->calculate(
            $this->input(200000, 8, ['discount' => 0]),
            $this->settings(['max_discount' => 10])
        );

        $this->assertSame(10, $result['fee_percent']);
        $this->assertSame(160000.0, $result['potential_fee']);
    }

    public function test_a_chapter_with_its_own_price_and_discount_uses_them_for_the_fee(): void
    {
        $result = (new BookChapterCostCalculator)->calculate($this->input(200000, 0, ['discount' => 4], [
            'a' => ['price' => null, 'discount' => null],       // 200.000 @ 4%  → 6%  = 12.000
            'b' => ['price' => 300000, 'discount' => 0],        // 300.000 @ 0%  → 10% = 30.000
            'c' => ['price' => 100000, 'discount' => 10],       // 100.000 @ 10% → 0%  = 0
        ]), $this->settings(['max_discount' => 10]));

        $this->assertSame(600000.0, $result['chapters_total']);
        $this->assertSame(['a' => 12000.0, 'b' => 30000.0, 'c' => 0.0], $result['chapter_fees']);
        $this->assertSame(42000.0, $result['potential_fee']);
    }

    public function test_fee_never_goes_negative_when_the_discount_exceeds_the_max(): void
    {
        $result = (new BookChapterCostCalculator)->calculate(
            $this->input(200000, 8, ['discount' => 30]),
            $this->settings(['max_discount' => 10])
        );

        $this->assertSame(0, $result['fee_percent']);
        $this->assertSame(0.0, $result['potential_fee']);
    }

    public function test_without_a_configured_minimum_the_costs_still_have_to_be_covered(): void
    {
        $settings = $this->settings(['min_book_cost' => 0]);
        $calculator = new BookChapterCostCalculator;

        $covered = $calculator->calculate($this->input(200000, 2, ['includes_hki' => true]), $settings);
        $notCovered = $calculator->calculate($this->input(100000, 2, ['includes_hki' => true]), $settings);

        $this->assertTrue($covered['meets_minimum']);
        $this->assertFalse($notCovered['meets_minimum']);
        $this->assertSame(100000.0, $notCovered['shortfall']);
    }

    public function test_fractional_prices_are_rounded_to_cents(): void
    {
        $result = (new BookChapterCostCalculator)->calculate(
            $this->input(33333, 3, ['discount' => 3]),
            $this->settings(['max_discount' => 10])
        );

        // 33.333 × 7% = 2.333,31 per bab
        $this->assertSame(99999.0, $result['chapters_total']);
        $this->assertSame(6999.93, $result['potential_fee']);
    }
}
