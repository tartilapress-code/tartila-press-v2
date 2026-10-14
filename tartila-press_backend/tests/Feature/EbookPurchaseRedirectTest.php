<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\PaymentMethod;
use App\Models\Reader\ReaderBook;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Buku ber-ISBN digital dibeli di Tartila Book (tautan = alamat situs + judul); ISBN keduanya bisa fisik atau digital. */
class EbookPurchaseRedirectTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.book_url' => 'https://book.contoh.test']);

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function book(string $isbnType, string $title = 'Judul Ebook Uji'): Book
    {
        $admin = User::create(['name' => 'Admin', 'email' => uniqid('a').'@example.com', 'password' => 'Tartila@2026']);

        return Book::create([
            'title' => $title, 'price' => 90000, 'discount' => 0, 'is_active' => true,
            'created_by' => $admin->id, 'isbn_type' => $isbnType,
        ]);
    }

    private function publishEbook(Book $book): ReaderBook
    {
        $book->forceFill(['ebook_file' => 'ebooks/uji.pdf', 'ebook_name' => 'uji.pdf', 'ebook_uploaded_at' => now(), 'ebook_pages' => 5])->save();

        return ReaderBook::create(['book_id' => $book->id, 'is_published' => true]);
    }

    public function test_the_ebook_link_uses_the_domain_and_the_title_and_reports_availability(): void
    {
        $book = $this->book('electronic');
        $url = "https://book.contoh.test/buku/{$book->slug}";

        // Belum ada di Tartila Book: tautan tetap ada, tetapi ebook belum tersedia.
        $this->getJson("/api/v1/books/{$book->slug}")->assertOk()
            ->assertJsonPath('data.sells_physical', false)
            ->assertJsonPath('data.sells_ebook', true)
            ->assertJsonPath('data.ebook_url', $url)
            ->assertJsonPath('data.ebook_available', false);

        $this->publishEbook($book);

        $this->getJson("/api/v1/books/{$book->slug}")->assertOk()->assertJsonPath('data.ebook_available', true);
    }

    public function test_a_print_book_has_no_ebook_link_and_a_both_book_offers_physical_and_digital(): void
    {
        $print = $this->book('print', 'Buku Cetak Saja');
        $this->getJson("/api/v1/books/{$print->slug}")->assertOk()
            ->assertJsonPath('data.sells_physical', true)
            ->assertJsonPath('data.sells_ebook', false)
            ->assertJsonMissingPath('data.ebook_url');

        $both = $this->book('both', 'Buku Dua Format');
        $this->getJson("/api/v1/books/{$both->slug}")->assertOk()
            ->assertJsonPath('data.sells_physical', true)
            ->assertJsonPath('data.sells_ebook', true)
            ->assertJsonPath('data.ebook_url', "https://book.contoh.test/buku/{$both->slug}");
    }

    public function test_an_ebook_only_book_cannot_be_ordered_as_a_physical_book(): void
    {
        $book = $this->book('electronic');
        $physical = $this->book('both', 'Buku Dua Format');
        $method = PaymentMethod::create(['bank_name' => 'BRI', 'account_number' => '1', 'account_holder_name' => 'T', 'is_active' => true]);
        $buyer = User::create(['name' => 'Pembeli', 'email' => uniqid('b').'@example.com', 'password' => 'Tartila@2026']);
        $buyer->roles()->attach(Role::where('name', 'user')->value('id'));
        Sanctum::actingAs($buyer);

        $payload = ['type' => 'book', 'payment_method_id' => $method->id, 'recipient_name' => 'A', 'recipient_phone' => '0812', 'recipient_address' => 'Jl. A'];

        $this->postJson('/api/v1/orders', $payload + ['book_ids' => [$book->id]])->assertStatus(422)
            ->assertJsonPath('message', "\"Judul Ebook Uji\" hanya tersedia sebagai ebook. Beli ebook-nya di Tartila Book: https://book.contoh.test/buku/{$book->slug}");

        // Buku ber-ISBN keduanya tetap bisa dipesan sebagai buku fisik.
        $this->postJson('/api/v1/orders', $payload + ['book_ids' => [$physical->id]])->assertCreated();
    }

    public function test_tartila_book_opens_by_title_and_says_when_the_ebook_is_not_available_yet(): void
    {
        $book = $this->book('electronic');

        // Belum diunggah/dipublikasikan.
        $this->getJson("/api/v1/reader/books/{$book->slug}")->assertStatus(404)
            ->assertJsonPath('message', 'Ebook belum tersedia, coba lagi di lain waktu.');
        $this->getJson('/api/v1/reader/books/judul-yang-tidak-ada')->assertStatus(404)
            ->assertJsonPath('message', 'Ebook belum tersedia, coba lagi di lain waktu.');

        $readerBook = $this->publishEbook($book);

        $this->getJson("/api/v1/reader/books/{$book->slug}")->assertOk()
            ->assertJsonPath('data.id', $readerBook->id)
            ->assertJsonPath('data.slug', $book->slug);
        // Nomor lama tetap berlaku.
        $this->getJson("/api/v1/reader/books/{$readerBook->id}")->assertOk();
    }
}
