<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\Book;
use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Event;
use App\Models\FieldCategory;
use App\Models\Package;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Rekomendasi: admin mem-pin maksimal 3 konten per menu; tampil paling atas di menu dan beranda. */
class RecommendationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['user', 'admin']);
    }

    private function makeUser(array $roles = ['user']): User
    {
        $user = User::create(['name' => 'User '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function package(string $name, bool $active = true): Package
    {
        return Package::create(['name' => $name, 'price' => 1000, 'is_active' => $active, 'created_by' => $this->admin->id]);
    }

    private function book(string $title, array $extra = []): Book
    {
        return Book::create($extra + ['title' => $title, 'price' => 1000, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
    }

    private function pin(string $section, array $ids)
    {
        Sanctum::actingAs($this->admin);

        return $this->putJson("/api/v1/admin/recommendations/{$section}", ['item_ids' => $ids]);
    }

    /** @return list<int> */
    private function ids(string $uri, string $path = 'data'): array
    {
        return collect($this->getJson($uri)->assertOk()->json($path))->pluck('id')->all();
    }

    public function test_only_admin_can_manage_recommendations(): void
    {
        $this->getJson('/api/v1/admin/recommendations')->assertUnauthorized();

        Sanctum::actingAs($this->makeUser(['user']));
        $this->getJson('/api/v1/admin/recommendations')->assertForbidden();
        $this->putJson('/api/v1/admin/recommendations/package', ['item_ids' => []])->assertForbidden();
    }

    public function test_pinned_packages_come_first_in_pin_order_and_are_marked(): void
    {
        $a = $this->package('A');
        $b = $this->package('B');
        $c = $this->package('C');
        $d = $this->package('D');   // dibuat terakhir = paling atas tanpa pin (latest)

        $this->pin('package', [$b->id, $a->id])->assertOk()
            ->assertJsonPath('data.0.id', $b->id)
            ->assertJsonPath('data.1.id', $a->id);

        $list = $this->getJson('/api/v1/packages')->assertOk()->json('data');

        $this->assertSame([$b->id, $a->id], array_slice(array_column($list, 'id'), 0, 2));
        $this->assertTrue($list[0]['is_recommended']);
        $this->assertTrue($list[1]['is_recommended']);
        $this->assertFalse($list[2]['is_recommended']);
        $this->assertContains($c->id, array_column($list, 'id'));
        $this->assertContains($d->id, array_column($list, 'id'));
    }

    public function test_at_most_three_distinct_and_visible_items_can_be_pinned(): void
    {
        $ids = collect(range(1, 4))->map(fn ($n) => $this->package("P{$n}")->id)->all();

        $this->pin('package', $ids)->assertStatus(422);
        $this->pin('package', [$ids[0], $ids[0]])->assertStatus(422);
        $this->pin('package', [999999])->assertStatus(422);

        $inactive = $this->package('Nonaktif', active: false);
        $this->pin('package', [$inactive->id])->assertStatus(422);

        $this->pin('package', [$ids[0], $ids[1], $ids[2]])->assertOk();
        $this->assertDatabaseCount('recommendations', 3);

        // Mengganti = menimpa seluruhnya; daftar kosong = mencabut semua.
        $this->pin('package', [$ids[3]])->assertOk();
        $this->assertDatabaseCount('recommendations', 1);
        $this->pin('package', [])->assertOk();
        $this->assertDatabaseCount('recommendations', 0);

        $this->pin('editor', [])->assertNotFound();
        $this->pin('tidak-ada', [])->assertNotFound();
    }

    public function test_a_pinned_item_that_becomes_inactive_disappears_from_the_public_list_but_the_admin_sees_it(): void
    {
        $a = $this->package('A');
        $b = $this->package('B');
        $this->pin('package', [$a->id, $b->id])->assertOk();

        $a->update(['is_active' => false]);

        $this->assertSame([$b->id], array_slice($this->ids('/api/v1/packages'), 0, 1));
        $this->assertNotContains($a->id, $this->ids('/api/v1/packages'));

        $summary = collect($this->getJson('/api/v1/admin/recommendations')->json('data'))->firstWhere('section', 'package');
        $this->assertFalse($summary['items'][0]['visible']);
        $this->assertTrue($summary['items'][1]['visible']);
    }

    public function test_pinned_services_lead_the_custom_item_list(): void
    {
        $x = CustomPackageItem::create(['type' => 'service', 'name' => 'Aaa', 'price' => 1]);
        $y = CustomPackageItem::create(['type' => 'facility', 'name' => 'Zzz', 'price' => 1]);

        $this->pin('service', [$y->id])->assertOk();

        $list = $this->getJson('/api/v1/custom-package-items')->assertOk()->json('data');
        $this->assertSame($y->id, $list[0]['id']);
        $this->assertTrue($list[0]['is_recommended']);
        $this->assertFalse($list[1]['is_recommended']);
        $this->assertSame($x->id, $list[1]['id']);
    }

    public function test_pinned_books_lead_every_page_and_still_respect_filters_and_the_home_limit(): void
    {
        $old = $this->book('Buku Lama', ['created_at' => now()->subYear()]);
        foreach (range(1, 5) as $n) {
            $this->book("Buku Baru {$n}");
        }

        $this->pin('book', [$old->id])->assertOk();

        // Beranda memakai ?per_page=4: buku yang dipin tetap di urutan pertama.
        $home = $this->getJson('/api/v1/books?per_page=4')->assertOk()->json('data');
        $this->assertSame($old->id, $home[0]['id']);
        $this->assertTrue($home[0]['is_recommended']);
        $this->assertCount(4, $home);

        // Pencarian: yang tidak cocok tidak ikut muncul walau di-pin.
        $this->assertNotContains($old->id, $this->ids('/api/v1/books?search=Baru'));
        $this->assertSame([$old->id], $this->ids('/api/v1/books?search=Lama'));

        // Halaman 2 tidak mengulang buku yang dipin.
        $second = $this->getJson('/api/v1/books?per_page=3&page=2')->json('data');
        $this->assertNotContains($old->id, array_column($second, 'id'));
    }

    public function test_pinned_events_and_articles_lead_their_lists_and_override_the_article_highlights(): void
    {
        $oldEvent = Event::create(['title' => 'Event Lama', 'starts_at' => now()->subMonths(3), 'is_active' => true, 'created_by' => $this->admin->id]);
        Event::create(['title' => 'Event Baru', 'starts_at' => now()->addMonth(), 'is_active' => true, 'created_by' => $this->admin->id]);
        $this->pin('event', [$oldEvent->id])->assertOk();

        $events = $this->getJson('/api/v1/events')->assertOk()->json('data');
        $this->assertSame($oldEvent->id, $events[0]['id']);
        $this->assertTrue($events[0]['is_recommended']);

        $field = FieldCategory::create(['name' => 'Bidang']);
        $make = fn (string $title, $when) => Article::create([
            'user_id' => $this->admin->id, 'title' => $title, 'field_category_id' => $field->id,
            'body' => 'Isi artikel uji yang cukup panjang.', 'status' => 'approved', 'published_at' => $when,
        ]);
        $oldest = $make('Artikel Tertua', now()->subYear());
        $mid = $make('Artikel Tengah', now()->subMonth());
        $make('Artikel Terbaru', now());

        // Tanpa pin: sorotan otomatis (terbaru dulu), pin tidak ada.
        $auto = $this->getJson('/api/v1/articles?highlight=1')->assertOk()->json('meta.highlights');
        $this->assertNotContains($oldest->id, array_column($auto, 'id'));

        // Dengan pin: sorotan = artikel yang dipin (urut posisi), dan tidak diulang di daftar.
        $this->pin('article', [$oldest->id, $mid->id])->assertOk();
        $page = $this->getJson('/api/v1/articles?highlight=1')->assertOk();
        $this->assertSame([$oldest->id, $mid->id], array_column($page->json('meta.highlights'), 'id'));
        $this->assertTrue($page->json('meta.highlights.0.is_recommended'));
        $this->assertNotContains($oldest->id, array_column($page->json('data'), 'id'));

        // Beranda (tanpa highlight): yang dipin paling atas.
        $home = $this->getJson('/api/v1/articles?per_page=3')->assertOk()->json('data');
        $this->assertSame([$oldest->id, $mid->id], array_slice(array_column($home, 'id'), 0, 2));
    }

    public function test_pinned_authors_lead_the_author_list(): void
    {
        $users = collect(['Ani', 'Budi', 'Citra'])->map(function (string $name) {
            $user = $this->makeUser(['user', 'penulis']);
            PublicProfile::create(['user_id' => $user->id, 'slug' => strtolower($name), 'pen_name' => $name, 'is_published' => true]);

            return $user;
        });

        $this->pin('author', [$users[2]->id])->assertOk();

        $list = $this->getJson('/api/v1/public/authors?role=penulis')->assertOk()->json('data');
        $this->assertSame('citra', $list[0]['slug']);
        $this->assertTrue($list[0]['is_recommended']);
        $this->assertFalse($list[1]['is_recommended']);

        // Hanya penulis berprofil terbit yang boleh dipin.
        $editor = $this->makeUser(['user', 'editor']);
        PublicProfile::create(['user_id' => $editor->id, 'slug' => 'ed', 'pen_name' => 'Ed', 'is_published' => true]);
        $this->pin('author', [$editor->id])->assertStatus(422);
    }

    public function test_the_editor_section_is_read_only_and_follows_the_editor_promotion(): void
    {
        $editor = $this->makeUser(['user', 'editor']);
        PublicProfile::create(['user_id' => $editor->id, 'slug' => 'edi', 'pen_name' => 'Edi', 'is_published' => true]);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 0, 'is_available' => true])
            ->forceFill(['is_promoted' => true, 'promoted_at' => now()])->save();

        Sanctum::actingAs($this->admin);
        $section = collect($this->getJson('/api/v1/admin/recommendations')->assertOk()->json('data'))->firstWhere('section', 'editor');

        $this->assertTrue($section['managed_elsewhere']);
        $this->assertSame($editor->id, $section['items'][0]['id']);

        $list = $this->getJson('/api/v1/public/authors?role=editor')->json('data');
        $this->assertTrue($list[0]['is_recommended']);
    }

    public function test_the_admin_summary_lists_all_eight_menus_and_search_filters_the_options(): void
    {
        $this->package('Paket Emas');
        $this->package('Paket Perak');

        Sanctum::actingAs($this->admin);
        $sections = collect($this->getJson('/api/v1/admin/recommendations')->assertOk()->json('data'))->pluck('section')->all();
        $this->assertSame(['service', 'package', 'book_chapter', 'book', 'author', 'event', 'article', 'editor'], $sections);

        $options = $this->getJson('/api/v1/admin/recommendations/package/options?search=emas')->assertOk()->json('data');
        $this->assertCount(1, $options);
        $this->assertSame('Paket Emas', $options[0]['title']);
    }
}
