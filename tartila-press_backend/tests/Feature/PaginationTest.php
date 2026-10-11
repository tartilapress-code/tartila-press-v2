<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\Book;
use App\Models\BookCategory;
use App\Models\BookChapter;
use App\Models\Order;
use App\Models\Package;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Daftar per halaman + filter/urutan di server (laporan uji performa, rekomendasi #3 & #4). */
class PaginationTest extends TestCase
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

    private function makeUser(array $roles = [], string $name = 'Penguji'): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function makeBook(string $title, array $attributes = []): Book
    {
        return Book::create($attributes + ['title' => $title, 'price' => 100000, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
    }

    public function test_catalog_is_paged_and_per_page_is_capped(): void
    {
        foreach (range(1, 5) as $n) {
            $this->makeBook("Buku {$n}");
        }

        $first = $this->getJson('/api/v1/books?per_page=2')->assertOk();
        $first->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 5)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('data.0.title', 'Buku 5');

        $this->getJson('/api/v1/books?per_page=2&page=3')->assertJsonCount(1, 'data');
        // Beranda: hanya 4 buku terbaru yang diminta.
        $this->getJson('/api/v1/books?per_page=4')->assertJsonCount(4, 'data');
        $this->getJson('/api/v1/books?per_page=5000')->assertJsonPath('meta.per_page', 100);
    }

    public function test_book_chapter_projects_filter_sort_and_list_all_categories(): void
    {
        $monograf = BookCategory::create(['name' => 'Monograf']);
        $ajar = BookCategory::create(['name' => 'Buku Ajar']);

        $cheap = $this->makeBook('Murah', ['is_chapter_offering' => true, 'book_category_id' => $monograf->id, 'price' => 50000]);
        $pricey = $this->makeBook('Mahal', ['is_chapter_offering' => true, 'book_category_id' => $ajar->id, 'price' => 300000]);
        BookChapter::create(['book_id' => $cheap->id, 'chapter_number' => 1, 'title' => 'Bab 1']);
        foreach ([1, 2, 3] as $number) {
            BookChapter::create(['book_id' => $pricey->id, 'chapter_number' => $number, 'title' => "Bab {$number}"]);
        }

        $this->getJson('/api/v1/book-chapter-projects?sort=price')
            ->assertJsonPath('data.0.title', 'Murah')
            ->assertJsonPath('meta.categories', ['Buku Ajar', 'Monograf']);
        $this->getJson('/api/v1/book-chapter-projects?sort=slots')->assertJsonPath('data.0.title', 'Mahal');
        $this->getJson('/api/v1/book-chapter-projects?category=Monograf')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.categories', ['Buku Ajar', 'Monograf']);
        $this->getJson('/api/v1/book-chapter-projects?search=mah')->assertJsonPath('data.0.title', 'Mahal');
    }

    public function test_article_highlights_are_separate_and_not_repeated(): void
    {
        $writer = $this->makeUser(['penulis']);
        foreach (range(1, 4) as $n) {
            Article::create(['user_id' => $writer->id, 'title' => "Artikel {$n}", 'slug' => "artikel-{$n}", 'body' => 'Isi.', 'status' => 'approved', 'published_at' => now()->subDays(10 - $n)]);
        }

        $response = $this->getJson('/api/v1/articles?highlight=1')->assertOk();
        $highlightIds = collect($response->json('meta.highlights'))->pluck('id');
        $listIds = collect($response->json('data'))->pluck('id');

        $this->assertSame('Artikel 4', $response->json('meta.highlights.0.title'));
        $this->assertCount(2, $highlightIds);
        $this->assertEmpty($highlightIds->intersect($listIds));
        $this->assertSame(2, $response->json('meta.total'));

        // Beranda: tanpa sorotan, 3 artikel terbaru.
        $this->getJson('/api/v1/articles?per_page=3')->assertJsonCount(3, 'data')->assertJsonPath('meta.highlights', []);
        $this->getJson('/api/v1/articles?search=artikel 2&highlight=1')->assertJsonCount(1, 'data')->assertJsonPath('meta.highlights', []);
    }

    public function test_people_directory_searches_and_sorts_by_display_name(): void
    {
        foreach (['Zaki', 'Ani', 'Budi'] as $name) {
            $user = $this->makeUser(['penulis'], $name);
            PublicProfile::create(['user_id' => $user->id, 'slug' => strtolower($name), 'pen_name' => $name, 'is_published' => true]);
        }

        $this->getJson('/api/v1/public/authors?role=penulis&sort=az')->assertJsonPath('data.0.name', 'Ani')->assertJsonPath('meta.total', 3);
        $this->getJson('/api/v1/public/authors?role=penulis&sort=za')->assertJsonPath('data.0.name', 'Zaki');
        $this->getJson('/api/v1/public/authors?role=penulis&search=bud')->assertJsonCount(1, 'data');
    }

    public function test_admin_orders_are_filtered_by_category_with_counts(): void
    {
        $buyer = $this->makeUser(['user']);
        $book = $this->makeBook('Buku Pesanan');
        $package = Package::create(['name' => 'Paket', 'price' => 1500000, 'discount' => 0, 'created_by' => $this->admin->id]);

        foreach ([[$book, 'pending'], [$book, 'confirmed'], [$package, 'pending']] as [$item, $status]) {
            $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $buyer->id, 'status' => $status, 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
            $order->items()->create(['itemable_type' => $item::class, 'itemable_id' => $item->id, 'name' => 'x', 'quantity' => 1, 'unit_price' => 1, 'subtotal' => 1]);
        }

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/v1/admin/orders?category=book')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.counts', ['book' => 2, 'package' => 1, 'book_chapter' => 0, 'event' => 0]);
        $this->getJson('/api/v1/admin/orders?category=book&status=confirmed')->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/orders?category=book&sort=status_desc')->assertJsonPath('data.0.status', 'confirmed');
    }

    public function test_discounts_tab_is_paged_but_target_picker_gets_the_full_list(): void
    {
        foreach (range(1, 3) as $n) {
            $this->makeBook("Diskon {$n}", ['discount' => $n === 1 ? 10 : 0]);
        }

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/v1/admin/discounts')->assertJsonCount(3, 'data')->assertJsonMissingPath('meta');
        $this->getJson('/api/v1/admin/discounts?page=1&per_page=2')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.active_count', 1);
        $this->getJson('/api/v1/admin/discounts?page=1&status=active')->assertJsonCount(1, 'data');
    }
}
