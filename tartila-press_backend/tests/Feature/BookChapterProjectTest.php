<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookChapterProjectTest extends TestCase
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

    private function makeEditor(): User
    {
        $editor = $this->makeUser(['editor']);

        EditorProfile::create([
            'user_id' => $editor->id,
            'fee' => 50000,
            'is_available' => true,
        ]);

        return $editor;
    }

    private function projectPayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Antologi Cerita Pendek',
            'price' => 100000,
            'discount' => 0,
            'chapters' => [
                ['title' => 'Bab 1'],
                ['title' => 'Bab 2'],
            ],
        ], $overrides);
    }

    /*
    |--------------------------------------------------------------------------
    | Create Project - Admin & Editor
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_create_book_chapter_project_with_chapters(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload());

        $response->assertStatus(201);
        $response->assertJsonPath('data.is_chapter_offering', true);
        $response->assertJsonCount(2, 'data.chapters');

        $this->assertDatabaseHas('books', [
            'title' => 'Antologi Cerita Pendek',
            'is_editor_created' => false,
        ]);
    }

    public function test_admin_cannot_create_project_with_price_exceeding_column_limit(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload([
            'price' => 600000000000,
        ]));

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('price');
    }

    public function test_editor_can_create_own_book_chapter_project_within_limits(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $response = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload());

        $response->assertStatus(201);
        $this->assertDatabaseHas('books', [
            'title' => 'Antologi Cerita Pendek',
            'is_editor_created' => true,
            'owner_editor_id' => $editor->id,
            'created_by' => $editor->id,
        ]);
    }

    public function test_editor_cannot_create_project_below_minimum_chapters(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $response = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload([
            'chapters' => [['title' => 'Bab 1']],
        ]));

        $response->assertStatus(422);
    }

    public function test_editor_cannot_create_project_with_price_below_minimum(): void
    {
        BookChapterSetting::current()->update(['min_price' => 50000]);

        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $response = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload([
            'price' => 10000,
        ]));

        $response->assertStatus(422);
    }

    public function test_editor_cannot_create_project_with_discount_above_maximum(): void
    {
        BookChapterSetting::current()->update(['max_discount' => 20]);

        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);

        $response = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload([
            'discount' => 50,
        ]));

        $response->assertStatus(422);
    }

    public function test_editor_cannot_manage_another_editors_project(): void
    {
        $ownerEditor = $this->makeEditor();
        Sanctum::actingAs($ownerEditor);
        $project = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload())
            ->json('data');

        $strangerEditor = $this->makeEditor();
        Sanctum::actingAs($strangerEditor);

        $this->patchJson("/api/v1/editor/book-chapter-projects/{$project['id']}", ['price' => 200000])
            ->assertStatus(403);

        $this->postJson("/api/v1/editor/book-chapter-projects/{$project['id']}/chapters", ['title' => 'Bab Baru'])
            ->assertStatus(403);
    }

    public function test_admin_can_manage_any_editors_project(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);
        $project = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload())
            ->json('data');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/book-chapter-projects/{$project['id']}", ['price' => 250000])
            ->assertStatus(200)
            ->assertJsonPath('data.price', '250000.00');
    }

    /*
    |--------------------------------------------------------------------------
    | Public Listing
    |--------------------------------------------------------------------------
    */

    public function test_public_can_browse_open_book_chapter_projects_and_hides_full_or_past_deadline_ones(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $open = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload(['title' => 'Proyek Terbuka']))
            ->json('data');

        $expired = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload([
            'title' => 'Proyek Lewat Deadline',
            'submission_deadline' => now()->subDay()->toDateTimeString(),
        ]))->json('data');

        $response = $this->getJson('/api/v1/book-chapter-projects');

        $response->assertStatus(200);
        $titles = collect($response->json('data'))->pluck('title');
        $this->assertTrue($titles->contains('Proyek Terbuka'));
        $this->assertFalse($titles->contains('Proyek Lewat Deadline'));
    }

    public function test_public_book_chapter_project_detail_shows_slot_status(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->json('data');

        $response = $this->getJson("/api/v1/book-chapter-projects/{$project['id']}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.chapters.0.slot_status', 'open');
    }

    public function test_guest_cannot_see_description_or_sop_but_sees_chapter_titles_and_prices(): void
    {
        $editor = $this->makeEditor();

        $book = Book::create([
            'title' => 'Antologi Rahasia',
            'description' => 'Deskripsi lengkap yang hanya untuk member.',
            'price' => 100000,
            'discount' => 0,
            'is_chapter_offering' => true,
            'created_by' => $editor->id,
            'owner_editor_id' => $editor->id,
        ]);

        BookChapter::create([
            'book_id' => $book->id,
            'chapter_number' => 1,
            'title' => 'Bab Satu',
            'price' => 50000,
            'sop_terms' => 'Naskah wajib orisinal dan belum pernah dipublikasikan.',
        ]);

        $index = $this->getJson('/api/v1/book-chapter-projects');
        $index->assertStatus(200);
        $indexProject = collect($index->json('data'))->firstWhere('id', $book->id);
        $this->assertArrayNotHasKey('description', $indexProject);
        $this->assertArrayNotHasKey('sop_terms', $indexProject['chapters'][0]);
        $this->assertSame('Bab Satu', $indexProject['chapters'][0]['title']);

        $show = $this->getJson("/api/v1/book-chapter-projects/{$book->id}");
        $show->assertStatus(200);
        $show->assertJsonMissingPath('data.description');
        $show->assertJsonMissingPath('data.chapters.0.sop_terms');
        $show->assertJsonPath('data.chapters.0.title', 'Bab Satu');
        $show->assertJsonPath('data.chapters.0.final_price', 50000);
    }

    public function test_logged_in_user_can_see_description_and_sop(): void
    {
        $editor = $this->makeEditor();

        $book = Book::create([
            'title' => 'Antologi Terbuka',
            'description' => 'Deskripsi lengkap yang hanya untuk member.',
            'price' => 100000,
            'discount' => 0,
            'is_chapter_offering' => true,
            'created_by' => $editor->id,
            'owner_editor_id' => $editor->id,
        ]);

        BookChapter::create([
            'book_id' => $book->id,
            'chapter_number' => 1,
            'title' => 'Bab Satu',
            'price' => 50000,
            'sop_terms' => 'Naskah wajib orisinal dan belum pernah dipublikasikan.',
        ]);

        Sanctum::actingAs($this->makeUser());

        $show = $this->getJson("/api/v1/book-chapter-projects/{$book->id}");
        $show->assertStatus(200);
        $show->assertJsonPath('data.description', 'Deskripsi lengkap yang hanya untuk member.');
        $show->assertJsonPath(
            'data.chapters.0.sop_terms',
            'Naskah wajib orisinal dan belum pernah dipublikasikan.'
        );

        $index = $this->getJson('/api/v1/book-chapter-projects');
        $index->assertStatus(200);
        $indexProject = collect($index->json('data'))->firstWhere('id', $book->id);
        $this->assertSame('Deskripsi lengkap yang hanya untuk member.', $indexProject['description']);
        $this->assertSame(
            'Naskah wajib orisinal dan belum pernah dipublikasikan.',
            $indexProject['chapters'][0]['sop_terms']
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Beli Slot (Order)
    |--------------------------------------------------------------------------
    */

    public function test_writer_can_order_open_chapter_slot_and_it_reserves_the_slot(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $penulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($penulis);

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('book_chapters', [
            'id' => $chapterId,
            'order_id' => $response->json('data.id'),
        ]);
    }

    public function test_cannot_order_already_reserved_or_filled_chapter_slot(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $firstPenulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($firstPenulis);
        $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ])->assertStatus(201);

        $secondPenulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($secondPenulis);
        $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ])->assertStatus(422);
    }

    public function test_cancelling_order_releases_unfilled_chapter_slot(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $penulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($penulis);
        $order = $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ])->json('data');

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$order['id']}/status", ['status' => 'cancelled'])
            ->assertStatus(200);

        $this->assertDatabaseHas('book_chapters', [
            'id' => $chapterId,
            'order_id' => null,
        ]);
    }

    public function test_editor_can_self_purchase_a_slot_in_their_own_project(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);
        $project = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $response = $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ]);

        $response->assertStatus(201);
    }

    /*
    |--------------------------------------------------------------------------
    | Submit Naskah & Auto-Assign Editor
    |--------------------------------------------------------------------------
    */

    public function test_writer_can_submit_manuscript_against_chapter_slot_order_and_it_links_the_chapter(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $penulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($penulis);
        $order = $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ])->json('data');

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$order['id']}/status", ['status' => 'confirmed']);

        Sanctum::actingAs($penulis);
        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order['id'],
            'title' => 'Bab Pertama',
            'authors' => [$penulis->name],
            'file' => UploadedFile::fake()->create('naskah.pdf', 100, 'application/pdf'),
        ]);

        $response->assertStatus(201);
        $manuscriptId = $response->json('data.id');

        $this->assertDatabaseHas('book_chapters', [
            'id' => $chapterId,
            'manuscript_id' => $manuscriptId,
        ]);

        $book = Book::find($project['id']);
        $this->assertSame([$penulis->name], $book->authors);
    }

    public function test_admin_approving_first_revision_auto_assigns_project_owner_editor_when_present(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);
        $project = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $penulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($penulis);
        $order = $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ])->json('data');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$order['id']}/status", ['status' => 'confirmed']);

        Sanctum::actingAs($penulis);
        $manuscript = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order['id'],
            'title' => 'Bab Pertama',
            'authors' => [$penulis->name],
            'file' => UploadedFile::fake()->create('naskah.pdf', 100, 'application/pdf'),
        ])->json('data');

        $revisionId = $manuscript['revisions'][0]['id'];

        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscript['id']}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        )->assertStatus(200);

        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscript['id'],
            'status' => 'in_editing',
            'editor_id' => $editor->id,
            'editor_fee' => 0,
        ]);
    }

    public function test_admin_approving_first_revision_falls_back_to_pending_editor_assignment_when_no_owner_editor(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $project = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->json('data');
        $chapterId = $project['chapters'][0]['id'];

        $penulis = $this->makeUser(['penulis']);
        Sanctum::actingAs($penulis);
        $order = $this->postJson('/api/v1/orders', [
            'type' => 'book_chapter',
            'book_chapter_id' => $chapterId,
        ])->json('data');

        Sanctum::actingAs($admin);
        $this->patchJson("/api/v1/admin/orders/{$order['id']}/status", ['status' => 'confirmed']);

        Sanctum::actingAs($penulis);
        $manuscript = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order['id'],
            'title' => 'Bab Pertama',
            'authors' => [$penulis->name],
            'file' => UploadedFile::fake()->create('naskah.pdf', 100, 'application/pdf'),
        ])->json('data');

        $revisionId = $manuscript['revisions'][0]['id'];

        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscript['id']}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        )->assertStatus(200);

        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscript['id'],
            'status' => 'pending_editor_assignment',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Bulk Import CSV
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_bulk_import_book_chapter_projects_via_csv(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $csv = "title,price,discount,chapter_count\nBuku Impor Satu,100000,10,3\nBuku Impor Dua,50000,0,2\n";
        $file = UploadedFile::fake()->createWithContent('import.csv', $csv);

        $response = $this->postJson('/api/v1/admin/book-chapter-projects/bulk-import', [
            'file' => $file,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.created', 2);

        $this->assertDatabaseHas('books', ['title' => 'Buku Impor Satu']);
        $this->assertDatabaseHas('books', ['title' => 'Buku Impor Dua']);
        $this->assertDatabaseCount('book_chapters', 5);
    }

    public function test_bulk_import_reports_row_errors_without_failing_whole_batch(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $csv = "title,price\nBuku Valid,100000\n,50000\n";
        $file = UploadedFile::fake()->createWithContent('import.csv', $csv);

        $response = $this->postJson('/api/v1/admin/book-chapter-projects/bulk-import', [
            'file' => $file,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.created', 1);
        $this->assertCount(1, $response->json('data.errors'));
    }

    public function test_bulk_import_reports_error_for_row_with_price_exceeding_column_limit(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $csv = "title,price\nBuku Valid,100000\nBuku Kemahalan,600000000000\n";
        $file = UploadedFile::fake()->createWithContent('import.csv', $csv);

        $response = $this->postJson('/api/v1/admin/book-chapter-projects/bulk-import', [
            'file' => $file,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.created', 1);
        $this->assertCount(1, $response->json('data.errors'));
        $this->assertDatabaseMissing('books', ['title' => 'Buku Kemahalan']);
    }

    /*
    |--------------------------------------------------------------------------
    | Revert Expired Command
    |--------------------------------------------------------------------------
    */

    public function test_artisan_command_reverts_owner_editor_when_deadline_passed_and_project_not_full(): void
    {
        $editor = $this->makeEditor();
        Sanctum::actingAs($editor);
        $project = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload([
            'submission_deadline' => now()->subDay()->toDateTimeString(),
        ]))->json('data');

        $this->artisan('book-chapters:revert-expired')->assertSuccessful();

        $this->assertDatabaseHas('books', [
            'id' => $project['id'],
            'owner_editor_id' => null,
        ]);
    }

    public function test_artisan_command_does_not_revert_admin_created_or_already_full_projects(): void
    {
        $admin = $this->makeUser(['admin']);
        $editor = $this->makeEditor();
        Sanctum::actingAs($admin);

        // Admin-created project with an owner editor and a past deadline — should NOT revert.
        $adminProject = $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload([
            'title' => 'Proyek Admin',
            'owner_editor_id' => $editor->id,
            'submission_deadline' => now()->subDay()->toDateTimeString(),
        ]))->json('data');

        // Editor-created project, past deadline, but fully filled — should NOT revert.
        Sanctum::actingAs($editor);
        $fullProject = $this->postJson('/api/v1/editor/book-chapter-projects', $this->projectPayload([
            'title' => 'Proyek Penuh',
            'submission_deadline' => now()->subDay()->toDateTimeString(),
        ]))->json('data');

        // Fill every chapter with a manuscript via direct DB write (no full workflow needed for this check).
        $penulis = $this->makeUser(['penulis']);
        foreach ($fullProject['chapters'] as $chapter) {
            $order = Order::create([
                'order_number' => 'ORD-'.uniqid(),
                'user_id' => $penulis->id,
                'status' => 'confirmed',
                'subtotal' => 0,
                'discount_total' => 0,
                'editor_fee' => 0,
                'total' => 0,
            ]);

            $manuscript = Manuscript::create([
                'order_id' => $order->id,
                'user_id' => $penulis->id,
                'title' => 'Naskah',
                'authors' => [$penulis->name],
                'status' => 'in_editing',
            ]);

            BookChapter::find($chapter['id'])->update(['manuscript_id' => $manuscript->id]);
        }

        $this->artisan('book-chapters:revert-expired')->assertSuccessful();

        $this->assertDatabaseHas('books', [
            'id' => $adminProject['id'],
            'owner_editor_id' => $editor->id,
        ]);

        $this->assertDatabaseHas('books', [
            'id' => $fullProject['id'],
            'owner_editor_id' => $editor->id,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Settings
    |--------------------------------------------------------------------------
    */

    public function test_admin_settings_can_be_read_and_updated(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/book-chapter-settings')->assertStatus(200);

        $response = $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 3,
            'min_price' => 20000,
            'max_discount' => 30,
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.min_chapters', 3);

        $this->assertDatabaseHas('book_chapter_settings', [
            'id' => 1,
            'min_chapters' => 3,
        ]);
    }

    public function test_settings_min_price_exceeding_column_limit_is_rejected(): void
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->patchJson('/api/v1/admin/book-chapter-settings', [
            'min_chapters' => 2,
            'min_price' => 600000000000,
            'max_discount' => 30,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('min_price');
    }

    public function test_non_admin_cannot_manage_book_chapter_projects_or_settings(): void
    {
        $user = $this->makeUser(['user']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/admin/book-chapter-projects', $this->projectPayload())
            ->assertStatus(403);

        $this->getJson('/api/v1/admin/book-chapter-settings')
            ->assertStatus(403);
    }
}
