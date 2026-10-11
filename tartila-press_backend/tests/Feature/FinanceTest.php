<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapterSetting;
use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\FinanceSetting;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Package;
use App\Models\PaymentMethod;
use App\Models\Role;
use App\Models\User;
use App\Models\WalletWithdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $buyer;

    private PaymentMethod $bni;

    private PaymentMethod $bri;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
        $this->buyer = $this->makeUser(['penulis'], 'Pembeli');
        $this->bni = PaymentMethod::create(['bank_name' => 'BNI', 'account_number' => '111', 'account_holder_name' => 'Tartila', 'is_active' => true, 'opening_balance' => 1000000]);
        $this->bri = PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '222', 'account_holder_name' => 'Tartila', 'is_active' => true]);

        BookChapterSetting::current()->update(['hki_cost' => 300000]);
        FinanceSetting::current()->update(['admin_cover_cost' => 50000, 'print_cost_percent' => 20, 'base_print_copies' => 3, 'default_book_price' => 50000, 'hki_cost' => 300000]);
    }

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name, 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /** Pesanan yang sudah dibayar (status confirmed/completed) tanggal $paidAt. */
    private function paidOrder(array $items, array $attributes, string $paidAt, ?PaymentMethod $account = null, string $status = 'confirmed'): Order
    {
        $order = Order::create($attributes + [
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $this->buyer->id,
            'status' => $status,
            'discount_total' => 0,
            'editor_fee' => 0,
            'payment_method_id' => $account?->id,
        ]);

        foreach ($items as $item) {
            $order->items()->create($item);
        }

        Carbon::setTestNow($paidAt);
        $order->logStatusHistory('payment_confirmed');
        Carbon::setTestNow();

        return $order;
    }

    private function packageOrder(string $paidAt, ?PaymentMethod $account, string $status = 'confirmed'): Order
    {
        $package = Package::create(['name' => 'Paket Lengkap', 'price' => 1000000, 'discount' => 10, 'facilities' => ['ISBN', 'HKI', 'Cover'], 'services' => ['Editing'], 'free_copies' => 2, 'created_by' => $this->admin->id]);

        return $this->paidOrder(
            [['itemable_type' => Package::class, 'itemable_id' => $package->id, 'name' => 'Paket Lengkap', 'quantity' => 1, 'unit_price' => 1000000, 'subtotal' => 1000000, 'discount' => 100000]],
            ['subtotal' => 1000000, 'discount_total' => 100000, 'total' => 900000],
            $paidAt,
            $account,
            $status
        );
    }

    public function test_finance_endpoints_are_admin_only_and_balances_stay_private(): void
    {
        $this->getJson('/api/v1/admin/finance/summary')->assertUnauthorized();

        Sanctum::actingAs($this->buyer);
        foreach (['summary', 'transactions', 'packages', 'books', 'ebooks', 'events', 'settings'] as $path) {
            $this->getJson("/api/v1/admin/finance/{$path}")->assertForbidden();
        }

        $this->postJson('/api/v1/admin/finance/transactions', [])->assertForbidden();

        // Daftar rekening untuk pembeli tidak memuat saldo.
        $this->getJson('/api/v1/payment-methods')->assertOk()->assertJsonMissingPath('data.0.opening_balance');
    }

    public function test_cash_flow_statuses_filters_and_account_balances(): void
    {
        $this->packageOrder('2026-03-05 10:00:00', $this->bni);                    // hold, BNI, 900.000
        $this->packageOrder('2026-03-20 10:00:00', $this->bri, 'completed');       // selesai, BRI, 900.000
        $this->packageOrder('2026-04-02 10:00:00', null);                          // hold, tanpa rekening
        $this->paidOrder([], ['subtotal' => 5, 'total' => 5], '2026-03-01', $this->bni, 'pending'); // belum bayar: tidak dihitung

        WalletWithdrawal::create(['user_id' => $this->buyer->id, 'amount' => 105000, 'admin_fee' => 5000, 'net_amount' => 100000, 'bank_name' => 'BSI', 'account_number' => '9', 'account_name' => 'X', 'status' => 'paid', 'processed_at' => '2026-03-25 09:00:00', 'payment_method_id' => $this->bni->id]);
        WalletWithdrawal::create(['user_id' => $this->buyer->id, 'amount' => 50000, 'admin_fee' => 5000, 'net_amount' => 45000, 'bank_name' => 'BSI', 'account_number' => '9', 'account_name' => 'X', 'status' => 'pending']);

        Sanctum::actingAs($this->admin);
        $this->postJson('/api/v1/admin/finance/transactions', [
            'transaction_date' => '2026-03-28', 'direction' => 'out', 'category' => 'printing',
            'payment_method_id' => $this->bri->id, 'amount' => 200000, 'status' => 'completed', 'description' => 'Cetak buku Maret',
        ])->assertCreated();

        $all = $this->getJson('/api/v1/admin/finance/transactions')->assertOk();
        $all->assertJsonPath('data.totals.in', 2700000)
            ->assertJsonPath('data.totals.out', 300000)
            ->assertJsonPath('data.totals.net', 2400000)
            ->assertJsonPath('data.totals.hold', 1800000)
            ->assertJsonPath('data.totals.count', 5);

        $march = $this->getJson('/api/v1/admin/finance/transactions?from=2026-03-01&to=2026-03-31&direction=in')->json('data');
        $this->assertSame(2, $march['totals']['count']);
        $this->assertSame(['hold', 'completed'], array_column(array_reverse($march['items']), 'status'));
        $this->assertSame(1, $this->getJson('/api/v1/admin/finance/transactions?account=none')->json('data.totals.count'));
        $this->assertSame('package', $this->getJson('/api/v1/admin/finance/transactions?type=package&status=completed')->json('data.items.0.type'));

        // Saldo: BNI 1.000.000 + 900.000 − 100.000; BRI 900.000 − 200.000; sisanya belum ditentukan.
        $summary = $this->getJson('/api/v1/admin/finance/summary?year=2026&month=3')->assertOk()->json('data');
        $balances = collect($summary['balances']['accounts'])->keyBy('bank_name');
        $this->assertEquals(1800000, $balances['BNI']['balance']);
        $this->assertEquals(700000, $balances['BRI']['balance']);
        $this->assertEquals(900000, $summary['balances']['unassigned']['balance']);
        $this->assertEquals(3400000, $summary['balances']['total']);

        // Omzet: harian Maret, bulanan 2026, tahunan.
        $this->assertEquals(900000, $summary['revenue']['daily'][4]['amount']);
        $this->assertEquals(1800000, $summary['revenue']['monthly'][2]['amount']);
        $this->assertEquals(900000, $summary['revenue']['monthly'][3]['amount']);
        $this->assertEquals(2700000, collect($summary['revenue']['yearly'])->firstWhere('label', '2026')['amount']);
        $this->assertEquals(1800000, $summary['month_totals']['in']);

        // Pesanan tanpa rekening bisa ditentukan rekeningnya.
        $loose = Order::whereNull('payment_method_id')->where('status', 'confirmed')->firstOrFail();
        $this->patchJson("/api/v1/admin/finance/accounts/order/{$loose->id}", ['payment_method_id' => $this->bri->id])->assertOk();
        $this->assertEquals(0, $this->getJson('/api/v1/admin/finance/summary')->json('data.balances.unassigned.balance'));
    }

    public function test_dates_follow_jakarta_time_not_utc(): void
    {
        // 4 Maret 20:00 UTC = 5 Maret 03:00 WIB → omzet tanggal 5.
        $this->packageOrder('2026-03-04 20:00:00', $this->bni);

        Sanctum::actingAs($this->admin);
        $daily = $this->getJson('/api/v1/admin/finance/summary?year=2026&month=3')->json('data.revenue.daily');
        $this->assertEquals(0, $daily[3]['amount']);
        $this->assertEquals(900000, $daily[4]['amount']);

        $this->assertSame(1, $this->getJson('/api/v1/admin/finance/transactions?from=2026-03-05&to=2026-03-05')->json('data.totals.count'));
        $this->assertSame(0, $this->getJson('/api/v1/admin/finance/transactions?from=2026-03-04&to=2026-03-04')->json('data.totals.count'));
    }

    public function test_package_profit_estimate_and_admin_overrides(): void
    {
        $order = $this->packageOrder('2026-03-05', $this->bni);
        Sanctum::actingAs($this->admin);

        // 1.000.000 − diskon 100.000 − HAKI 300.000 − cetak 20% × 50.000 × (3 + 2) − adm & cover 50.000.
        $row = $this->getJson('/api/v1/admin/finance/packages')->assertOk()->json('data.packages.0');
        $this->assertEquals(1000000, $row['price']);
        $this->assertEquals(100000, $row['discount']);
        $this->assertTrue($row['includes_hki']);
        $this->assertEquals(300000, $row['hki']);
        $this->assertSame(['base' => 3, 'extra' => 2, 'extra_auto' => 2], $row['copies']);
        $this->assertSame('default', $row['book_price_source']);
        $this->assertEquals(50000, $row['print_cost']);
        $this->assertEquals(50000, $row['admin_cover']);
        $this->assertEquals(500000, $row['profit']);

        // Admin: harga jual 80.000, tanpa eks tambahan, tanpa HAKI, biaya lain 25.000.
        $this->putJson('/api/v1/admin/finance/details', [
            'subject_type' => 'order', 'subject_id' => $order->id, 'book_price' => 80000,
            'extra_copies' => 0, 'includes_hki' => false, 'other_costs' => 25000,
        ])->assertOk();

        $row = $this->getJson('/api/v1/admin/finance/packages')->json('data.packages.0');
        $this->assertSame('admin', $row['book_price_source']);
        $this->assertEquals(48000, $row['print_cost']);
        $this->assertEquals(0, $row['hki']);
        $this->assertEquals(777000, $row['profit']);

        // Fee editor naskah (total yang dibayar penerbit) ikut mengurangi laba.
        Manuscript::create(['order_id' => $order->id, 'user_id' => $this->buyer->id, 'title' => 'N', 'authors' => ['P'], 'status' => 'in_editing', 'editor_fee' => 150000]);
        $this->assertEquals(627000, $this->getJson('/api/v1/admin/finance/packages')->json('data.packages.0.profit'));

        // Pengaturan berlaku untuk perhitungan baru.
        $this->putJson('/api/v1/admin/finance/settings', ['admin_cover_cost' => 75000, 'print_cost_percent' => 20, 'base_print_copies' => 3, 'default_book_price' => 50000, 'hki_cost' => 300000])->assertOk();
        $this->assertEquals(75000, $this->getJson('/api/v1/admin/finance/packages')->json('data.packages.0.admin_cover'));
    }

    public function test_book_sales_profit_with_print_cost_and_royalty(): void
    {
        $author = $this->makeUser(['penulis'], 'Penulis');
        $source = $this->paidOrder([], ['subtotal' => 1, 'total' => 1], '2026-01-01', null, 'completed');
        $manuscript = Manuscript::create(['order_id' => $source->id, 'user_id' => $author->id, 'title' => 'Buku', 'authors' => ['Penulis'], 'status' => 'completed']);
        $manuscript->authorLinks()->create(['user_id' => $author->id, 'position' => 1]);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Sistem Tertanam', 'price' => 100000, 'discount' => 10, 'created_by' => $this->admin->id]);

        foreach (['completed', 'confirmed'] as $status) {
            $this->paidOrder(
                [['itemable_type' => Book::class, 'itemable_id' => $book->id, 'name' => $book->title, 'quantity' => 1, 'unit_price' => 100000, 'subtotal' => 100000, 'discount' => 10000]],
                ['subtotal' => 100000, 'discount_total' => 10000, 'total' => 90000],
                '2026-03-10',
                $this->bni,
                $status
            );
        }

        Sanctum::actingAs($this->admin);
        $row = collect($this->getJson('/api/v1/admin/finance/books')->assertOk()->json('data'))->firstWhere('id', $book->id);

        // 2 × (100.000 − diskon 10.000 − cetak 20.000 − royalti 25%).
        $this->assertSame(2, $row['quantity']);
        $this->assertEquals(200000, $row['price']);
        $this->assertEquals(20000, $row['discount']);
        $this->assertEquals(40000, $row['print_cost']);
        $this->assertEquals(25, $row['royalty_rate']);
        $this->assertEquals(50000, $row['royalty']);
        $this->assertEquals(90000, $row['profit']);
        $this->assertSame('hold', $row['status']);
    }

    public function test_event_registration_profit_uses_admin_costs(): void
    {
        $event = Event::create(['title' => 'Webinar Uji', 'description' => 'x', 'starts_at' => '2026-03-01 09:00', 'ends_at' => '2026-03-01 12:00', 'fee' => 50000, 'is_active' => false, 'created_by' => $this->admin->id]);

        foreach (range(1, 2) as $i) {
            $order = $this->paidOrder(
                [['itemable_type' => Event::class, 'itemable_id' => $event->id, 'name' => $event->title, 'quantity' => 1, 'unit_price' => 50000, 'subtotal' => 50000, 'discount' => 0]],
                ['subtotal' => 50000, 'total' => 50000],
                '2026-02-20',
                $this->bni
            );
            EventRegistration::create(['event_id' => $event->id, 'user_id' => $this->makeUser(['user'], "Peserta $i")->id, 'order_id' => $order->id, 'status' => 'confirmed']);
        }

        Sanctum::actingAs($this->admin);
        $this->putJson('/api/v1/admin/finance/details', ['subject_type' => 'event', 'subject_id' => $event->id, 'speaker_fee' => 30000, 'other_costs' => 10000])->assertOk();
        $this->putJson('/api/v1/admin/finance/details', ['subject_type' => 'event', 'subject_id' => 99999, 'speaker_fee' => 1])->assertNotFound();

        $row = $this->getJson('/api/v1/admin/finance/events')->assertOk()->json('data.0');
        $this->assertSame(2, $row['participants']);
        $this->assertEquals(100000, $row['price']);
        $this->assertEquals(30000, $row['speaker_fee']);
        $this->assertEquals(60000, $row['profit']);
        $this->assertSame('completed', $row['status']);
    }

    public function test_payment_verification_and_withdrawal_record_the_account(): void
    {
        Storage::fake('public');
        $order = Order::create(['order_number' => 'ORD-V', 'user_id' => $this->buyer->id, 'status' => 'pending', 'subtotal' => 10, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 10, 'payment_proof_file' => 'x.png']);
        $withdrawal = WalletWithdrawal::create(['user_id' => $this->buyer->id, 'amount' => 100000, 'admin_fee' => 5000, 'net_amount' => 95000, 'bank_name' => 'BSI', 'account_number' => '9', 'account_name' => 'X', 'status' => 'pending']);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", ['decision' => 'approve', 'payment_method_id' => $this->bri->id])->assertOk();
        $this->assertSame($this->bri->id, $order->fresh()->payment_method_id);

        $this->postJson("/api/v1/admin/withdrawals/{$withdrawal->id}/pay", ['payment_method_id' => $this->bni->id])->assertOk();
        $this->assertSame($this->bni->id, $withdrawal->fresh()->payment_method_id);

        // Satu-satunya rekening aktif dipakai otomatis.
        $this->bri->update(['is_active' => false]);
        $other = Order::create(['order_number' => 'ORD-W', 'user_id' => $this->buyer->id, 'status' => 'pending', 'subtotal' => 10, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 10, 'payment_proof_file' => UploadedFile::fake()->create('b.png')->hashName()]);
        $this->postJson("/api/v1/admin/orders/{$other->id}/verify-payment", ['decision' => 'approve'])->assertOk();
        $this->assertSame($this->bni->id, $other->fresh()->payment_method_id);
    }
}
