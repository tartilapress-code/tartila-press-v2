<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Role;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherGrant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WalletTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roleNames = ['user']): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function makeOrder(User $user, array $overrides = []): Order
    {
        return Order::create(array_merge([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $user->id,
            'status' => 'confirmed',
            'subtotal' => 1,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 1,
        ], $overrides));
    }

    private function makeBookWithAuthor(User $author): Book
    {
        $manuscript = Manuscript::create([
            'order_id' => $this->makeOrder($author)->id,
            'user_id' => $author->id,
            'title' => 'Naskah '.uniqid(),
            'authors' => [$author->name],
            'status' => 'completed',
        ]);

        return Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $author->id,
        ]);
    }

    /** Penjualan selesai atas $book: royalti penulis 25% x harga. */
    private function sell(Book $book, array $orderOverrides = []): Order
    {
        $order = $this->makeOrder($this->makeUser(), array_merge(['status' => 'completed'], $orderOverrides));

        OrderItem::create([
            'order_id' => $order->id,
            'itemable_type' => Book::class,
            'itemable_id' => $book->id,
            'name' => $book->title,
            'quantity' => 2,
            'unit_price' => 100000,
            'subtotal' => 200000,
        ]);

        return $order;
    }

    private function wallet(User $user)
    {
        Sanctum::actingAs($user);

        return $this->getJson('/api/v1/wallet')->assertOk();
    }

    public function test_wallet_sums_royalty_editor_fee_and_sales_fee_into_the_balance(): void
    {
        $user = $this->makeUser(['penulis', 'editor']);
        $book = $this->makeBookWithAuthor($user);
        $this->sell($book); // 2 x 100.000 x 25% = 50.000

        Manuscript::create([
            'order_id' => $this->makeOrder($this->makeUser())->id,
            'user_id' => $this->makeUser()->id,
            'title' => 'Naskah Diedit',
            'authors' => ['X'],
            'status' => 'completed',
            'editor_id' => $user->id,
            'editor_fee' => 300000,
        ]);

        $grant = VoucherGrant::create([
            'user_id' => $user->id,
            'targets' => [['type' => 'all', 'id' => null]],
            'pool_percent' => 30,
            'max_vouchers' => 1,
            'period_days' => 30,
            'starts_at' => now()->subDay(),
            'is_active' => true,
        ]);
        $voucher = Voucher::create([
            'code' => 'FEEKU',
            'source' => Voucher::SOURCE_GRANT,
            'user_id' => $user->id,
            'grant_id' => $grant->id,
            'targets' => [['type' => 'all', 'id' => null]],
            'discount_percent' => 10,
            'fee_percent' => 20,
            'is_active' => true,
        ]);
        $this->makeOrder($this->makeUser(), [
            'status' => 'completed',
            'voucher_id' => $voucher->id,
            'voucher_code' => 'FEEKU',
            'voucher_fee' => 200000,
        ]);
        // Pesanan voucher yang belum selesai tidak dihitung.
        $this->makeOrder($this->makeUser(), [
            'status' => 'pending',
            'voucher_id' => $voucher->id,
            'voucher_code' => 'FEEKU',
            'voucher_fee' => 999999,
        ]);

        $response = $this->wallet($user);

        $response->assertJsonPath('data.summary.by_type.royalty', 50000)
            ->assertJsonPath('data.summary.by_type.editor_fee', 300000)
            ->assertJsonPath('data.summary.by_type.sales_fee', 200000)
            ->assertJsonPath('data.summary.earned', 550000)
            ->assertJsonPath('data.summary.balance', 550000)
            ->assertJsonCount(3, 'data.entries');

        $first = $response->json('data.entries.0');
        $this->assertNotNull($first['date']);
        $this->assertArrayHasKey('title', $first);
        $this->assertArrayHasKey('detail', $first);
    }

    public function test_unfinished_sales_do_not_count_and_user_without_earnings_has_empty_wallet(): void
    {
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author);
        $this->sell($book, ['status' => 'pending']);

        $this->wallet($author)
            ->assertJsonPath('data.summary.balance', 0)
            ->assertJsonCount(0, 'data.entries');
    }

    public function test_withdrawal_deducts_the_balance_and_charges_the_admin_fee(): void
    {
        $author = $this->makeUser(['penulis']);
        $this->sell($this->makeBookWithAuthor($author)); // 50.000

        Sanctum::actingAs($author);

        $this->postJson('/api/v1/wallet/withdrawals', [
            'amount' => 30000,
            'bank_name' => 'BNI',
            'account_number' => '1234567890',
            'account_name' => 'Penulis Uji',
        ])
            ->assertCreated()
            ->assertJsonPath('data.admin_fee', '5000.00')
            ->assertJsonPath('data.net_amount', '25000.00')
            ->assertJsonPath('data.status', 'pending');

        $this->getJson('/api/v1/wallet')
            ->assertJsonPath('data.summary.earned', 50000)
            ->assertJsonPath('data.summary.pending', 30000)
            ->assertJsonPath('data.summary.balance', 20000)
            ->assertJsonCount(1, 'data.withdrawals');
    }

    public function test_withdrawal_validation_and_balance_limit(): void
    {
        $author = $this->makeUser(['penulis']);
        $this->sell($this->makeBookWithAuthor($author)); // 50.000

        Sanctum::actingAs($author);

        $payload = ['bank_name' => 'BNI', 'account_number' => '1234567890', 'account_name' => 'X'];

        $this->postJson('/api/v1/wallet/withdrawals', $payload + ['amount' => 5000])->assertStatus(422);
        $this->postJson('/api/v1/wallet/withdrawals', $payload + ['amount' => 60000])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Saldo tidak cukup untuk penarikan ini.');
        $this->postJson('/api/v1/wallet/withdrawals', ['amount' => 20000, 'bank_name' => 'BNI', 'account_number' => 'abc', 'account_name' => 'X'])
            ->assertStatus(422);

        // Dua permintaan berturut-turut tidak boleh melewati saldo.
        $this->postJson('/api/v1/wallet/withdrawals', $payload + ['amount' => 40000])->assertCreated();
        $this->postJson('/api/v1/wallet/withdrawals', $payload + ['amount' => 40000])->assertStatus(422);
    }

    public function test_admin_pays_or_rejects_and_rejection_returns_the_funds(): void
    {
        $author = $this->makeUser(['penulis']);
        $this->sell($this->makeBookWithAuthor($author));
        $admin = $this->makeUser(['admin']);

        Sanctum::actingAs($author);
        $payload = ['bank_name' => 'BNI', 'account_number' => '1234567890', 'account_name' => 'X'];
        $first = $this->postJson('/api/v1/wallet/withdrawals', $payload + ['amount' => 20000])->json('data.id');
        $second = $this->postJson('/api/v1/wallet/withdrawals', $payload + ['amount' => 20000])->json('data.id');

        Sanctum::actingAs($author);
        $this->postJson("/api/v1/admin/withdrawals/{$first}/pay")->assertForbidden();

        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/withdrawals')->assertOk()->assertJsonCount(2, 'data');
        $this->postJson("/api/v1/admin/withdrawals/{$first}/pay", ['admin_note' => 'Transfer selesai'])
            ->assertOk()->assertJsonPath('data.status', 'paid');
        $this->postJson("/api/v1/admin/withdrawals/{$second}/reject", ['admin_note' => 'Rekening salah'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->postJson("/api/v1/admin/withdrawals/{$second}/pay")->assertStatus(422);

        // 50.000 - 20.000 yang sudah dibayar; yang ditolak kembali.
        $this->wallet($author)
            ->assertJsonPath('data.summary.withdrawn', 20000)
            ->assertJsonPath('data.summary.pending', 0)
            ->assertJsonPath('data.summary.balance', 30000);
    }

    public function test_voucher_deduction_lowers_the_royalty_entry(): void
    {
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author);
        $voucher = Voucher::create([
            'code' => 'ROYALKU',
            'source' => Voucher::SOURCE_ROYALTY,
            'user_id' => $author->id,
            'targets' => [['type' => 'book', 'id' => $book->id]],
            'discount_percent' => 10,
            'is_active' => true,
        ]);
        $order = $this->sell($book, ['voucher_id' => $voucher->id, 'voucher_code' => 'ROYALKU']);
        $order->items()->update(['voucher_discount' => 20000]);

        // 50.000 - 20.000
        $this->wallet($author)->assertJsonPath('data.summary.by_type.royalty', 30000);
    }
}
