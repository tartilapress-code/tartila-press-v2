<?php

namespace Tests\Feature;

use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptTemplate;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Revisi: template dipilih penulis, catatan penulis, fee editor tersembunyi dari penulis, notifikasi penugasan. */
class ManuscriptFeedbackFixesTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $author;

    private User $editor;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin']);
        $this->author = $this->makeUser(['penulis']);
        $this->editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $this->editor->id, 'fee' => 100000, 'is_available' => true]);
    }

    private function makeUser(array $roles): User
    {
        $user = User::create(['name' => 'U '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function order(array $extra = []): Order
    {
        return Order::create($extra + ['order_number' => 'ORD-'.uniqid(), 'user_id' => $this->author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
    }

    private function file(): UploadedFile
    {
        return UploadedFile::fake()->create('n.pdf', 50, 'application/pdf');
    }

    /** Naskah dikirim lalu disetujui admin dan ditugaskan ke editor; mengembalikan id naskah. */
    private function inEditing(array $orderExtra = []): int
    {
        Sanctum::actingAs($this->author);
        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $this->order($orderExtra)->id,
            'manuscript_template_id' => ManuscriptTemplate::default()->id,
            'title' => 'Naskah Uji',
            'authors' => ['A'],
            'file' => $this->file(),
        ])->assertCreated();
        $id = $response->json('data.id');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/manuscripts/{$id}/revisions/{$response->json('data.revisions.0.id')}/review", ['decision' => 'approve', 'difficulty' => 'mudah', 'fee' => 25000])->assertOk();

        if (Manuscript::find($id)->status === 'pending_editor_assignment') {
            $this->postJson("/api/v1/admin/manuscripts/{$id}/assign-editor", ['editor_id' => $this->editor->id, 'fee' => 150000])->assertOk();
        }

        return $id;
    }

    public function test_the_author_must_choose_a_template_before_the_manuscript_is_sent(): void
    {
        Sanctum::actingAs($this->author);

        $payload = ['order_id' => $this->order()->id, 'title' => 'Tanpa Template', 'authors' => ['A'], 'file' => $this->file()];

        $this->postJson('/api/v1/manuscripts', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('manuscript_template_id');

        // Template tidak aktif / tidak ada ditolak; yang valid disimpan di naskah.
        $this->postJson('/api/v1/manuscripts', ['order_id' => $payload['order_id'], 'title' => 'T', 'file' => $this->file(), 'manuscript_template_id' => 9999])->assertStatus(422);

        $template = ManuscriptTemplate::default();
        $response = $this->postJson('/api/v1/manuscripts', ['order_id' => $payload['order_id'], 'title' => 'Dengan Template', 'file' => $this->file(), 'manuscript_template_id' => $template->id])->assertCreated();

        $this->assertSame($template->id, Manuscript::find($response->json('data.id'))->manuscript_template_id);
    }

    public function test_authors_see_the_active_templates_to_choose_from(): void
    {
        ManuscriptTemplate::create(['name' => 'Tidak Aktif', 'config' => [], 'is_active' => false, 'created_by' => $this->admin->id]);

        Sanctum::actingAs($this->author);
        $names = collect($this->getJson('/api/v1/manuscripts/template-options')->assertOk()->json('data'))->pluck('name');

        $this->assertNotContains('Tidak Aktif', $names);
        $this->assertGreaterThanOrEqual(1, $names->count());
    }

    public function test_author_revision_notes_are_stored_as_author_notes_not_admin_notes(): void
    {
        $id = $this->inEditing();

        Sanctum::actingAs($this->editor);
        $revision = $this->postJson("/api/v1/manuscripts/{$id}/revisions", ['file' => $this->file()])->assertCreated()->json('data.revisions.1.id');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/manuscripts/{$id}/revisions/{$revision}/review", ['decision' => 'approve'])->assertOk();

        Sanctum::actingAs($this->author);
        $this->postJson("/api/v1/manuscripts/{$id}/final-review", ['decision' => 'revise', 'note' => 'Perbaiki bab 2.'])->assertOk();

        $this->assertDatabaseHas('manuscript_revisions', ['id' => $revision, 'author_note' => 'Perbaiki bab 2.', 'admin_note' => null]);

        $note = UserNotification::where('user_id', $this->editor->id)->where('title', 'Penulis meminta revisi lagi')->value('body');
        $this->assertStringContainsString('Catatan penulis: Perbaiki bab 2.', $note);
    }

    public function test_the_editor_fee_is_hidden_from_the_author_but_visible_to_the_editor_and_admin(): void
    {
        $id = $this->inEditing();

        Sanctum::actingAs($this->author);
        $this->getJson("/api/v1/manuscripts/{$id}")->assertOk()
            ->assertJsonMissingPath('data.editor_fee')
            ->assertJsonMissingPath('data.editor_requested_fee')
            ->assertJsonMissingPath('data.editor_admin_fee')
            ->assertJsonMissingPath('data.editor_assignment_note');
        $this->assertArrayNotHasKey('editor_fee', $this->getJson('/api/v1/manuscripts/mine')->json('data.0'));

        Sanctum::actingAs($this->editor);
        $this->getJson("/api/v1/manuscripts/{$id}")->assertOk()->assertJsonPath('data.editor_fee', '150000.00');

        Sanctum::actingAs($this->admin);
        $this->getJson("/api/v1/manuscripts/{$id}")->assertOk()->assertJsonPath('data.editor_fee', '150000.00');
    }

    public function test_the_editor_is_notified_even_when_the_editor_relation_was_loaded_before_assignment(): void
    {
        // Mensimulasikan auto layout yang memuat relasi editor (masih kosong) sebelum penugasan.
        $author = $this->author;
        $manuscript = Manuscript::create(['order_id' => $this->order()->id, 'user_id' => $author->id, 'title' => 'Relasi Basi', 'authors' => ['A'], 'status' => 'submitted']);
        $manuscript->load('editor');

        $manuscript->update(['editor_id' => $this->editor->id, 'status' => 'in_editing']);

        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->editor->id, 'category' => 'assigned_manuscript', 'title' => 'Naskah baru ditugaskan kepada Anda']);
    }
}
