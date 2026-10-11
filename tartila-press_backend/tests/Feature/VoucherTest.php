<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\CustomPackageItem;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherGrant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VoucherTest extends TestCase
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

    private function makePackage(array $overrides = []): Package
    {
        return Package::create(array_merge([
            'name' => 'Paket '.uniqid(),
            'price' => 1000000,
            'discount' => 0,
            'facilities' => ['E-book'],
            'services' => ['Estimasi'],
            'terms' => ['Orisinal'],
            'is_active' => true,
            'created_by' => $this->makeUser(['admin'])->id,
        ], $overrides));
    }

    private function makeBookWithAuthor(User $author, array $overrides = []): Book
    {
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $author->id,
            'status' => 'confirmed',
            'subtotal' => 1,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 1,
        ]);

        $manuscript = Manuscript::create([
            'order_id' => $order->id,
            'user_id' => $author->id,
            'title' => 'Naskah '.uniqid(),
            'authors' => [$author->name],
            'status' => 'completed',
        ]);

        return Book::create(array_merge([
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $author->id,
        ], $overrides));
    }

    private function makeVoucher(array $overrides = []): Voucher
    {
        return Voucher::create(array_merge([
            'code' => 'HEMAT10',
            'source' => Voucher::SOURCE_ADMIN,
            'targets' => [['type' => 'all', 'id' => null]],
            'discount_percent' => 10,
            'fee_percent' => 0,
            'is_active' => true,
        ], $overrides));
    }

    private function orderPackage(User $buyer, Package $package, ?string $code = null)
    {
        Sanctum::actingAs($buyer);

        return $this->postJson('/api/v1/orders', array_filter([
            'type' => 'package',
            'package_id' => $package->id,
            'voucher_code' => $code,
        ]));
    }

    /*
    |--------------------------------------------------------------------------
    | Checkout - harga asli - diskon - voucher
    |--------------------------------------------------------------------------
    */

    public function test_voucher_is_deducted_after_the_product_discount(): void
    {
        $package = $this->makePackage(['price' => 1000000, 'discount' => 20]);
        $this->makeVoucher(['discount_percent' => 10]);

        $response = $this->orderPackage($this->makeUser(), $package, 'hemat10');

        $response->assertStatus(201)
            ->assertJsonPath('data.voucher_code', 'HEMAT10');

        $order = Order::first();

        $this->assertSame(1000000.0, (float) $order->subtotal);
        $this->assertSame(200000.0, (float) $order->discount_total);
        $this->assertSame(100000.0, (float) $order->voucher_discount);
        $this->assertSame(700000.0, (float) $order->total);
        $this->assertSame(100000.0, (float) $order->items()->first()->voucher_discount);
        $this->assertArrayNotHasKey('voucher_fee', $response->json('data'));
    }

    public function test_voucher_never_pushes_the_price_below_zero(): void
    {
        $package = $this->makePackage(['price' => 1000000, 'discount' => 95]);
        $this->makeVoucher(['discount_percent' => 50]);

        $this->orderPackage($this->makeUser(), $package, 'HEMAT10')->assertStatus(201);

        $this->assertSame(0.0, (float) Order::first()->total);
    }

    public function test_check_endpoint_previews_the_voucher_without_creating_an_order(): void
    {
        $package = $this->makePackage(['price' => 500000]);
        $this->makeVoucher(['discount_percent' => 10]);

        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/orders/check-voucher', [
            'type' => 'package',
            'package_id' => $package->id,
            'voucher_code' => 'HEMAT10',
        ])
            ->assertOk()
            ->assertJsonPath('data.voucher_discount', 50000)
            ->assertJsonPath('data.code', 'HEMAT10');

        $this->assertSame(0, Order::count());
    }

    public function test_unknown_voucher_is_rejected(): void
    {
        $package = $this->makePackage();

        $this->orderPackage($this->makeUser(), $package, 'TIDAKADA')->assertStatus(422);

        $this->assertSame(0, Order::count());
    }

    public function test_voucher_only_applies_to_its_targets(): void
    {
        $target = $this->makePackage();
        $other = $this->makePackage();
        $this->makeVoucher(['targets' => [['type' => 'package', 'id' => $target->id]]]);

        $buyer = $this->makeUser();

        $this->orderPackage($buyer, $other, 'HEMAT10')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Voucher ini tidak berlaku untuk item di pesanan Anda.');

        $this->orderPackage($buyer, $target, 'HEMAT10')->assertStatus(201);
    }

    public function test_voucher_for_a_book_applies_to_the_book_purchase(): void
    {
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['price' => 100000, 'discount' => 10]);
        $this->makeVoucher(['targets' => [['type' => 'book', 'id' => $book->id]], 'discount_percent' => 20]);

        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'voucher_code' => 'HEMAT10',
            'recipient_name' => 'Penerima',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes 1',
        ])->assertStatus(201);

        $order = Order::whereNotNull('voucher_id')->first();

        $this->assertSame(10000.0, (float) $order->discount_total);
        $this->assertSame(20000.0, (float) $order->voucher_discount);
        $this->assertSame(70000.0, (float) $order->total);
    }

    public function test_voucher_for_a_chapter_book_applies_to_slot_orders(): void
    {
        $editor = $this->makeUser(['editor']);
        $book = Book::create([
            'title' => 'Proyek Bab',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_compilation' => true,
            'owner_editor_id' => $editor->id,
            'created_by' => $editor->id,
        ]);
        $slot = BookChapter::create(['book_id' => $book->id, 'chapter_number' => 1, 'title' => 'Bab 1']);
        $this->makeVoucher(['targets' => [['type' => 'book', 'id' => $book->id]], 'discount_percent' => 25]);

        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $slot->id,
            'voucher_code' => 'HEMAT10',
        ])->assertStatus(201);

        $this->assertSame(75000.0, (float) Order::first()->total);
    }

    public function test_voucher_status_rules_block_usage(): void
    {
        $package = $this->makePackage();
        $buyer = $this->makeUser();

        $this->makeVoucher(['code' => 'BELUMMULAI', 'starts_at' => now()->addDay()]);
        $this->makeVoucher(['code' => 'SUDAHHABIS', 'expires_at' => now()->subMinute()]);
        $this->makeVoucher(['code' => 'DIMATIKAN', 'is_active' => false]);
        $this->makeVoucher(['code' => 'DIRESET', 'reset_at' => now()]);

        foreach (['BELUMMULAI', 'SUDAHHABIS', 'DIMATIKAN', 'DIRESET'] as $code) {
            $this->orderPackage($buyer, $package, $code)->assertStatus(422);
        }

        $this->assertSame(0, Order::count());
    }

    public function test_max_uses_is_enforced_and_cancelled_orders_free_a_use(): void
    {
        $package = $this->makePackage();
        $this->makeVoucher(['max_uses' => 1]);

        $first = $this->orderPackage($this->makeUser(), $package, 'HEMAT10');
        $first->assertStatus(201);

        $this->orderPackage($this->makeUser(), $package, 'HEMAT10')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Kuota pemakaian voucher ini sudah habis.');

        Order::find($first->json('data.id'))->update(['status' => 'cancelled']);

        $this->orderPackage($this->makeUser(), $package, 'HEMAT10')->assertStatus(201);
    }

    public function test_order_without_voucher_is_unchanged(): void
    {
        $package = $this->makePackage(['price' => 1000000, 'discount' => 20]);

        $this->orderPackage($this->makeUser(), $package)->assertStatus(201);

        $order = Order::first();

        $this->assertNull($order->voucher_id);
        $this->assertSame(800000.0, (float) $order->total);
        $this->assertSame(200000.0, (float) $order->items()->first()->discount);
    }

    public function test_custom_service_voucher(): void
    {
        $item = CustomPackageItem::create(['type' => 'service', 'name' => 'Layout', 'price' => 200000, 'discount' => 0, 'is_active' => true]);
        $this->makeVoucher(['targets' => [['type' => 'custom_item', 'id' => null]], 'discount_percent' => 50]);

        Sanctum::actingAs($this->makeUser());

        $this->postJson('/api/v1/orders', [
            'type' => 'custom',
            'custom_item_ids' => [$item->id],
            'voucher_code' => 'HEMAT10',
        ])->assertStatus(201);

        $this->assertSame(100000.0, (float) Order::first()->total);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - voucher dan diskon
    |--------------------------------------------------------------------------
    */

    public function test_admin_creates_a_voucher_and_non_admin_cannot(): void
    {
        $package = $this->makePackage();

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->getJson('/api/v1/admin/vouchers')->assertForbidden();

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/vouchers', [
            'name' => 'Promo Kemerdekaan',
            'targets' => [['type' => 'package', 'id' => $package->id]],
            'discount_percent' => 15,
            'max_uses' => 5,
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.source', 'admin');

        $this->getJson('/api/v1/admin/vouchers')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_admin_voucher_rejects_unknown_targets_and_duplicate_codes(): void
    {
        $this->makeVoucher();
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/vouchers', [
            'targets' => [['type' => 'package', 'id' => 99999]],
            'discount_percent' => 10,
        ])->assertStatus(422);

        $this->postJson('/api/v1/admin/vouchers', [
            'code' => 'hemat10',
            'targets' => [['type' => 'all']],
            'discount_percent' => 10,
        ])->assertStatus(422);
    }

    public function test_admin_voucher_list_reports_each_status(): void
    {
        $this->makeVoucher(['code' => 'AKTIF1']);
        $this->makeVoucher(['code' => 'NANTI1', 'starts_at' => now()->addDay()]);
        $this->makeVoucher(['code' => 'LEWAT1', 'expires_at' => now()->subDay()]);
        $this->makeVoucher(['code' => 'MATI01', 'is_active' => false]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $statuses = collect($this->getJson('/api/v1/admin/vouchers')->json('data'))->pluck('status', 'code');

        $this->assertSame('active', $statuses['AKTIF1']);
        $this->assertSame('scheduled', $statuses['NANTI1']);
        $this->assertSame('expired', $statuses['LEWAT1']);
        $this->assertSame('inactive', $statuses['MATI01']);
    }

    public function test_admin_can_reset_selected_or_all_vouchers_but_not_royalty_ones(): void
    {
        $a = $this->makeVoucher(['code' => 'AAAA1']);
        $b = $this->makeVoucher(['code' => 'BBBB1']);
        $royalty = $this->makeVoucher([
            'code' => 'ROYAL1',
            'source' => Voucher::SOURCE_ROYALTY,
            'user_id' => $this->makeUser(['penulis'])->id,
        ]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/vouchers/reset', ['ids' => [$a->id, $royalty->id]])
            ->assertOk()
            ->assertJsonPath('data.reset', 1);

        $this->assertNotNull($a->fresh()->reset_at);
        $this->assertNull($b->fresh()->reset_at);
        $this->assertNull($royalty->fresh()->reset_at);

        $this->postJson('/api/v1/admin/vouchers/reset', ['all' => true])->assertOk()->assertJsonPath('data.reset', 1);

        $this->assertNotNull($b->fresh()->reset_at);
        $this->assertNull($royalty->fresh()->reset_at);
    }

    public function test_discount_list_apply_and_reset_skip_editor_owned_books(): void
    {
        $package = $this->makePackage(['discount' => 5]);
        $item = CustomPackageItem::create(['type' => 'service', 'name' => 'Layout', 'price' => 100000, 'discount' => 0, 'is_active' => true]);
        $adminBook = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['discount' => 0]);
        $editor = $this->makeUser(['editor']);
        $editorBook = Book::create([
            'title' => 'Buku Editor',
            'price' => 100000,
            'discount' => 15,
            'is_active' => true,
            'is_chapter_compilation' => true,
            'is_editor_created' => true,
            'owner_editor_id' => $editor->id,
            'created_by' => $editor->id,
        ]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $rows = collect($this->getJson('/api/v1/admin/discounts')->assertOk()->json('data'));
        $this->assertSame('active', $rows->firstWhere(fn ($r) => $r['type'] === 'package')['status']);
        $this->assertSame('none', $rows->firstWhere(fn ($r) => $r['type'] === 'custom_item')['status']);
        $this->assertTrue($rows->firstWhere(fn ($r) => $r['type'] === 'book' && $r['id'] === $editorBook->id)['editor_owned']);

        $this->postJson('/api/v1/admin/discounts/apply', [
            'items' => [
                ['type' => 'custom_item', 'id' => $item->id],
                ['type' => 'book', 'id' => $adminBook->id],
                ['type' => 'book', 'id' => $editorBook->id],
            ],
            'percent' => 30,
        ])->assertOk()->assertJsonPath('data.updated', 2)->assertJsonPath('data.skipped', 1);

        $this->assertSame(30, $item->fresh()->discount);
        $this->assertSame(30, $adminBook->fresh()->discount);
        $this->assertSame(15, $editorBook->fresh()->discount);

        $this->postJson('/api/v1/admin/discounts/reset', ['all' => true])->assertOk();

        $this->assertSame(0, $package->fresh()->discount);
        $this->assertSame(0, $item->fresh()->discount);
        $this->assertSame(0, $adminBook->fresh()->discount);
        $this->assertSame(15, $editorBook->fresh()->discount);
    }

    /*
    |--------------------------------------------------------------------------
    | Hak voucher admin -> penulis/editor (diskon + fee)
    |--------------------------------------------------------------------------
    */

    private function makeGrant(User $creator, array $overrides = []): VoucherGrant
    {
        return VoucherGrant::create(array_merge([
            'user_id' => $creator->id,
            'targets' => [['type' => 'package', 'id' => $this->makePackage(['name' => 'Paket A'])->id]],
            'pool_percent' => 30,
            'max_vouchers' => 2,
            'period_days' => 30,
            'starts_at' => now()->subDay(),
            'is_active' => true,
        ], $overrides));
    }

    public function test_admin_grants_voucher_rights_only_to_authors_or_editors_with_a_published_book(): void
    {
        $package = $this->makePackage();
        $author = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($author);
        $newcomer = $this->makeUser(['penulis']);

        Sanctum::actingAs($this->makeUser(['admin']));

        $payload = [
            'targets' => [['type' => 'package', 'id' => $package->id]],
            'pool_percent' => 30,
            'max_vouchers' => 3,
            'period_days' => 30,
        ];

        $this->postJson('/api/v1/admin/voucher-grants', $payload + ['user_ids' => [$newcomer->id]])->assertStatus(422);

        $this->postJson('/api/v1/admin/voucher-grants', $payload + ['user_ids' => [$author->id]])
            ->assertCreated()
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.used_quota', 0);

        $ids = collect($this->getJson('/api/v1/admin/voucher-grants/eligible-users')->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($author->id));
        $this->assertFalse($ids->contains($newcomer->id));
    }

    public function test_creator_splits_the_pool_into_discount_and_fee_and_anyone_can_use_it(): void
    {
        $creator = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($creator);
        $grant = $this->makeGrant($creator);
        $package = Package::find($grant->targets[0]['id']);

        Sanctum::actingAs($creator);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant',
            'grant_id' => $grant->id,
            'code' => 'penulisku',
            'discount_percent' => 10,
            'fee_percent' => 20,
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'PENULISKU')
            ->assertJsonPath('data.status', 'active');

        // Pembuat voucher boleh memakai vouchernya sendiri; pembeli lain juga.
        $own = $this->orderPackage($creator, $package, 'PENULISKU');
        $own->assertStatus(201);
        $other = $this->orderPackage($this->makeUser(), $package, 'PENULISKU');
        $other->assertStatus(201);

        $this->assertSame(900000.0, (float) Order::find($other->json('data.id'))->total);

        // Fee baru dihitung setelah pesanan selesai.
        Sanctum::actingAs($creator);
        $this->getJson('/api/v1/vouchers/mine')->assertJsonPath('data.totals.fee_earned', 0);

        Order::find($other->json('data.id'))->update(['status' => 'completed']);

        $this->getJson('/api/v1/vouchers/mine')
            ->assertOk()
            ->assertJsonPath('data.totals.fee_earned', 200000)
            ->assertJsonPath('data.grants.0.vouchers.0.uses', 2)
            ->assertJsonPath('data.grants.0.vouchers.0.completed_uses', 1);
    }

    public function test_discount_plus_fee_cannot_exceed_the_pool_and_quota_is_limited(): void
    {
        $creator = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($creator);
        $grant = $this->makeGrant($creator, ['max_vouchers' => 2]);

        Sanctum::actingAs($creator);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 15, 'fee_percent' => 20,
        ])->assertStatus(422);

        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/v1/vouchers/mine', [
                'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 10, 'fee_percent' => 20,
            ])->assertCreated();
        }

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 10, 'fee_percent' => 20,
        ])->assertStatus(422)->assertJsonPath('message', 'Kuota voucher untuk periode ini sudah habis.');
    }

    public function test_voucher_rights_require_a_published_book(): void
    {
        $creator = $this->makeUser(['penulis']);
        $grant = $this->makeGrant($creator);

        Sanctum::actingAs($creator);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 10,
        ])->assertForbidden();

        $this->getJson('/api/v1/vouchers/mine')->assertOk()->assertJsonPath('data.eligible', false);
    }

    public function test_a_user_cannot_use_somebody_elses_grant(): void
    {
        $creator = $this->makeUser(['penulis']);
        $grant = $this->makeGrant($creator);
        $intruder = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($intruder);

        Sanctum::actingAs($intruder);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 10,
        ])->assertNotFound();
    }

    public function test_vouchers_reset_when_the_period_ends_and_quota_returns(): void
    {
        $creator = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($creator);
        $grant = $this->makeGrant($creator, ['max_vouchers' => 1, 'period_days' => 10, 'starts_at' => now()]);
        $package = Package::find($grant->targets[0]['id']);

        Sanctum::actingAs($creator);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'code' => 'PERIODE1', 'discount_percent' => 10, 'fee_percent' => 5,
        ])->assertCreated();

        $this->orderPackage($this->makeUser(), $package, 'PERIODE1')->assertStatus(201);

        // Periode berikutnya: voucher lama mati, kuota penuh lagi.
        $this->travel(11)->days();

        $this->orderPackage($this->makeUser(), $package, 'PERIODE1')
            ->assertStatus(422)
            ->assertJsonPath('message', 'Masa berlaku voucher ini sudah habis.');

        Sanctum::actingAs($creator);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'code' => 'PERIODE2', 'discount_percent' => 10, 'fee_percent' => 5,
        ])->assertCreated();

        $this->orderPackage($this->makeUser(), $package, 'PERIODE2')->assertStatus(201);
    }

    public function test_revoked_or_ended_grant_stops_its_vouchers(): void
    {
        $creator = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($creator);
        $grant = $this->makeGrant($creator);
        $package = Package::find($grant->targets[0]['id']);

        Sanctum::actingAs($creator);
        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'code' => 'HAKCABUT', 'discount_percent' => 10,
        ])->assertCreated();

        $grant->update(['is_active' => false]);

        $this->orderPackage($this->makeUser(), $package, 'HAKCABUT')->assertStatus(422);
    }

    public function test_admin_resetting_a_grant_voucher_frees_its_quota(): void
    {
        $creator = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($creator);
        $grant = $this->makeGrant($creator, ['max_vouchers' => 1]);

        Sanctum::actingAs($creator);
        $id = $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 10,
        ])->assertCreated()->json('data.id');

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->postJson('/api/v1/admin/vouchers/reset', ['ids' => [$id]])->assertOk();

        Sanctum::actingAs($creator);
        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'grant', 'grant_id' => $grant->id, 'discount_percent' => 10,
        ])->assertCreated();
    }

    /*
    |--------------------------------------------------------------------------
    | Voucher dari royalti sendiri
    |--------------------------------------------------------------------------
    */

    public function test_author_makes_a_voucher_for_own_book_up_to_the_royalty_rate_and_it_reduces_the_royalty(): void
    {
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['price' => 100000]);

        Sanctum::actingAs($author);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'royalty', 'book_id' => $book->id, 'discount_percent' => 26,
        ])->assertStatus(422);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'royalty', 'book_id' => $book->id, 'code' => 'BUKUKU', 'discount_percent' => 10,
        ])->assertCreated()->assertJsonPath('data.source', 'royalty');

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'royalty', 'book_id' => $book->id, 'discount_percent' => 5, 'fee_percent' => 5,
        ])->assertStatus(422);

        // Pembelian lewat voucher: harga turun 10%, royalti penulis turun 10% dari harga.
        Sanctum::actingAs($this->makeUser());
        $orderId = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'voucher_code' => 'BUKUKU',
            'recipient_name' => 'Penerima',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes 1',
        ])->assertStatus(201)->json('data.id');

        $order = Order::find($orderId);
        $this->assertSame(90000.0, (float) $order->total);
        $order->update(['status' => 'completed']);

        Sanctum::actingAs($author);

        // Normal 25% x 100.000 = 25.000; dikurangi potongan voucher 10.000.
        $this->getJson('/api/v1/royalties/mine')
            ->assertOk()
            ->assertJsonPath('data.0.voucher_deduction', 10000)
            ->assertJsonPath('data.0.royalty_amount', 15000);
    }

    public function test_voucher_from_royalty_needs_a_book_the_user_earns_royalty_on(): void
    {
        $author = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($author);
        $someoneElses = $this->makeBookWithAuthor($this->makeUser(['penulis']));

        Sanctum::actingAs($author);

        $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'royalty', 'book_id' => $someoneElses->id, 'discount_percent' => 5,
        ])->assertNotFound();
    }

    public function test_voucher_toggle_is_owner_only(): void
    {
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author);

        Sanctum::actingAs($author);
        $id = $this->postJson('/api/v1/vouchers/mine', [
            'source' => 'royalty', 'book_id' => $book->id, 'discount_percent' => 5,
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/v1/vouchers/mine/{$id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.status', 'inactive');

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->patchJson("/api/v1/vouchers/mine/{$id}", ['is_active' => true])->assertNotFound();
    }

    public function test_admin_can_grant_to_several_or_all_eligible_users_at_once(): void
    {
        $package = $this->makePackage();
        $a = $this->makeUser(['penulis']);
        $b = $this->makeUser(['editor']);
        $c = $this->makeUser(['penulis']);
        $newcomer = $this->makeUser(['penulis']);
        foreach ([$a, $b, $c] as $user) {
            $this->makeBookWithAuthor($user);
        }

        Sanctum::actingAs($this->makeUser(['admin']));

        $payload = [
            'targets' => [['type' => 'package', 'id' => $package->id]],
            'pool_percent' => 30,
            'max_vouchers' => 3,
            'period_days' => 30,
        ];

        // Beberapa penerima; satu belum berhak -> semuanya ditolak.
        $this->postJson('/api/v1/admin/voucher-grants', $payload + ['user_ids' => [$a->id, $newcomer->id]])
            ->assertStatus(422);
        $this->assertSame(0, VoucherGrant::count());

        $this->postJson('/api/v1/admin/voucher-grants', $payload + ['user_ids' => [$a->id, $b->id]])
            ->assertCreated()
            ->assertJsonCount(2, 'data');

        // Semua yang berhak (3 penulis dengan buku terbit), yang belum berhak dilewati.
        $this->postJson('/api/v1/admin/voucher-grants', $payload + ['all_eligible' => true])
            ->assertCreated()
            ->assertJsonCount(3, 'data');

        $this->assertSame(5, VoucherGrant::count());
        $this->assertSame(0, VoucherGrant::where('user_id', $newcomer->id)->count());
    }
}
