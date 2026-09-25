<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\EditorProfile;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManuscriptWorkflowTest extends TestCase
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

    private function manuscriptFile(): UploadedFile
    {
        return UploadedFile::fake()->create('naskah.pdf', 500, 'application/pdf');
    }

    /*
    |--------------------------------------------------------------------------
    | Submit
    |--------------------------------------------------------------------------
    */

    public function test_penulis_can_submit_manuscript_for_confirmed_order(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A', 'Penulis B'],
            'file' => $this->manuscriptFile(),
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
        ]);

        $this->assertDatabaseHas('manuscript_revisions', [
            'revision_number' => 1,
            'role' => 'penulis',
        ]);
    }

    public function test_cannot_submit_manuscript_for_a_book_purchase_order(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $admin = $this->makeUser(['admin']);

        $book = Book::create([
            'title' => 'Buku Test',
            'price' => 100000,
            'created_by' => $admin->id,
        ]);

        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $penulis->id,
            'status' => 'confirmed',
            'subtotal' => $book->price,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => $book->price,
        ]);

        $order->items()->create([
            'itemable_type' => Book::class,
            'itemable_id' => $book->id,
            'name' => $book->title,
            'quantity' => 1,
            'unit_price' => $book->price,
            'subtotal' => $book->price,
        ]);

        Sanctum::actingAs($penulis);

        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);

        $response->assertStatus(422);
    }

    public function test_cannot_submit_manuscript_for_unconfirmed_order(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        $order->update(['status' => 'pending']);
        Sanctum::actingAs($penulis);

        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);

        $response->assertStatus(422);
    }

    public function test_cannot_submit_manuscript_twice_for_same_order(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ])->assertStatus(201);

        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku Lagi',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);

        $response->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Review - Revisi Penulis
    |--------------------------------------------------------------------------
    */

    public function test_admin_reject_sends_manuscript_back_to_penulis(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);

        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $response = $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'reject', 'note' => 'Format naskah belum sesuai.']
        );

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'revision_requested');

        $this->assertDatabaseHas('manuscript_revisions', [
            'id' => $revisionId,
            'admin_status' => 'rejected',
            'admin_note' => 'Format naskah belum sesuai.',
        ]);

        // Penulis can now upload revision 2.
        Sanctum::actingAs($penulis);
        $revisionResponse = $this->postJson(
            "/api/v1/manuscripts/{$manuscriptId}/revisions",
            ['file' => $this->manuscriptFile()]
        );

        $revisionResponse->assertStatus(201);
        $revisionResponse->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('manuscript_revisions', [
            'manuscript_id' => $manuscriptId,
            'revision_number' => 2,
            'role' => 'penulis',
        ]);
    }

    public function test_admin_approve_with_pre_selected_editor_auto_assigns(): void
    {
        $editor = $this->makeUser(['editor']);
        EditorProfile::create([
            'user_id' => $editor->id,
            'fee' => 150000,
            'is_available' => true,
        ]);

        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis, $editor->id, 150000);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);

        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        // Editor dipilih langsung penulis: admin tetap mengisi fee-nya, dan
        // total fee = fee permintaan editor (150.000) + fee admin (50.000).
        $response = $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve', 'fee' => 50000]
        );

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'in_editing');

        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscriptId,
            'editor_id' => $editor->id,
            'status' => 'in_editing',
            'editor_source' => 'author',
            'editor_requested_fee' => 150000,
            'editor_fee' => 200000,
        ]);
    }

    public function test_admin_approve_without_pre_selected_editor_waits_for_assignment(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);

        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        )->assertJsonPath('data.status', 'pending_editor_assignment');
    }

    /*
    |--------------------------------------------------------------------------
    | Admin Assign Editor Manual
    |--------------------------------------------------------------------------
    */

    public function test_admin_can_assign_editor_manually(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 200000]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        );

        $response = $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/assign-editor",
            [
                'editor_id' => $editor->id,
                'fee' => 200000,
                'deadline' => now()->addDays(14)->toDateString(),
                'note' => 'Tolong selesai dalam 2 minggu.',
            ]
        );

        $response->assertStatus(200);
        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscriptId,
            'editor_id' => $editor->id,
            'status' => 'in_editing',
        ]);
    }

    public function test_assign_editor_fee_exceeding_column_limit_is_rejected(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 200000]);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        );

        $response = $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/assign-editor",
            [
                'editor_id' => $editor->id,
                'fee' => 600000000000,
            ]
        );

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('fee');
    }

    /*
    |--------------------------------------------------------------------------
    | Open Pool & Claim
    |--------------------------------------------------------------------------
    */

    public function test_editor_can_claim_from_pool_and_second_editor_cannot(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        );

        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/open-pool", [
            'fee' => 175000,
        ])->assertStatus(200);

        $editorA = $this->makeUser(['editor']);
        Sanctum::actingAs($editorA);

        $poolResponse = $this->getJson('/api/v1/editor/manuscript-pool');
        $poolResponse->assertStatus(200);
        $this->assertCount(1, $poolResponse->json('data'));

        $claimResponse = $this->postJson("/api/v1/editor/manuscript-pool/{$manuscriptId}/claim");
        $claimResponse->assertStatus(200);

        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscriptId,
            'editor_id' => $editorA->id,
            'open_for_claim' => 0,
            'status' => 'in_editing',
        ]);

        $editorB = $this->makeUser(['editor']);
        Sanctum::actingAs($editorB);

        $secondClaim = $this->postJson("/api/v1/editor/manuscript-pool/{$manuscriptId}/claim");
        $secondClaim->assertStatus(422);
    }

    /*
    |--------------------------------------------------------------------------
    | Editor Upload -> Admin Review -> Penulis Final Review
    |--------------------------------------------------------------------------
    */

    public function test_full_editor_to_final_review_flow(): void
    {
        $editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 150000, 'is_available' => true]);

        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis, $editor->id, 150000);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve', 'fee' => 50000]
        )->assertJsonPath('data.status', 'in_editing');

        // Editor uploads their edit.
        Sanctum::actingAs($editor);
        $editorRevisionResponse = $this->postJson(
            "/api/v1/manuscripts/{$manuscriptId}/revisions",
            ['file' => $this->manuscriptFile()]
        );
        $editorRevisionResponse->assertStatus(201);
        $editorRevisionResponse->assertJsonPath('data.status', 'pending_admin_review_editor');
        $editorRevisionId = $editorRevisionResponse->json('data.revisions.1.id');

        // Admin rejects editor's work first.
        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$editorRevisionId}/review",
            ['decision' => 'reject', 'note' => 'Belum sesuai SOP.']
        )->assertJsonPath('data.status', 'editor_revision_requested');

        // Editor re-uploads.
        Sanctum::actingAs($editor);
        $secondEditorRevision = $this->postJson(
            "/api/v1/manuscripts/{$manuscriptId}/revisions",
            ['file' => $this->manuscriptFile()]
        );
        $secondEditorRevision->assertStatus(201);
        $secondEditorRevisionId = $secondEditorRevision->json('data.revisions.2.id');

        // Admin approves this time.
        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$secondEditorRevisionId}/review",
            ['decision' => 'approve']
        )->assertJsonPath('data.status', 'pending_penulis_review');

        // Penulis requests more revision.
        Sanctum::actingAs($penulis);
        $this->postJson("/api/v1/manuscripts/{$manuscriptId}/final-review", [
            'decision' => 'revise',
            'note' => 'Masih ada typo.',
        ])->assertJsonPath('data.status', 'in_editing');

        // Editor uploads final revision.
        Sanctum::actingAs($editor);
        $finalEditorRevision = $this->postJson(
            "/api/v1/manuscripts/{$manuscriptId}/revisions",
            ['file' => $this->manuscriptFile()]
        );
        $finalEditorRevisionId = $finalEditorRevision->json('data.revisions.3.id');

        Sanctum::actingAs($admin);
        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$finalEditorRevisionId}/review",
            ['decision' => 'approve']
        )->assertJsonPath('data.status', 'pending_penulis_review');

        // Penulis finally approves.
        Sanctum::actingAs($penulis);
        $this->postJson("/api/v1/manuscripts/{$manuscriptId}/final-review", [
            'decision' => 'approve',
        ])->assertJsonPath('data.status', 'completed');
    }

    /*
    |--------------------------------------------------------------------------
    | Access Control
    |--------------------------------------------------------------------------
    */

    public function test_unrelated_user_cannot_view_manuscript(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');

        $stranger = $this->makeUser();
        Sanctum::actingAs($stranger);

        $this->getJson("/api/v1/manuscripts/{$manuscriptId}")->assertStatus(403);
    }

    public function test_unrelated_user_cannot_upload_revision(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');

        $stranger = $this->makeUser(['editor']);
        Sanctum::actingAs($stranger);

        $this->postJson(
            "/api/v1/manuscripts/{$manuscriptId}/revisions",
            ['file' => $this->manuscriptFile()]
        )->assertStatus(403);
    }

    public function test_non_admin_cannot_review_revision(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            ['decision' => 'approve']
        )->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Download
    |--------------------------------------------------------------------------
    */

    public function test_owner_can_download_revision(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $response = $this->get(
            "/api/v1/manuscripts/{$manuscriptId}/revisions/{$revisionId}/download"
        );

        $response->assertStatus(200);
    }

    public function test_stranger_cannot_download_revision(): void
    {
        $penulis = $this->makeUser(['penulis']);
        $order = $this->makeConfirmedOrder($penulis);
        Sanctum::actingAs($penulis);

        $submitResponse = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => $this->manuscriptFile(),
        ]);
        $manuscriptId = $submitResponse->json('data.id');
        $revisionId = $submitResponse->json('data.revisions.0.id');

        $stranger = $this->makeUser();
        Sanctum::actingAs($stranger);

        $this->get(
            "/api/v1/manuscripts/{$manuscriptId}/revisions/{$revisionId}/download"
        )->assertStatus(403);
    }
}
