<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookExternalSale;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
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
            'is_active' => true,
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

    public function test_manual_royalty_percentage_is_no_longer_accepted_from_the_book_form(): void
    {
        $admin = $this->makeUser(['admin']);
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']));

        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/books/{$book->id}", ['royalty_percentage' => 15])->assertStatus(200);

        $this->assertNull($book->fresh()->royalty_percentage);
    }

    public function test_admin_royalty_index_lists_published_books_with_a_linked_author_only(): void
    {
        $admin = $this->makeUser(['admin']);
        $published = $this->makeBookWithAuthor($this->makeUser(['penulis']));
        $draft = $this->makeBookWithAuthor($this->makeUser(['penulis']), ['is_active' => false]);
        $noAuthor = Book::create(['title' => 'Tanpa Penulis Akun', 'price' => 1000, 'discount' => 0, 'is_active' => true, 'created_by' => $admin->id]);

        Sanctum::actingAs($admin);

        $ids = collect($this->getJson('/api/v1/admin/royalties')->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($published->id));
        $this->assertFalse($ids->contains($draft->id));
        $this->assertFalse($ids->contains($noAuthor->id));
    }

    public function test_admin_royalty_index_shows_total_and_completed_order_counts_separately(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['price' => 100000]);

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
        $this->assertEquals(25000, $row['system_royalty_amount']);

        $this->assertNotNull($pendingOrderId);
    }

    public function test_system_royalty_uses_order_item_unit_price_snapshot_not_current_book_price(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, ['price' => 100000]);

        $orderId = $this->placeBookOrder($this->makeUser(), $book);

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$orderId}/status", ['status' => 'completed'])
            ->assertStatus(200);

        // Naikkan harga buku setelah order selesai — royalti transaksi lama
        // seharusnya tidak ikut berubah.
        $book->update(['price' => 500000]);

        $response = $this->getJson('/api/v1/admin/royalties');
        $row = collect($response->json('data'))->firstWhere('id', $book->id);

        $this->assertEquals(25000, $row['system_royalty_amount']);
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
        $book = $this->makeBookWithAuthor($this->makeUser(['penulis']), []);

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

        // 100000 (harga asli, BUKAN harga setelah diskon 50000) * 25% * 4 = 100000
        $this->assertEquals(100000, $row['external_royalty_amount']);
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
        $book = $this->makeBookWithAuthor($author, ['price' => 100000]);

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
        $this->assertEquals(25000, $row['royalty_amount']);
        $this->assertArrayNotHasKey('total_orders_count', $row);
        $this->assertArrayNotHasKey('completed_orders_count', $row);
    }

    public function test_mine_endpoint_external_sales_omit_discount_fields(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author, []);

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
        $this->assertEquals(50000, $sale['royalty_amount']);
        $this->assertArrayNotHasKey('discount_percentage', $sale);
        $this->assertArrayNotHasKey('discounted_price', $sale);
    }

    public function test_mine_endpoint_does_not_return_another_authors_book(): void
    {
        $author = $this->makeUser(['penulis']);
        $otherAuthor = $this->makeUser(['penulis']);
        $this->makeBookWithAuthor($otherAuthor, []);

        Sanctum::actingAs($author);
        $response = $this->getJson('/api/v1/royalties/mine');

        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data'));
    }

    /*
    |--------------------------------------------------------------------------
    | Aturan royalti per jenis paket
    |--------------------------------------------------------------------------
    */

    private function makeCompilation(array $authors, ?User $ownerEditor = null): Book
    {
        $book = Book::create([
            'title' => 'Kompilasi '.uniqid(),
            'authors_text' => 'Beberapa Penulis',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_compilation' => true,
            'is_editor_created' => $ownerEditor !== null,
            'owner_editor_id' => $ownerEditor?->id,
            'created_by' => ($ownerEditor ?? $authors[0])->id,
        ]);

        foreach ($authors as $number => $author) {
            $manuscript = $this->makeBookWithAuthor($author)->manuscript;

            BookChapter::create([
                'book_id' => $book->id,
                'manuscript_id' => $manuscript->id,
                'chapter_number' => $number + 1,
                'title' => 'Bab '.($number + 1),
            ]);
        }

        return $book;
    }

    private function mineRow(User $user, Book $book): ?array
    {
        Sanctum::actingAs($user);

        return collect($this->getJson('/api/v1/royalties/mine')->assertStatus(200)->json('data'))
            ->firstWhere('id', $book->id);
    }

    public function test_regular_package_author_gets_25_percent(): void
    {
        $author = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author);

        $row = $this->mineRow($author, $book);

        $this->assertEquals(25, $row['royalty_percentage']);
        $this->assertSame('author', $row['role']);
        $this->assertSame('regular', $row['package']);
        $this->assertSame(1, $row['authors_count']);
    }

    public function test_regular_package_royalty_is_split_between_co_authors(): void
    {
        $author = $this->makeUser(['penulis']);
        $coAuthor = $this->makeUser(['penulis']);
        $book = $this->makeBookWithAuthor($author);
        ManuscriptAuthor::create(['manuscript_id' => $book->manuscript_id, 'user_id' => $author->id, 'position' => 1]);
        ManuscriptAuthor::create(['manuscript_id' => $book->manuscript_id, 'user_id' => $coAuthor->id, 'position' => 2]);

        $this->assertEquals(12.5, $this->mineRow($author, $book)['royalty_percentage']);
        $this->assertEquals(12.5, $this->mineRow($coAuthor, $book)['royalty_percentage']);
    }

    public function test_chapter_book_by_admin_gives_each_author_25_percent_divided_by_author_count(): void
    {
        $authors = [$this->makeUser(['penulis']), $this->makeUser(['penulis']), $this->makeUser(['penulis']), $this->makeUser(['penulis'])];
        $book = $this->makeCompilation($authors);

        $row = $this->mineRow($authors[0], $book);

        $this->assertEquals(6.25, $row['royalty_percentage']);
        $this->assertSame('chapter_admin', $row['package']);
        $this->assertSame(4, $row['authors_count']);
        $this->assertSame(1, $row['chapters_count']);
        $this->assertSame(4, $row['total_chapters']);
    }

    public function test_chapter_royalty_follows_the_number_of_chapters_each_author_wrote(): void
    {
        // 10 bab: penulis A menulis 1, B 2, C 3, D 4.
        [$a, $b, $c, $d] = [$this->makeUser(['penulis']), $this->makeUser(['penulis']), $this->makeUser(['penulis']), $this->makeUser(['penulis'])];
        $book = $this->makeCompilation([$a, $b, $b, $c, $c, $c, $d, $d, $d, $d]);

        $this->assertEquals(2.5, $this->mineRow($a, $book)['royalty_percentage']);
        $this->assertEquals(5, $this->mineRow($b, $book)['royalty_percentage']);
        $this->assertEquals(7.5, $this->mineRow($c, $book)['royalty_percentage']);
        $row = $this->mineRow($d, $book);
        $this->assertEquals(10, $row['royalty_percentage']);
        $this->assertSame(4, $row['chapters_count']);
        $this->assertSame(10, $row['total_chapters']);
    }

    public function test_chapter_book_by_editor_gives_the_editor_5_percent_on_top_of_the_author_share(): void
    {
        $authors = [$this->makeUser(['penulis']), $this->makeUser(['penulis'])];
        $editor = $this->makeUser(['editor']);
        $book = $this->makeCompilation($authors, $editor);

        $authorRow = $this->mineRow($authors[1], $book);
        $editorRow = $this->mineRow($editor, $book);

        $this->assertEquals(12.5, $authorRow['royalty_percentage']);
        $this->assertSame('chapter_editor', $authorRow['package']);
        $this->assertEquals(5, $editorRow['royalty_percentage']);
        $this->assertSame('editor', $editorRow['role']);
    }

    public function test_editor_earns_from_sales_and_admin_sees_the_whole_split(): void
    {
        $admin = $this->makeUser(['admin']);
        $author = $this->makeUser(['penulis']);
        $editor = $this->makeUser(['editor']);
        $book = $this->makeCompilation([$author], $editor);

        $orderId = $this->placeBookOrder($this->makeUser(), $book);
        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$orderId}/status", ['status' => 'completed'])->assertStatus(200);

        $this->assertEquals(5000, $this->mineRow($editor, $book)['royalty_amount']);
        $this->assertEquals(25000, $this->mineRow($author, $book)['royalty_amount']);

        Sanctum::actingAs($admin);
        $row = collect($this->getJson('/api/v1/admin/royalties')->json('data'))->firstWhere('id', $book->id);

        $this->assertEquals(30, $row['royalty_percentage']);
        $this->assertEquals(30000, $row['total_royalty_amount']);
        $this->assertSame(['author', 'editor'], array_column($row['shares'], 'role'));
        $this->assertEquals([25000, 5000], array_column($row['shares'], 'royalty_amount'));
    }

    public function test_unpublished_books_and_other_users_books_are_not_listed_in_mine(): void
    {
        $author = $this->makeUser(['penulis']);
        $draft = $this->makeBookWithAuthor($author, ['is_active' => false]);

        $this->assertNull($this->mineRow($author, $draft));
        $this->assertNull($this->mineRow($this->makeUser(['penulis']), $this->makeBookWithAuthor($author)));
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
