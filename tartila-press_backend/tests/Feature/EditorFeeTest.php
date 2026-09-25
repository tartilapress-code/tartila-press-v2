<?php

namespace Tests\Feature;

use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Fee editor per naskah:
 * - ditunjuk admin           → fee dari admin
 * - diambil dari pool        → harga pengerjaan naskah (dari admin)
 * - dipilih langsung penulis → fee permintaan editor + fee dari admin
 */
class EditorFeeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roleNames = ['user'], string $name = 'Test User'): User
    {
        $user = User::create([
            'name' => $name,
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function makeEditor(float $fee = 150000, string $name = 'Editor Uji'): User
    {
        $editor = $this->makeUser(['editor'], $name);
        EditorProfile::create(['user_id' => $editor->id, 'fee' => $fee, 'is_available' => true]);

        return $editor;
    }

    private function makeConfirmedOrder(User $penulis, ?User $editor = null): Order
    {
        $admin = $this->makeUser(['admin']);
        $package = Package::create([
            'name' => 'Paket Test',
            'price' => 1000000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        $editorFee = $editor ? (float) $editor->editorProfile->fee : 0;

        return Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $penulis->id,
            'status' => 'confirmed',
            'subtotal' => $package->price,
            'discount_total' => 0,
            'editor_id' => $editor?->id,
            'editor_fee' => $editorFee,
            'total' => $package->price + $editorFee,
        ]);
    }

    /**
     * Penulis mengunggah naskah → [manuscriptId, revisionId].
     */
    private function submitManuscript(User $penulis, Order $order): array
    {
        Sanctum::actingAs($penulis);

        $response = $this->postJson('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Judul Buku',
            'authors' => ['Penulis A'],
            'file' => UploadedFile::fake()->create('naskah.pdf', 500, 'application/pdf'),
        ])->assertStatus(201);

        return [$response->json('data.id'), $response->json('data.revisions.0.id')];
    }

    private function review(int $manuscriptId, int $revisionId, array $payload)
    {
        return $this->postJson(
            "/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review",
            $payload
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Dipilih langsung penulis: fee permintaan editor + fee dari admin
    |--------------------------------------------------------------------------
    */

    public function test_approving_requires_the_admin_fee_when_the_author_chose_the_editor(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('fee')
            ->assertJsonPath('errors.fee.0', 'Fee dari admin wajib diisi karena penulis memilih editor secara langsung. Total fee editor = fee permintaan editor + fee dari admin.');

        // Tidak ada yang berubah: revisi masih menunggu, naskah belum punya editor.
        $this->assertDatabaseHas('manuscript_revisions', ['id' => $revisionId, 'admin_status' => 'pending']);
        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscriptId,
            'status' => 'submitted',
            'editor_id' => null,
            'editor_fee' => null,
        ]);
    }

    public function test_total_fee_is_the_editors_requested_fee_plus_the_admin_fee(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'fee' => 50000])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_editing')
            ->assertJsonPath('data.editor_id', $editor->id)
            ->assertJsonPath('data.editor_source', 'author')
            ->assertJsonPath('data.editor_requested_fee', '150000.00')
            ->assertJsonPath('data.editor_admin_fee', 50000)
            ->assertJsonPath('data.editor_fee', '200000.00');
    }

    public function test_the_admin_fee_can_be_zero(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'fee' => 0])
            ->assertOk()
            ->assertJsonPath('data.editor_fee', '150000.00')
            ->assertJsonPath('data.editor_admin_fee', 0);
    }

    public function test_the_requested_fee_is_the_amount_in_the_order_not_the_editors_current_fee(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        // Editor menaikkan tarifnya setelah penulis memesan.
        $editor->editorProfile->update(['fee' => 999000]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'fee' => 50000])
            ->assertOk()
            ->assertJsonPath('data.editor_requested_fee', '150000.00')
            ->assertJsonPath('data.editor_fee', '200000.00');
    }

    public function test_the_admin_fee_must_be_a_valid_amount(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        Sanctum::actingAs($this->makeUser(['admin']));

        foreach ([-1, 'banyak', 600000000000] as $invalid) {
            $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'fee' => $invalid])
                ->assertStatus(422)
                ->assertJsonValidationErrors('fee');
        }

        $this->assertDatabaseHas('manuscript_revisions', ['id' => $revisionId, 'admin_status' => 'pending']);
    }

    public function test_rejecting_does_not_need_a_fee(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->review($manuscriptId, $revisionId, ['decision' => 'reject', 'note' => 'Format belum sesuai.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'revision_requested');
    }

    public function test_no_fee_is_needed_when_the_author_did_not_choose_an_editor(): void
    {
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis));

        Sanctum::actingAs($this->makeUser(['admin']));

        // Fee yang ikut terkirim diabaikan: admin menentukan fee saat tunjuk/pool.
        $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'fee' => 70000])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_editor_assignment');

        $manuscript = Manuscript::findOrFail($manuscriptId);
        $this->assertNull($manuscript->editor_fee);
        $this->assertNull($manuscript->editor_source);
    }

    /*
    |--------------------------------------------------------------------------
    | Ditunjuk admin / diambil dari pool
    |--------------------------------------------------------------------------
    */

    public function test_an_admin_assigned_editor_gets_the_fee_the_admin_gives(): void
    {
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis));
        $editor = $this->makeEditor(999000);

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->review($manuscriptId, $revisionId, ['decision' => 'approve'])->assertOk();

        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/assign-editor", [
            'editor_id' => $editor->id,
            'fee' => 200000,
        ])
            ->assertOk()
            ->assertJsonPath('data.editor_source', 'admin')
            ->assertJsonPath('data.editor_fee', '200000.00')
            ->assertJsonPath('data.editor_requested_fee', null)
            ->assertJsonPath('data.editor_admin_fee', 200000);
    }

    public function test_an_editor_from_the_pool_gets_the_work_price_the_admin_set(): void
    {
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis));
        $editor = $this->makeEditor(999000);

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->review($manuscriptId, $revisionId, ['decision' => 'approve'])->assertOk();
        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/open-pool", ['fee' => 175000])->assertOk();

        Sanctum::actingAs($editor);
        $this->postJson("/api/v1/editor/manuscript-pool/{$manuscriptId}/claim")->assertOk();

        $this->assertDatabaseHas('manuscripts', [
            'id' => $manuscriptId,
            'editor_id' => $editor->id,
            'editor_source' => 'pool',
            'editor_fee' => 175000,
            'editor_requested_fee' => null,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Fee Saya
    |--------------------------------------------------------------------------
    */

    private function makeAssignedManuscript(User $editor, array $attributes): Manuscript
    {
        $penulis = $this->makeUser(['penulis'], 'Penulis '.uniqid());

        return Manuscript::create(array_merge([
            'order_id' => $this->makeConfirmedOrder($penulis)->id,
            'user_id' => $penulis->id,
            'title' => 'Naskah '.uniqid(),
            'authors' => ['Penulis A'],
            'editor_id' => $editor->id,
        ], $attributes));
    }

    public function test_my_fee_lists_each_manuscript_with_its_breakdown_and_totals(): void
    {
        $editor = $this->makeEditor();

        $chosen = $this->makeAssignedManuscript($editor, [
            'status' => 'in_editing',
            'editor_source' => 'author',
            'editor_requested_fee' => 150000,
            'editor_fee' => 200000,
        ]);
        $assigned = $this->makeAssignedManuscript($editor, [
            'status' => 'completed',
            'editor_source' => 'admin',
            'editor_fee' => 300000,
        ]);
        $pool = $this->makeAssignedManuscript($editor, [
            'status' => 'completed',
            'editor_source' => 'pool',
            'editor_fee' => 175000,
        ]);
        $legacy = $this->makeAssignedManuscript($editor, [
            'status' => 'in_editing',
            'editor_fee' => 100000,
        ]);

        Sanctum::actingAs($editor);

        $response = $this->getJson('/api/v1/editor/fees')->assertOk();

        $response->assertJsonPath('data.summary.count', 4);
        $response->assertJsonPath('data.summary.total', 775000);
        $response->assertJsonPath('data.summary.completed', 475000);
        $response->assertJsonPath('data.summary.in_progress', 300000);

        $items = collect($response->json('data.items'))->keyBy('id');

        $this->assertFeeItem($items[$chosen->id], 'author', 150000, 50000, 200000);
        $this->assertSame('in_editing', $items[$chosen->id]['status']);

        $this->assertFeeItem($items[$assigned->id], 'admin', null, 300000, 300000);
        $this->assertFeeItem($items[$pool->id], 'pool', null, 175000, 175000);

        // Data lama: sumber tidak tercatat, tapi fee tetap dihitung.
        $this->assertFeeItem($items[$legacy->id], null, null, 100000, 100000);
    }

    private function assertFeeItem(array $item, ?string $source, ?int $requested, int $admin, int $total): void
    {
        $this->assertSame($source, $item['source']);

        if ($requested === null) {
            $this->assertNull($item['requested_fee']);
        } else {
            $this->assertEquals($requested, $item['requested_fee']);
        }

        $this->assertEquals($admin, $item['admin_fee']);
        $this->assertEquals($total, $item['total_fee']);
    }

    public function test_an_editor_only_sees_their_own_fees(): void
    {
        $me = $this->makeEditor(150000, 'Saya');
        $other = $this->makeEditor(150000, 'Editor Lain');

        $mine = $this->makeAssignedManuscript($me, ['status' => 'in_editing', 'editor_source' => 'admin', 'editor_fee' => 100000]);
        $this->makeAssignedManuscript($other, ['status' => 'in_editing', 'editor_source' => 'admin', 'editor_fee' => 900000]);

        Sanctum::actingAs($me);

        $response = $this->getJson('/api/v1/editor/fees')->assertOk();

        $this->assertSame([$mine->id], array_column($response->json('data.items'), 'id'));
        $response->assertJsonPath('data.summary.total', 100000);
    }

    public function test_an_editor_without_manuscripts_gets_zero_totals(): void
    {
        Sanctum::actingAs($this->makeEditor());

        $this->getJson('/api/v1/editor/fees')
            ->assertOk()
            ->assertJsonPath('data.summary.count', 0)
            ->assertJsonPath('data.summary.total', 0)
            ->assertJsonPath('data.summary.completed', 0)
            ->assertJsonPath('data.summary.in_progress', 0)
            ->assertJsonPath('data.items', []);
    }

    public function test_my_fee_is_for_editors_only(): void
    {
        $this->getJson('/api/v1/editor/fees')->assertStatus(401);

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->getJson('/api/v1/editor/fees')->assertStatus(403);
    }

    /*
    |--------------------------------------------------------------------------
    | Info editor pilihan penulis (untuk form approve admin)
    |--------------------------------------------------------------------------
    */

    public function test_the_manuscript_detail_tells_the_admin_which_editor_the_author_chose(): void
    {
        $editor = $this->makeEditor(150000, 'Editor Pilihan');
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->getJson("/api/v1/manuscripts/{$manuscriptId}")
            ->assertOk()
            ->assertJsonPath('data.author_chosen_editor.id', $editor->id)
            ->assertJsonPath('data.author_chosen_editor.name', 'Editor Pilihan')
            ->assertJsonPath('data.author_chosen_editor.requested_fee', 150000);
    }

    public function test_the_manuscript_detail_has_no_chosen_editor_when_the_author_did_not_pick_one(): void
    {
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis));

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->getJson("/api/v1/manuscripts/{$manuscriptId}")
            ->assertOk()
            ->assertJsonPath('data.author_chosen_editor', null);
    }

    public function test_only_admins_receive_the_chosen_editor_info(): void
    {
        $editor = $this->makeEditor(150000);
        $penulis = $this->makeUser(['penulis']);
        [$manuscriptId, $revisionId] = $this->submitManuscript($penulis, $this->makeConfirmedOrder($penulis, $editor));

        // Penulis sendiri tidak menerimanya.
        $this->getJson("/api/v1/manuscripts/{$manuscriptId}")
            ->assertOk()
            ->assertJsonMissingPath('data.author_chosen_editor');

        // Editor yang ditugaskan juga tidak.
        Sanctum::actingAs($this->makeUser(['admin']));
        $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'fee' => 10000])->assertOk();

        Sanctum::actingAs($editor);
        $this->getJson("/api/v1/manuscripts/{$manuscriptId}")
            ->assertOk()
            ->assertJsonMissingPath('data.author_chosen_editor')
            ->assertJsonPath('data.editor_fee', '160000.00');
    }
}
