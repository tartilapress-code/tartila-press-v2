<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Tumpukan sampul di hero beranda: sampul terbaru diunggah paling depan. */
class HeroCoversTest extends TestCase
{
    use RefreshDatabase;

    public function test_newest_uploaded_cover_comes_first(): void
    {
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'Tartila@2026']);
        $make = fn (string $title, ?string $cover, bool $active = true) => tap(
            Book::create(['title' => $title, 'price' => 50000, 'front_cover' => $cover, 'created_by' => $admin->id]),
            fn (Book $book) => $book->forceFill(['is_active' => $active])->save()
        );

        Carbon::setTestNow('2026-10-01 08:00:00');
        $old = $make('Buku Lama', 'https://example.com/lama.jpg');
        Carbon::setTestNow('2026-10-02 08:00:00');
        $make('Buku Baru', 'https://example.com/baru.jpg')->update(['authors' => ['Ani', 'Budi']]);
        $make('Tanpa Sampul', null);
        $make('Sampul Rusak', 'a');
        $make('Nonaktif', 'https://example.com/nonaktif.jpg', false);

        $this->getJson('/api/v1/books/hero-covers')
            ->assertOk()
            ->assertJsonPath('data.*.title', ['Buku Baru', 'Buku Lama'])
            ->assertJsonPath('data.0.authors', 'Ani, Budi')
            ->assertJsonPath('data.0.category', null);

        // Mengganti sampul buku lama membuatnya paling depan.
        Carbon::setTestNow('2026-10-03 08:00:00');
        $old->update(['front_cover' => 'https://example.com/lama-v2.jpg']);
        $old->update(['price' => 60000]); // perubahan lain tidak menggeser urutan

        $this->getJson('/api/v1/books/hero-covers')
            ->assertJsonPath('data.0.title', 'Buku Lama')
            ->assertJsonPath('data.0.front_cover', 'https://example.com/lama-v2.jpg')
            ->assertJsonMissingPath('data.0.created_by');

        Carbon::setTestNow();
    }
}
