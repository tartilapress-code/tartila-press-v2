<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Role;
use App\Models\User;
use App\Models\WalletWithdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Kelola Penulis (admin): buku terbit, naskah dalam proses, royalti, catatan progres/hak. */
class AuthorManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
    }

    private function makeUser(array $roles = ['penulis'], string $name = 'Penulis'): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function order(User $user, array $extra = []): Order
    {
        return Order::create($extra + ['order_number' => 'ORD-'.uniqid(), 'user_id' => $user->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
    }

    private function manuscript(User $author, string $title, string $status): Manuscript
    {
        $manuscript = Manuscript::create(['order_id' => $this->order($author)->id, 'user_id' => $author->id, 'title' => $title, 'authors' => [$author->name], 'status' => $status]);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $author->id, 'position' => 1, 'approved_at' => now()]);

        return $manuscript;
    }

    private function publish(Manuscript $manuscript, ?int $fieldId = null): Book
    {
        return Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'isbn' => '978-0-0000-0000-0',
            'field_category_id' => $fieldId,
            'created_by' => $manuscript->user_id,
        ]);
    }

    private function sell(Book $book): void
    {
        $order = $this->order($this->makeUser(['user'], 'Pembeli'), ['status' => 'completed']);
        OrderItem::create(['order_id' => $order->id, 'itemable_type' => Book::class, 'itemable_id' => $book->id, 'name' => $book->title, 'quantity' => 2, 'unit_price' => 100000, 'subtotal' => 200000]);
    }

    private function row(User $author): array
    {
        Sanctum::actingAs($this->admin);

        return collect($this->getJson('/api/v1/admin/authors')->assertOk()->json('data'))->firstWhere('id', $author->id);
    }

    public function test_the_list_shows_counts_fields_and_royalty(): void
    {
        $author = $this->makeUser();
        $science = FieldCategory::create(['name' => 'Fisika']);
        $math = FieldCategory::create(['name' => 'Matematika']);

        $first = $this->publish($this->manuscript($author, 'Buku Fisika', 'completed'), $science->id);
        $this->publish($this->manuscript($author, 'Buku Matematika', 'completed'), $math->id);
        $this->manuscript($author, 'Naskah Baru', 'in_editing');
        $this->manuscript($author, 'Naskah Revisi', 'revision_requested');
        $this->sell($first); // 2 x 100.000 x 25% = 50.000

        $row = $this->row($author);

        $this->assertSame(2, $row['published_books']);
        $this->assertSame(2, $row['in_process']);
        $this->assertEqualsCanonicalizing(['Fisika', 'Matematika'], $row['fields']);
        $this->assertEquals(50000, $row['royalty_total']);
        $this->assertEquals(50000, $row['royalty_unclaimed']);
    }

    public function test_unclaimed_royalty_excludes_withdrawals(): void
    {
        $author = $this->makeUser();
        $book = $this->publish($this->manuscript($author, 'Buku Laris', 'completed'));
        $this->sell($book);

        WalletWithdrawal::create(['user_id' => $author->id, 'amount' => 30000, 'admin_fee' => 5000, 'net_amount' => 25000, 'bank_name' => 'BNI', 'account_number' => '1', 'account_name' => 'A', 'status' => 'paid']);

        $row = $this->row($author);

        $this->assertEquals(50000, $row['royalty_total']);
        $this->assertEquals(20000, $row['royalty_unclaimed']);
    }

    public function test_notes_list_unfinished_rights_with_the_book_title(): void
    {
        $author = $this->makeUser();
        $this->manuscript($author, 'Naskah Masih Diedit', 'in_editing');
        // Selesai tetapi belum diterbitkan sebagai buku: ISBN pun belum terbit.
        $this->manuscript($author, 'Naskah Selesai Belum Terbit', 'completed');

        $notes = collect($this->row($author)['notes']);

        $this->assertTrue($notes->contains(fn ($note) => $note['title'] === 'Naskah Masih Diedit' && str_contains($note['text'], 'dalam proses') && str_contains($note['text'], 'Sedang diedit')));
        $this->assertTrue($notes->contains(fn ($note) => $note['title'] === 'Naskah Selesai Belum Terbit' && $note['type'] === 'book' && $note['text'] === 'Buku belum diterbitkan'));
        $this->assertTrue($notes->contains(fn ($note) => $note['title'] === 'Naskah Selesai Belum Terbit' && $note['type'] === 'isbn'));
    }

    public function test_an_author_with_nothing_pending_has_no_notes(): void
    {
        $author = $this->makeUser();

        $row = $this->row($author);

        $this->assertSame([], $row['notes']);
        $this->assertSame(0, $row['published_books']);
        $this->assertEquals(0, $row['royalty_total']);
    }

    public function test_admin_can_save_and_clear_a_private_note(): void
    {
        $author = $this->makeUser();

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/v1/admin/authors/{$author->id}/note", ['note' => 'Hubungi soal sertifikat HKI'])->assertOk();
        $this->assertSame('Hubungi soal sertifikat HKI', $this->row($author)['admin_note']);

        $this->putJson("/api/v1/admin/authors/{$author->id}/note", ['note' => ''])->assertOk();
        $this->assertNull($this->row($author)['admin_note']);
    }

    public function test_only_admin_can_use_it(): void
    {
        $author = $this->makeUser();

        Sanctum::actingAs($author);
        $this->getJson('/api/v1/admin/authors')->assertForbidden();
        $this->putJson("/api/v1/admin/authors/{$author->id}/note", ['note' => 'x'])->assertForbidden();
    }
}
