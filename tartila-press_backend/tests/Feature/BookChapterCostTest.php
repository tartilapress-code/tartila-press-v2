<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Biaya HKI/ISBN/fasilitas, minimal biaya 1 buku, dan fee editor pada proyek
 * Book Chapter.
 */
class BookChapterCostTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->configureCosts();
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

    private function makeEditor(): User
    {
        $editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 50000, 'is_available' => true]);

        return $editor;
    }

    /**
     * Pengaturan admin: HKI 300rb, ISBN cetak 300rb, e-ISBN 200rb, minimal
     * sisa biaya 1 buku 500rb, diskon maksimal 10%.
     */
    private function configureCosts(array $overrides = []): void
    {
        BookChapterSetting::current()->update(array_merge([
            'min_chapters' => 2,
            'max_chapters' => null,
            'min_price' => 0,
            'max_discount' => 10,
            'hki_cost' => 300000,
            'isbn_print_cost' => 300000,
            'isbn_electronic_cost' => 200000,
            'min_book_cost' => 500000,
        ], $overrides));
    }

    private function makeItem(array $attributes = []): CustomPackageItem
    {
        return CustomPackageItem::create(array_merge([
            'type' => 'service',
            'name' => 'Item '.uniqid(),
            'price' => 100000,
        ], $attributes));
    }

    /** 3 bab × Rp 300.000 = Rp 900.000 (memenuhi minimal Rp 500.000). */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Antologi Cerita',
            'price' => 300000,
            'discount' => 0,
            'chapters' => [
                ['title' => 'Bab 1'],
                ['title' => 'Bab 2'],
                ['title' => 'Bab 3'],
            ],
        ], $overrides);
    }

    /** Proyek buatan editor (memenuhi minimal) — mengembalikan data proyek. */
    private function createEditorProject(User $editor, array $overrides = []): array
    {
        Sanctum::actingAs($editor);

        return $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload($overrides))
            ->assertStatus(201)
            ->json('data');
    }

    private function makeOrder(string $status): Order
    {
        $user = $this->makeUser(['penulis']);

        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $user->id,
            'status' => $status,
            'subtotal' => 300000,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 300000,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Pengaturan admin
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_save_the_cost_settings_and_editors_can_read_them(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 4,
            'min_price' => 100000,
            'max_discount' => 5,
            'hki_cost' => 250000,
            'isbn_print_cost' => 350000,
            'isbn_electronic_cost' => 150000,
            'min_book_cost' => 750000,
        ])
            ->assertOk()
            ->assertJsonPath('data.hki_cost', '250000.00')
            ->assertJsonPath('data.isbn_print_cost', '350000.00')
            ->assertJsonPath('data.isbn_electronic_cost', '150000.00')
            ->assertJsonPath('data.min_book_cost', '750000.00');

        Sanctum::actingAs($this->makeEditor());

        $this->getJson('/api/v1/editor/book-chapter-settings')
            ->assertOk()
            ->assertJsonPath('data.hki_cost', '250000.00')
            ->assertJsonPath('data.min_book_cost', '750000.00');
    }

    public function test_the_cost_settings_can_be_left_out_of_an_update(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 3,
            'min_price' => 0,
            'max_discount' => 10,
        ])
            ->assertOk()
            ->assertJsonPath('data.hki_cost', '300000.00')
            ->assertJsonPath('data.min_book_cost', '500000.00');
    }

    public function test_blank_cost_settings_are_saved_as_zero(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 2,
            'min_price' => 0,
            'max_discount' => 10,
            'hki_cost' => null,
            'min_book_cost' => null,
        ])
            ->assertOk()
            ->assertJsonPath('data.hki_cost', '0.00')
            ->assertJsonPath('data.min_book_cost', '0.00');
    }

    public function test_the_cost_settings_reject_negative_and_non_numeric_values(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $base = ['min_chapters' => 2, 'min_price' => 0, 'max_discount' => 10];

        $this->patchJson('/api/v1/admin/book-chapter-settings', $base + ['hki_cost' => -1])
            ->assertStatus(422)
            ->assertJsonPath('errors.hki_cost.0', 'Biaya HKI tidak boleh kurang dari 0.');

        $this->patchJson('/api/v1/admin/book-chapter-settings', $base + ['isbn_print_cost' => 99999999999999])
            ->assertStatus(422)
            ->assertJsonPath('errors.isbn_print_cost.0', 'Biaya ISBN cetak terlalu besar.');

        $this->patchJson('/api/v1/admin/book-chapter-settings', $base + ['min_book_cost' => 'banyak'])
            ->assertStatus(422)
            ->assertJsonPath('errors.min_book_cost.0', 'Minimal biaya 1 buku harus berupa angka.');
    }

    public function test_only_admins_can_change_the_cost_settings(): void
    {
        Sanctum::actingAs($this->makeEditor());

        $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 2,
            'min_price' => 0,
            'max_discount' => 10,
            'hki_cost' => 1,
        ])->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Biaya khusus Book Chapter pada item paket custom
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_set_a_book_chapter_cost_on_an_item_and_leave_it_blank_for_free(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $id = $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'facility',
            'name' => 'Cetak Buku',
            'price' => 500000,
            'book_chapter_cost' => 120000,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.book_chapter_cost', '120000.00')
            ->json('data.id');

        $this->patchJson("/api/v1/admin/custom-package-items/{$id}", ['book_chapter_cost' => null])
            ->assertOk()
            ->assertJsonPath('data.book_chapter_cost', null);

        $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'service',
            'name' => 'Editing',
            'price' => 100000,
        ])
            ->assertStatus(201)
            ->assertJsonPath('data.book_chapter_cost', null);

        $this->postJson('/api/v1/admin/custom-package-items', [
            'type' => 'service',
            'name' => 'Salah',
            'price' => 100000,
            'book_chapter_cost' => -5,
        ])->assertStatus(422)->assertJsonValidationErrors('book_chapter_cost');
    }

    public function test_the_book_chapter_cost_is_not_shown_on_the_public_item_list(): void
    {
        $this->makeItem(['name' => 'Cetak Buku', 'book_chapter_cost' => 123457]);

        $public = $this->getJson('/api/v1/custom-package-items')->assertOk();
        $public->assertJsonMissingPath('data.0.book_chapter_cost');
        $this->assertStringNotContainsString('123457', $public->getContent());

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->getJson('/api/v1/admin/custom-package-items')
            ->assertOk()
            ->assertJsonPath('data.0.book_chapter_cost', '123457.00');
    }

    public function test_editors_can_list_the_active_package_items_with_their_book_chapter_cost(): void
    {
        $this->makeItem(['name' => 'Aktif Berbiaya', 'type' => 'facility', 'book_chapter_cost' => 200000]);
        $this->makeItem(['name' => 'Aktif Gratis', 'type' => 'service']);
        $this->makeItem(['name' => 'Nonaktif', 'is_active' => false]);

        Sanctum::actingAs($this->makeEditor());

        $response = $this->getJson('/api/v1/editor/book-chapter-package-items')->assertOk();

        $items = collect($response->json('data'))->keyBy('name');
        $this->assertSame(['Aktif Berbiaya', 'Aktif Gratis'], $items->keys()->sort()->values()->all());
        $this->assertSame('200000.00', $items['Aktif Berbiaya']['book_chapter_cost']);
        $this->assertNull($items['Aktif Gratis']['book_chapter_cost']);
    }

    public function test_the_editor_package_items_list_is_for_editors_only(): void
    {
        $this->getJson('/api/v1/editor/book-chapter-package-items')->assertStatus(401);

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->getJson('/api/v1/editor/book-chapter-package-items')->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Editor membuat proyek: minimal biaya 1 buku
    |--------------------------------------------------------------------------
    */

    public function test_an_editor_cannot_create_a_project_when_the_remaining_cost_is_below_the_minimum(): void
    {
        Sanctum::actingAs($this->makeEditor());

        $response = $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'price' => 100000,
            'chapters' => [['title' => 'Bab 1'], ['title' => 'Bab 2']],
        ]));

        // 2 bab × 100.000 = 200.000; minimal 500.000 → kurang 300.000
        $response->assertStatus(422);
        $this->assertStringContainsString('Biaya 1 buku belum cukup', $response->json('message'));
        $this->assertStringContainsString('kurang Rp 300.000 dari minimal Rp 500.000', $response->json('message'));
        $this->assertStringContainsString('Tambah bab atau naikkan harga bab', $response->json('message'));
        $this->assertDatabaseCount('books', 0);
    }

    public function test_an_editor_can_create_a_project_that_meets_the_minimum(): void
    {
        Sanctum::actingAs($this->makeEditor());

        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.cost_summary.chapters_total', 900000)
            ->assertJsonPath('data.cost_summary.net', 900000)
            ->assertJsonPath('data.cost_summary.meets_minimum', true)
            ->assertJsonPath('data.cost_summary.shortfall', 0);
    }

    public function test_hki_and_isbn_choices_reduce_the_remaining_cost(): void
    {
        Sanctum::actingAs($this->makeEditor());

        // 900.000 − HKI 300.000 − ISBN cetak 300.000 = 300.000 < 500.000
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'includes_hki' => true,
            'includes_isbn_print' => true,
        ]))->assertStatus(422);

        // 900.000 − HKI 300.000 = 600.000 ≥ 500.000
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload(['includes_hki' => true]))
            ->assertStatus(201)
            ->assertJsonPath('data.includes_hki', true)
            ->assertJsonPath('data.includes_isbn_print', false)
            ->assertJsonPath('data.cost_summary.deductions.hki', 300000)
            ->assertJsonPath('data.cost_summary.net', 600000);
    }

    public function test_the_electronic_isbn_costs_less_than_the_print_isbn(): void
    {
        Sanctum::actingAs($this->makeEditor());

        // e-ISBN saja: 900.000 − 200.000 = 700.000 ✓
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload(['includes_isbn_electronic' => true]))
            ->assertStatus(201)
            ->assertJsonPath('data.cost_summary.deductions.isbn_electronic', 200000)
            ->assertJsonPath('data.cost_summary.net', 700000);

        // cetak + e-ISBN: 900.000 − 500.000 = 400.000 ✗
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'includes_isbn_print' => true,
            'includes_isbn_electronic' => true,
        ]))->assertStatus(422);
    }

    public function test_ticked_facilities_and_services_are_deducted_by_their_book_chapter_cost(): void
    {
        $facility = $this->makeItem(['type' => 'facility', 'name' => 'Cetak Buku', 'book_chapter_cost' => 200000]);
        $free = $this->makeItem(['type' => 'service', 'name' => 'Editing', 'book_chapter_cost' => null]);
        $costly = $this->makeItem(['type' => 'service', 'name' => 'Desain Premium', 'book_chapter_cost' => 500000]);

        Sanctum::actingAs($this->makeEditor());

        // 900.000 − 200.000 − (gratis) = 700.000 ✓
        $response = $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'package_item_ids' => [$facility->id, $free->id],
        ]))
            ->assertStatus(201)
            ->assertJsonCount(2, 'data.package_items')
            ->assertJsonPath('data.cost_summary.deductions.items', 200000)
            ->assertJsonPath('data.cost_summary.net', 700000);

        $this->assertDatabaseCount('book_package_items', 2);
        $this->assertDatabaseHas('book_package_items', [
            'book_id' => $response->json('data.id'),
            'custom_package_item_id' => $facility->id,
        ]);

        // 900.000 − 200.000 − 500.000 = 200.000 ✗
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'package_item_ids' => [$facility->id, $costly->id],
        ]))->assertStatus(422);
    }

    public function test_only_active_existing_items_can_be_ticked(): void
    {
        $inactive = $this->makeItem(['is_active' => false]);

        Sanctum::actingAs($this->makeEditor());

        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'package_item_ids' => [$inactive->id],
        ]))->assertStatus(422)->assertJsonValidationErrors('package_item_ids.0');

        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload([
            'package_item_ids' => [999999],
        ]))->assertStatus(422)->assertJsonValidationErrors('package_item_ids.0');
    }

    public function test_discount_does_not_change_whether_the_minimum_is_met(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $noDiscount = $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload(['discount' => 0]))
            ->assertStatus(201)
            ->json('data.cost_summary');

        $maxDiscount = $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload(['discount' => 10]))
            ->assertStatus(201)
            ->json('data.cost_summary');

        $this->assertEquals($noDiscount['net'], $maxDiscount['net']);
        $this->assertTrue($maxDiscount['meets_minimum']);
    }

    public function test_the_project_shows_the_fee_the_editor_can_earn(): void
    {
        Sanctum::actingAs($this->makeEditor());

        // diskon maksimal admin 10%, editor memberi 4% → fee 6% × 3 bab × Rp 300.000
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload(['discount' => 4]))
            ->assertStatus(201)
            ->assertJsonPath('data.cost_summary.max_discount', 10)
            ->assertJsonPath('data.cost_summary.fee_percent', 6)
            ->assertJsonPath('data.cost_summary.potential_fee', 54000);

        // tanpa diskon → seluruh diskon maksimal menjadi fee (10%)
        $this->postJson('/api/v1/editor/book-chapter-projects', $this->payload(['discount' => 0]))
            ->assertStatus(201)
            ->assertJsonPath('data.cost_summary.fee_percent', 10)
            ->assertJsonPath('data.cost_summary.potential_fee', 90000);
    }

    public function test_admin_can_create_a_project_below_the_minimum_and_sees_the_shortfall(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson('/api/v1/admin/book-chapter-projects', $this->payload([
            'price' => 100000,
            'chapters' => [['title' => 'Bab 1'], ['title' => 'Bab 2']],
        ]))
            ->assertStatus(201)
            ->assertJsonPath('data.cost_summary.meets_minimum', false)
            ->assertJsonPath('data.cost_summary.shortfall', 300000);
    }

    /*
    |--------------------------------------------------------------------------
    | Mengubah proyek & bab: hasil akhir tidak boleh di bawah minimal
    |--------------------------------------------------------------------------
    */

    public function test_an_editor_cannot_lower_the_price_below_the_minimum(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);

        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['price' => 100000])
            ->assertStatus(422);
        $this->assertDatabaseHas('books', ['id' => $project['id'], 'price' => 300000]);

        // 3 × 200.000 = 600.000 ≥ 500.000 → boleh
        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['price' => 200000])
            ->assertOk()
            ->assertJsonPath('data.cost_summary.net', 600000);

        // 3 × 150.000 = 450.000 < 500.000 → ditolak
        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['price' => 150000])
            ->assertStatus(422);
    }

    public function test_adding_hki_or_isbn_later_cannot_push_the_project_below_the_minimum(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);

        // 900.000 − 300.000 = 600.000 ✓
        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['includes_hki' => true])
            ->assertOk();

        // + ISBN cetak 300.000 → 300.000 ✗
        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['includes_isbn_print' => true])
            ->assertStatus(422);
        $this->assertDatabaseHas('books', ['id' => $project['id'], 'includes_isbn_print' => false]);

        // Melepas HKI selalu boleh (sisa biaya naik)
        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['includes_hki' => false])
            ->assertOk()
            ->assertJsonPath('data.cost_summary.net', 900000);
    }

    public function test_ticking_a_costly_item_later_cannot_push_the_project_below_the_minimum(): void
    {
        $costly = $this->makeItem(['book_chapter_cost' => 500000]);
        $cheap = $this->makeItem(['book_chapter_cost' => 100000]);

        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);

        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['package_item_ids' => [$costly->id]])
            ->assertStatus(422);

        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['package_item_ids' => [$cheap->id]])
            ->assertOk()
            ->assertJsonPath('data.cost_summary.deductions.items', 100000);

        $this->assertDatabaseHas('book_package_items', ['book_id' => $project['id'], 'custom_package_item_id' => $cheap->id]);

        // Kosongkan centang → fasilitas terlepas
        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['package_item_ids' => []])
            ->assertOk();
        $this->assertDatabaseCount('book_package_items', 0);
    }

    public function test_a_chapter_cannot_be_deleted_when_the_remaining_cost_would_be_too_low(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);
        $chapterId = $project['chapters'][0]['id'];

        // minimal dinaikkan admin: 900.000 masih cukup, tapi 600.000 tidak
        $this->configureCosts(['min_book_cost' => 800000]);

        $response = $this->deleteJson("/api/v1/editor/book-chapter-projects/chapters/{$chapterId}");
        $response->assertStatus(422);
        $this->assertStringContainsString('Perubahan ditolak', $response->json('message'));
        $this->assertDatabaseHas('book_chapters', ['id' => $chapterId]);

        // Minimal diturunkan → 600.000 cukup → boleh dihapus
        $this->configureCosts(['min_book_cost' => 500000]);
        $this->deleteJson("/api/v1/editor/book-chapter-projects/chapters/{$chapterId}")->assertOk();
        $this->assertDatabaseMissing('book_chapters', ['id' => $chapterId]);
    }

    public function test_a_chapter_price_can_go_up_but_not_below_the_minimum(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);
        [$first, $second] = [$project['chapters'][0]['id'], $project['chapters'][1]['id']];

        // 100.000 + 300.000 + 300.000 = 700.000 ✓
        $this->patchJson("/api/v1/editor/book-chapter-projects/chapters/{$first}", ['price' => 100000])
            ->assertOk();

        // 100.000 + 50.000 + 300.000 = 450.000 ✗
        $this->patchJson("/api/v1/editor/book-chapter-projects/chapters/{$second}", ['price' => 50000])
            ->assertStatus(422);

        // Menaikkan harga selalu boleh
        $this->patchJson("/api/v1/editor/book-chapter-projects/chapters/{$first}", ['price' => 400000])
            ->assertOk();

        // Judul saja (tanpa mengubah biaya) boleh
        $this->patchJson("/api/v1/editor/book-chapter-projects/chapters/{$second}", ['title' => 'Judul Baru'])
            ->assertOk();
    }

    public function test_adding_a_chapter_is_always_allowed(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);

        $this->postJson("/api/v1/editor/book-chapter-projects/{$project['id']}/chapters", ['title' => 'Bab 4'])
            ->assertStatus(201);
    }

    public function test_admin_is_bound_by_the_same_rules_when_changing_or_deleting_chapters(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);
        $chapterId = $project['chapters'][0]['id'];

        $this->configureCosts(['min_book_cost' => 800000]);
        Sanctum::actingAs($this->makeUser(['admin']));

        // 10.000 + 300.000 + 300.000 = 610.000 < 800.000
        $this->patchJson("/api/v1/admin/book-chapter-projects/chapters/{$chapterId}", ['price' => 10000])
            ->assertStatus(422);

        // hapus → 600.000 < 800.000
        $this->deleteJson("/api/v1/admin/book-chapter-projects/chapters/{$chapterId}")
            ->assertStatus(422);

        // ubah harga proyek → 3 × 200.000 = 600.000 < 800.000
        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['price' => 200000])
            ->assertStatus(422);

        // menaikkan tetap boleh
        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['price' => 350000])
            ->assertOk();
    }

    public function test_a_project_already_below_the_minimum_can_only_be_changed_for_the_better(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        // Dibuat admin sebelum aturan berlaku: 2 × 100.000 = 200.000 < 500.000
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->payload([
            'price' => 100000,
            'chapters' => [['title' => 'Bab 1'], ['title' => 'Bab 2']],
        ]))->assertStatus(201)->json('data');

        $chapterId = $project['chapters'][0]['id'];

        // Tidak memperburuk → boleh
        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['title' => 'Judul Baru'])->assertOk();
        $this->patchJson("/api/v1/admin/book-chapter-projects/chapters/{$chapterId}", ['title' => 'Bab Satu'])->assertOk();
        $this->postJson("/api/v1/admin/book-chapter-projects/{$project['id']}/chapters", ['title' => 'Bab 3'])->assertStatus(201);
        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['price' => 120000])->assertOk();

        // Memperburuk → ditolak
        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['price' => 100000])->assertStatus(422);
        $this->deleteJson("/api/v1/admin/book-chapter-projects/chapters/{$chapterId}")->assertStatus(422);
    }

    public function test_a_negative_remaining_cost_is_written_with_the_sign_before_the_currency(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        // 2 × 100.000 − HKI 300.000 = −100.000
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->payload([
            'price' => 100000,
            'includes_hki' => true,
            'chapters' => [['title' => 'Bab 1'], ['title' => 'Bab 2']],
        ]))->assertStatus(201)->json('data');

        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['price' => 50000])
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Perubahan ditolak: sisa biaya 1 buku menjadi -Rp 200.000, di bawah minimal Rp 500.000 (kurang Rp 700.000). Tambah bab atau naikkan harga bab terlebih dahulu.'
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Tampilan publik: fasilitas & layanan yang didapatkan
    |--------------------------------------------------------------------------
    */

    public function test_the_public_page_shows_the_facilities_and_services_that_were_ticked(): void
    {
        $facility = $this->makeItem(['type' => 'facility', 'name' => 'Cetak Buku', 'book_chapter_cost' => 123457]);
        $service = $this->makeItem(['type' => 'service', 'name' => 'Editing Naskah']);
        $this->makeItem(['type' => 'service', 'name' => 'Tidak Dicentang']);

        Sanctum::actingAs($this->makeUser(['admin']));
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->payload([
            'includes_hki' => true,
            'includes_isbn_electronic' => true,
            'package_item_ids' => [$facility->id, $service->id],
        ]))->assertStatus(201)->json('data');

        $response = $this->getJson("/api/v1/book-chapter-projects/{$project['id']}")->assertOk();

        $response->assertJsonPath('data.package_facilities', ['Cetak Buku']);
        $response->assertJsonPath('data.package_services', ['Editing Naskah']);
        $response->assertJsonPath('data.includes_hki', true);
        $response->assertJsonPath('data.includes_isbn_print', false);
        $response->assertJsonPath('data.includes_isbn_electronic', true);

        // Hanya nama — tidak ada biaya internal yang bocor
        $response->assertJsonMissingPath('data.package_items');
        $response->assertJsonMissingPath('data.cost_summary');
        $this->assertStringNotContainsString('123457', $response->getContent());
    }

    public function test_the_public_list_carries_the_included_package_too(): void
    {
        $facility = $this->makeItem(['type' => 'facility', 'name' => 'Cetak Buku']);

        Sanctum::actingAs($this->makeUser(['admin']));
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->payload([
            'package_item_ids' => [$facility->id],
        ]))->assertStatus(201)->json('data');

        $listed = collect($this->getJson('/api/v1/book-chapter-projects')->assertOk()->json('data'))
            ->firstWhere('id', $project['id']);

        $this->assertSame(['Cetak Buku'], $listed['package_facilities']);
        $this->assertSame([], $listed['package_services']);
        $this->assertArrayNotHasKey('package_items', $listed);
    }

    /*
    |--------------------------------------------------------------------------
    | Fee Saya: proyek Book Chapter milik editor
    |--------------------------------------------------------------------------
    */

    public function test_my_fee_includes_the_book_chapter_projects_the_editor_owns(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor, ['discount' => 4]);

        // Satu slot sudah dibayar (dikonfirmasi), satu masih menunggu pembayaran.
        BookChapter::whereKey($project['chapters'][0]['id'])->update(['order_id' => $this->makeOrder('confirmed')->id]);
        BookChapter::whereKey($project['chapters'][1]['id'])->update(['order_id' => $this->makeOrder('pending')->id]);

        // Proyek editor lain tidak ikut.
        $this->createEditorProject($this->makeEditor(), ['title' => 'Proyek Lain']);

        Sanctum::actingAs($editor);
        $response = $this->getJson('/api/v1/editor/fees')->assertOk();

        $projects = $response->json('data.projects');
        $this->assertCount(1, $projects);

        // 10% − 4% = 6% × Rp 300.000 = Rp 18.000 per bab
        $this->assertSame($project['id'], $projects[0]['id']);
        $this->assertSame(3, $projects[0]['chapter_count']);
        $this->assertSame(1, $projects[0]['sold_count']);
        $this->assertSame(6, $projects[0]['fee_percent']);
        $this->assertEquals(54000, $projects[0]['potential_fee']);
        $this->assertEquals(18000, $projects[0]['sold_fee']);
        $this->assertFalse($projects[0]['is_published']);

        $response->assertJsonPath('data.project_summary.count', 1);
        $this->assertEquals(54000, $response->json('data.project_summary.potential_fee'));
        $this->assertEquals(18000, $response->json('data.project_summary.sold_fee'));
    }

    public function test_a_published_project_is_flagged_as_published(): void
    {
        $editor = $this->makeEditor();
        $project = $this->createEditorProject($editor);
        Book::whereKey($project['id'])->update(['is_active' => true]);

        Sanctum::actingAs($editor);

        $this->getJson('/api/v1/editor/fees')
            ->assertOk()
            ->assertJsonPath('data.projects.0.is_published', true);
    }

    public function test_an_editor_without_projects_gets_an_empty_project_section(): void
    {
        Sanctum::actingAs($this->makeEditor());

        $this->getJson('/api/v1/editor/fees')
            ->assertOk()
            ->assertJsonPath('data.projects', [])
            ->assertJsonPath('data.project_summary.count', 0)
            ->assertJsonPath('data.project_summary.potential_fee', 0);
    }
}
