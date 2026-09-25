<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookExternalSale;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookRoyaltyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create([
                'name' => $name,
                'display_name' => ucfirst($name),
            ]);
        }
    }

    private function makeUser(array $roleNames = ['user']): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $roleIds = Role::whereIn('name', $roleNames)->pluck('id');
        $user->roles()->attach($roleIds);

        return $user;
    }

    private function makeOrderForManuscript(User $author): Order
    {
        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $author->id,
            'status' => 'confirmed',
            'subtotal' => 1000000,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 1000000,
        ]);
    }

    private function makeBookWithAuthor(User $author, array $overrides = []): Book
    {
        $manuscript = Manuscript::create([
            'order_id' => $this->makeOrderForManuscript($author)->id,
            'user_id' => $author->id,
            'title' => 'Naskah '.uniqid(),
            'authors' => [$author->name],
            'status' => 'completed',
        ]);

        return Book::create(array_merge([
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'authors_text' => $author->name,
            'price' => 100000,
            'discount' => 0,
            'created_by' => $author->id,
        ], $overrides));
    }

    private function placeBookOrder(User $buyer, Book $book): int
    {
        Sanctum::actingAs($buyer);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book',
            'book_ids' => [$book->id],
            'recipient_name' => 'Penerima Test',
            'recipient_phone' => '081234567890',
            'recipient_address' => 'Jl. Tes No. 1',
        ]);

        $response->assertStatus(201);

        return $response->json('data.id');
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - Set Royalti
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_set_royalty_percentage_via_book_update_endpoint(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author);

        Sanctum::actingAs($admin);

        $response = $this->patchJson("/api/v1/admin/books/{$book->id}", [
            'royalty_percentage' => 15,
        ]);

        $response->assertStatus(200);
        $this->assertSame('15.00', $book->fresh()->royalty_percentage);
    }

    public function test_admin_royalty_index_only_shows_books_with_royalty_percentage_set(): void
    {
        $admin = $this->makeUser(['admin']);
        $withRoyalty = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['royalty_percentage' => 10]);
        $withoutRoyalty = $this->makeBookWithAuthor($this->makeUser(['penulis']));

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/royalties');

        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($withRoyalty->id));
        $this->assertFalse($ids->contains($withoutRoyalty->id));
    }

    public function test_admin_royalty_index_shows_total_and_completed_order_counts_separately(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['royalty_percentage' => 10, 'price' => 100000]);

        $pendingOrderId = $this->placeBookOrder($this->makeUser(), $book);
        $completedOrderId = $this->placeBookOrder($this->makeUser(), $book);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$completedOrderId}/status", ['status' => 'completed'])
            ->assertStatus(200);

        $response = $this->getJson('/api/v1/admin/royalties');
        $response->assertStatus(200);

        $row = collect($response->json('data'))->firstWhere('id', $book->id);
        $this->assertSame(2, $row['total_orders_count']);
        $this->assertSame(1, $row['completed_orders_count']);
        $this->assertSame(1, $row['completed_quantity']);
        $this->assertEquals(10000, $row['system_royalty_amount']);

        $this->assertNotNull($pendingOrderId);
    }

    public function test_system_royalty_uses_order_item_unit_price_snapshot_not_current_book_price(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['royalty_percentage' => 10, 'price' => 100000]);

        $orderId = $this->placeBookOrder($this->makeUser(), $book);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$orderId}/status", ['status' => 'completed'])
            ->assertStatus(200);

        // Naikkan harga buku setelah order selesai — royalti transaksi lama
        // seharusnya tidak ikut berubah.
        $book->update(['price' => 500000]);

        $response = $this->getJson('/api/v1/admin/royalties');
        $row = collect($response->json('data'))->firstWhere('id', $book->id);

        $this->assertEquals(10000, $row['system_royalty_amount']);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin - External Sales
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_create_update_and_delete_external_sale(): void
    {
        $admin = $this->makeUser(['admin']);
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['royalty_percentage' => 20]);

        Sanctum::actingAs($admin);

        $created = $this->postJson("/api/v1/admin/books/{$book->id}/external-sales", [
            'marketplace_name' => 'Shopee',
            'original_price' => 100000,
            'discount_percentage' => 20,
            'discounted_price' => 80000,
            'quantity_sold' => 3,
        ]);
        $created->assertStatus(201);
        $saleId = $created->json('data.id');

        $this->assertDatabaseHas('book_external_sales', [
            'id' => $saleId,
            'book_id' => $book->id,
            'marketplace_name' => 'Shopee',
            'quantity_sold' => 3,
        ]);

        $updated = $this->patchJson("/api/v1/admin/external-sales/{$saleId}", [
            'quantity_sold' => 5,
        ]);
        $updated->assertStatus(200);
        $this->assertSame(5, BookExternalSale::find($saleId)->quantity_sold);

        $this->deleteJson("/api/v1/admin/external-sales/{$saleId}")->assertStatus(200);
        $this->assertDatabaseMissing('book_external_sales', ['id' => $saleId]);
    }

    public function test_non_admin_cannot_manage_external_sales(): void
    {
        $user = $this->makeUser();
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['royalty_percentage' => 20]);

        Sanctum::actingAs($user);

        $this->postJson("/api/v1/admin/books/{$book->id}/external-sales", [
            'marketplace_name' => 'Shopee',
            'original_price' => 100000,
            'quantity_sold' => 3,
        ])->assertStatus(403);

        $this->getJson('/api/v1/admin/royalties')->assertStatus(403);
    }

    public function test_royalty_amount_calculated_from_original_price_for_external_sales(): void
    {
        $admin = $this->makeUser(['admin']);
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['royalty_percentage' => 10]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/books/{$book->id}/external-sales", [
            'marketplace_name' => 'Tokopedia',
            'original_price' => 100000,
            'discount_percentage' => 50,
            'discounted_price' => 50000,
            'quantity_sold' => 4,
        ])->assertStatus(201);

        $response = $this->getJson('/api/v1/admin/royalties');
        $row = collect($response->json('data'))->firstWhere('id', $book->id);

        // 100000 (harga asli, BUKAN harga setelah diskon 50000) * 10% * 4 = 40000
        $this->assertEquals(40000, $row['external_royalty_amount']);
        $this->assertSame(4, $row['external_quantity']);
    }

    /*
    |--------------------------------------------------------------------------
    | Penulis - Royalti Saya
    |--------------------------------------------------------------------------
    */

    public function test_mine_endpoint_only_returns_completed_quantity_not_raw_order_counts(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['royalty_percentage' => 10, 'price' => 100000]);

        $this->placeBookOrder($this->makeUser(), $book);
        $completedOrderId = $this->placeBookOrder($this->makeUser(), $book);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$completedOrderId}/status", ['status' => 'completed'])
            ->assertStatus(200);

        Sanctum::actingAs($author);
        $response = $this->getJson('/api/v1/royalties/mine');
        $response->assertStatus(200);

        $row = collect($response->json('data'))->firstWhere('id', $book->id);
        $this->assertSame(1, $row['quantity_sold']);
        $this->assertEquals(10000, $row['royalty_amount']);
        $this->assertArrayNotHasKey('total_orders_count', $row);
        $this->assertArrayNotHasKey('completed_orders_count', $row);
    }

    public function test_mine_endpoint_external_sales_omit_discount_fields(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['royalty_percentage' => 10]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/books/{$book->id}/external-sales", [
            'marketplace_name' => 'Shopee',
            'original_price' => 100000,
            'discount_percentage' => 20,
            'discounted_price' => 80000,
            'quantity_sold' => 2,
        ])->assertStatus(201);

        Sanctum::actingAs($author);
        $response = $this->getJson('/api/v1/royalties/mine');
        $row = collect($response->json('data'))->firstWhere('id', $book->id);
        $sale = $row['external_sales'][0];

        $this->assertSame('Shopee', $sale['marketplace_name']);
        $this->assertEquals(2, $sale['quantity_sold']);
        $this->assertEquals(20000, $sale['royalty_amount']);
        $this->assertArrayNotHasKey('discount_percentage', $sale);
        $this->assertArrayNotHasKey('discounted_price', $sale);
    }

    public function test_mine_endpoint_does_not_return_another_authors_book(): void
    {
        $author = $this->makeUser(['penulis']);
        $otherAuthor = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($otherAuthor, ['royalty_percentage' => 10]);

        Sanctum::actingAs($author);
        $response = $this->getJson('/api/v1/royalties/mine');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data'));
    }

    /*
    |--------------------------------------------------------------------------
    | Royalti tidak bocor ke endpoint publik/non-admin lain
    |--------------------------------------------------------------------------
    */

    public function test_public_book_catalog_never_exposes_royalty_percentage(): void
    {
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']), [
            'royalty_percentage' => 25,
            'is_active' => true,
        ]);

        $index = $this->getJson('/api/v1/books');
        $index->assertStatus(200);
        $indexBook = collect($index->json('data'))->firstWhere('id', $book->id);
        $this->assertArrayNotHasKey('royalty_percentage', $indexBook);

        $show = $this->getJson("/api/v1/books/{$book->slug}");
        $show->assertStatus(200);
        $show->assertJsonMissingPath('data.royalty_percentage');
    }

    public function test_manuscript_show_viewed_by_assigned_editor_hides_royalty_percentage(): void
    {
        $editor = $this->makeUser(['editor']);
        $author = $this->makeUser(['penulis']);

        $manuscript = Manuscript::create([
            'order_id' => $this->makeOrderForManuscript($author)->id,
            'user_id' => $author->id,
            'editor_id' => $editor->id,
            'title' => 'Naskah Ditugaskan',
            'authors' => [$author->name],
            'status' => 'completed',
        ]);

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'authors_text' => $author->name,
            'price' => 100000,
            'discount' => 0,
            'royalty_percentage' => 30,
            'created_by' => $author->id,
        ]);

        Sanctum::actingAs($editor);
        $response = $this->getJson("/api/v1/manuscripts/{$manuscript->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.book.id', $book->id);
        $response->assertJsonMissingPath('data.book.royalty_percentage');
    }
}
