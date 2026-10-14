<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Reader\ReaderOrder;
use App\Models\User;
use App\Support\OrderNumber;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Format nomor pesanan ORD-YYYYMMDD-NNNK. */
class OrderNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_numbers_have_date_daily_sequence_and_type_code(): void
    {
        Carbon::setTestNow('2026-10-13 03:00:00'); // 10:00 WIB

        $this->assertSame('ORD-20261013-001P', OrderNumber::make(OrderNumber::PACKAGE));

        $user = User::create(['name' => 'Pembeli', 'email' => 'p@example.com', 'password' => 'Tartila@2026']);
        Order::create(['order_number' => 'ORD-20261013-001P', 'user_id' => $user->id, 'status' => 'pending', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);

        // Urutan naik pada hari yang sama, apa pun jenisnya; Tartila Book ikut dihitung.
        $this->assertSame('ORD-20261013-002BC', Order::generateOrderNumber(OrderNumber::BOOK_CHAPTER));
        ReaderOrder::create(['order_number' => 'ORD-20261013-002EB', 'user_id' => $user->id, 'kind' => 'plan', 'title' => 'Bulanan', 'amount' => 1, 'status' => 'pending']);
        $this->assertSame('ORD-20261013-003L', OrderNumber::make(OrderNumber::SUBSCRIPTION));

        // Nomor acak lama tidak mengganggu; hari berikutnya mulai dari 001 lagi.
        Order::create(['order_number' => 'ORD-20261013-AB12CD', 'user_id' => $user->id, 'status' => 'pending', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        $this->assertSame('ORD-20261013-003BF', OrderNumber::make(OrderNumber::PHYSICAL_BOOK));

        Carbon::setTestNow('2026-10-14 03:00:00');
        $this->assertSame('ORD-20261014-001E', OrderNumber::make(OrderNumber::EVENT));

        Carbon::setTestNow();
    }

    public function test_the_date_follows_wib_not_utc(): void
    {
        Carbon::setTestNow('2026-10-13 20:00:00'); // 14 Okt 03:00 WIB

        $this->assertStringStartsWith('ORD-20261014-001', OrderNumber::make(OrderNumber::PACKAGE));

        Carbon::setTestNow();
    }

    public function test_orders_get_the_code_of_their_type(): void
    {
        $this->assertSame('P', OrderNumber::codeForOrderType('package'));
        $this->assertSame('P', OrderNumber::codeForOrderType('custom'));
        $this->assertSame('BC', OrderNumber::codeForOrderType('book_chapter'));
        $this->assertSame('BF', OrderNumber::codeForOrderType('book'));
        $this->assertSame('E', OrderNumber::codeForOrderType('event'));
    }
}
