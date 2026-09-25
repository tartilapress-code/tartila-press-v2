<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManuscriptCoAuthorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

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

    private function makeConfirmedOrder(User $penulis, ?int $editorId = null, float $editorFee = 0): Order
    {
        $admin = $this->makeUser(['admin']);

        $package = Package::create([
            'name' => 'Paket Test',
            'price' => 1000000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $penulis->id,
            'status' => 'confirmed',
            'subtotal' => $package->price,
            'discount_total' => 0,
            'editor_id' => $editorId,
            'editor_fee' => $editorFee,
            'total' => $package->price + $editorFee,
        ]);
    }

    /**
     * @return array{order: Order, chapter: BookChapter, book: Book}
     */
    private function makeConfirmedBookChapterOrder(User $penulis): array
    {
        $owner = $this->makeUser(['editor']);

        $book = Book::create([
            'title' => 'Proyek Book Chapter Test',
            'price' => 100000,
            'discount' => 0,
            'is_chapter_offering' => true,
            'created_by' => $owner->id,
        ]);

        $chapter = BookChapter::create([
            'book_id' => $book->id,
            'chapter_number' => 1,
            'title' => 'Bab Satu',
        ]);

        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $penulis->id,
            'status' => 'confirmed',
            'subtotal' => 50000,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 50000,
        ]);

        $chapter->update(['order_id' => $order->id]);

        return ['order' => $order, 'chapter' => $chapter, 'book' => $book];
    }

    private function manuscriptFile(): UploadedFile
    {
        return UploadedFile::fake()->create('naskah.pdf', 500, 'application/pdf');
    }

    private function submitManuscript(
        User $submitter,
        Order $order,
        array $authorUserIds = [],
        ?string $title = 'Judul Buku'
    ): array {
        Sanctum::actingAs($submitter);

        $payload = ['order_id' => $order->id, 'file' => $this->manuscriptFile()];

        if ($title !== null) {
            $payload['title'] = $title;
        }

        if ($authorUserIds) {
            $payload['author_user_ids'] = $authorUserIds;
        }

        $response = $this->postJson('/api/v1/manuscripts', $payload);
        $response->assertStatus(201);

        return $response->json('data');
    }

    /**
     * Jalankan naskah 1-penulis dari 'submitted' sampai 'pending_penulis_review'
     * lewat alur admin+editor yang sudah ada (order harus sudah punya
     * editor_id pre-selected supaya admin auto-assign, bukan pending_editor_assignment).
     */
    private function advanceToPendingPenulisReview(Manuscript $manuscript, User $admin, User $editor): void
    {
        Sanctum::actingAs($admin);
        $penulisRevisionId = ManuscriptRevision::where('manuscript_id', $manuscript->id)
            ->latest('revision_number')->first()->id;
        // Editor dipilih langsung penulis → fee dari admin wajib diisi.
        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$penulisRevisionId}/review", [
            'decision' => 'approve',
            'fee' => 25000,
        ])->assertStatus(200);

        Sanctum::actingAs($editor);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/revisions", [
            'file' => $this->manuscriptFile(),
        ])->assertStatus(201);

        Sanctum::actingAs($admin);
        $editorRevisionId = ManuscriptRevision::where('manuscript_id', $manuscript->id)
            ->latest('revision_number')->first()->id;
        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$editorRevisionId}/review", [
            'decision' => 'approve',
        ])->assertStatus(200);
    }

    /*
    |--------------------------------------------------------------------------
    | Submit - Co-Author (paket non book chapter)
    |--------------------------------------------------------------------------
    */

    public function test_manuscript_authors_column_is_populated_from_linked_accounts(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulisA);

        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);

        $this->assertSame([$penulisA->name, $penulisB->name], $data['authors']);
        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $data['id'], 'user_id' => $penulisA->id, 'position' => 1,
        ]);
        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $data['id'], 'user_id' => $penulisB->id, 'position' => 2,
        ]);
    }

    public function test_submitter_is_auto_included_even_if_omitted(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);

        $data = $this->submitManuscript($penulis, $order);

        $this->assertSame([$penulis->name], $data['authors']);
        $this->assertDatabaseCount('manuscript_authors', 1);
        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $data['id'], 'user_id' => $penulis->id, 'position' => 1,
        ]);
    }

    public function test_submitter_can_reorder_self_among_co_authors(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulisA);

        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id, $penulisA->id]);

        $this->assertSame([$penulisB->name, $penulisA->name], $data['authors']);
        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $data['id'], 'user_id' => $penulisB->id, 'position' => 1,
        ]);
        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $data['id'], 'user_id' => $penulisA->id, 'position' => 2,
        ]);
    }

    public function test_non_book_chapter_order_requires_title(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);

        Sanctum::actingAs($penulis);
        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'file' => $this->manuscriptFile(),
        ]);

        $response->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Submit - Book Chapter (auto judul, single-author dipaksa)
    |--------------------------------------------------------------------------
    */

    public function test_book_chapter_order_forces_single_author_and_derives_title(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $intruder = $this->makeUser(['penulis']);
        ['order' => $order, 'chapter' => $chapter, 'book' => $book] = $this->makeConfirmedBookChapterOrder($penulis);

        Sanctum::actingAs($penulis);
        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Yang Seharusnya Diabaikan',
            'author_user_ids' => [$intruder->id],
            'file' => $this->manuscriptFile(),
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.title', $book->title.' — '.$chapter->title);

        $manuscriptId = $response->json('data.id');
        $this->assertDatabaseCount('manuscript_authors', 1);
        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $manuscriptId, 'user_id' => $penulis->id,
        ]);
        $this->assertDatabaseMissing('manuscript_authors', [
            'manuscript_id' => $manuscriptId, 'user_id' => $intruder->id,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Otorisasi - co-author manapun bisa lihat/upload
    |--------------------------------------------------------------------------
    */

    public function test_any_co_author_can_view_manuscript(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $stranger = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulisA);
        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);

        Sanctum::actingAs($penulisB);
        $this->getJson("/api/v1/manuscripts/{$data['id']}")->assertStatus(200);

        Sanctum::actingAs($stranger);
        $this->getJson("/api/v1/manuscripts/{$data['id']}")->assertStatus(403);
    }

    public function test_any_co_author_can_upload_revision(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulisA);
        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);

        Sanctum::actingAs($penulisB);
        $response = $this->postJson("/api/v1/manuscripts/{$data['id']}/revisions", [
            'file' => $this->manuscriptFile(),
            'note' => 'Revisi dari penulis kedua.',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('manuscript_revisions', [
            'manuscript_id' => $data['id'], 'uploaded_by' => $penulisB->id, 'role' => 'penulis',
        ]);
    }

    public function test_mine_scopes_to_any_linked_co_author(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulisA);
        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);

        Sanctum::actingAs($penulisB);
        $response = $this->getJson('/api/v1/manuscripts/mine');

        $response->assertStatus(200);
        $this->assertTrue(collect($response->json('data'))->pluck('id')->contains($data['id']));
    }

    public function test_show_response_includes_ordered_co_authors_with_approval_flags(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulisA);
        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);

        Sanctum::actingAs($penulisA);
        $response = $this->getJson("/api/v1/manuscripts/{$data['id']}");

        $response->assertStatus(200);
        $response->assertJsonPath('data.co_authors.0.id', $penulisA->id);
        $response->assertJsonPath('data.co_authors.0.has_approved', false);
        $response->assertJsonPath('data.co_authors.1.id', $penulisB->id);
        $response->assertJsonPath('data.co_authors.1.has_approved', false);
    }

    /*
    |--------------------------------------------------------------------------
    | Final Review - semua penulis wajib ACC
    |--------------------------------------------------------------------------
    */

    public function test_all_co_authors_must_approve_before_completion(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $editor = $this->makeEditor();
        $admin = $this->makeUser(['admin']);
        $order = $this->makeConfirmedOrder($penulisA, $editor->id, 50000);
        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);
        $manuscript = Manuscript::find($data['id']);

        $this->advanceToPendingPenulisReview($manuscript, $admin, $editor);
        $manuscript->refresh();
        $this->assertSame('pending_penulis_review', $manuscript->status);

        Sanctum::actingAs($penulisA);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/final-review", ['decision' => 'approve'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'pending_penulis_review');

        Sanctum::actingAs($penulisB);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/final-review", ['decision' => 'approve'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'completed');
    }

    public function test_any_co_author_revise_resets_all_approvals(): void
    {
        $penulisA = $this->makeUser(['penulis']);
        $penulisB = $this->makeUser(['penulis']);
        $editor = $this->makeEditor();
        $admin = $this->makeUser(['admin']);
        $order = $this->makeConfirmedOrder($penulisA, $editor->id, 50000);
        $data = $this->submitManuscript($penulisA, $order, [$penulisB->id]);
        $manuscript = Manuscript::find($data['id']);

        $this->advanceToPendingPenulisReview($manuscript, $admin, $editor);

        Sanctum::actingAs($penulisA);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/final-review", ['decision' => 'approve'])
            ->assertStatus(200);

        Sanctum::actingAs($penulisB);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/final-review", ['decision' => 'revise'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'in_editing');

        $this->assertDatabaseHas('manuscript_authors', [
            'manuscript_id' => $manuscript->id, 'user_id' => $penulisA->id, 'approved_at' => null,
        ]);
    }

    public function test_single_author_final_review_matches_legacy_behavior(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $editor = $this->makeEditor();
        $admin = $this->makeUser(['admin']);
        $order = $this->makeConfirmedOrder($penulis, $editor->id, 50000);
        $data = $this->submitManuscript($penulis, $order);
        $manuscript = Manuscript::find($data['id']);

        $this->advanceToPendingPenulisReview($manuscript, $admin, $editor);

        Sanctum::actingAs($penulis);
        $response = $this->postJson("/api/v1/manuscripts/{$manuscript->id}/final-review", [
            'decision' => 'approve',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'completed');
    }

    public function test_non_co_author_cannot_final_review(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $editor = $this->makeEditor();
        $admin = $this->makeUser(['admin']);
        $order = $this->makeConfirmedOrder($penulis, $editor->id, 50000);
        $data = $this->submitManuscript($penulis, $order);
        $manuscript = Manuscript::find($data['id']);

        $this->advanceToPendingPenulisReview($manuscript, $admin, $editor);

        Sanctum::actingAs($editor);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/final-review", ['decision' => 'approve'])
            ->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Pencarian Pengguna
    |--------------------------------------------------------------------------
    */

    public function test_user_search_excludes_self_and_caps_results(): void
    {
        $me = $this->makeUser(['penulis']);
        User::create(['name' => 'Zzz Nomatch', 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);

        for ($i = 0; $i < 12; $i++) {
            User::create([
                'name' => 'Searchable Author '.$i,
                'email' => uniqid('search').'@example.com',
                'password' => 'Tartila@2026',
            ]);
        }
        User::create(['name' => 'Searchable Author Me', 'email' => 'searchme@example.com', 'password' => 'Tartila@2026']);

        Sanctum::actingAs($me);
        $response = $this->getJson('/api/v1/users/search?q=Searchable');

        $response->assertStatus(200);
        $results = collect($response->json('data'));
        $this->assertLessThanOrEqual(10, $results->count());
        $this->assertFalse($results->pluck('id')->contains($me->id));
        $this->assertArrayNotHasKey('email', $results->first());
    }

    public function test_user_search_requires_minimum_query_length(): void
    {
        $me = $this->makeUser(['penulis']);

        Sanctum::actingAs($me);
        $this->getJson('/api/v1/users/search?q=a')->assertStatus(422);
    }
}
