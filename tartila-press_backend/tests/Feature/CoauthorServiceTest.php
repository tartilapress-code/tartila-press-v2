<?php

namespace Tests\Feature;

use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptTemplate;
use App\Models\Mou;
use App\Models\MouTemplate;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Package;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use App\Services\ManuscriptAssignmentService;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Layanan co-author: penulis -> admin -> CO-AUTHOR menyusun -> admin -> penulis setuju
 * -> EDITOR -> admin -> penulis tinjauan akhir. Co-author = penulis terakhir (royalti tetap 5%).
 */
class CoauthorServiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
    }

    private function makeUser(array $roles = ['penulis'], string $name = 'Penulis'): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));
        PersonalProfile::create(['user_id' => $user->id, 'nik' => '2171000000000001', 'ktp_address' => 'Jl. Contoh, Batam', 'phone' => '0812']);

        return $user;
    }

    private function makeEditor(bool $coauthor = false, float $coauthorFee = 0, float $fee = 100000): User
    {
        $editor = $this->makeUser(['editor'], 'Editor');
        EditorProfile::create([
            'user_id' => $editor->id,
            'fee' => $fee,
            'is_available' => true,
            'is_coauthor' => $coauthor,
            'coauthor_fee' => $coauthorFee,
        ]);

        return $editor;
    }

    private function makeOrder(User $penulis, array $extra = []): Order
    {
        $package = Package::create(['name' => 'Paket Co', 'price' => 1000000, 'discount' => 0, 'created_by' => $this->admin->id]);

        return Order::create($extra + [
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $penulis->id,
            'status' => 'confirmed',
            'subtotal' => $package->price,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => $package->price,
            'wants_coauthor' => true,
        ]);
    }

    private function file(): UploadedFile
    {
        return UploadedFile::fake()->create('naskah.pdf', 300, 'application/pdf');
    }

    /** @return array{0: int, 1: int} manuscript id, revision id */
    private function submit(User $penulis, Order $order): array
    {
        Sanctum::actingAs($penulis);

        $response = $this->postJson('/api/v1/manuscripts', [
            'manuscript_template_id' => ManuscriptTemplate::default()?->id,
            'order_id' => $order->id,
            'title' => 'Buku Co-author',
            'authors' => [$penulis->name],
            'file' => $this->file(),
        ])->assertStatus(201);

        return [$response->json('data.id'), $response->json('data.revisions.0.id')];
    }

    private function review(int $manuscriptId, int $revisionId, array $payload)
    {
        Sanctum::actingAs($this->admin);

        return $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/revisions/{$revisionId}/review", $payload);
    }

    public function test_coauthor_flag_and_fee_are_saved_on_the_editor_profile(): void
    {
        $editor = $this->makeUser(['editor']);
        Sanctum::actingAs($editor);

        $this->postJson('/api/v1/editor/profile', ['fee' => 100000, 'is_coauthor' => true, 'coauthor_fee' => 250000, 'coauthor_bio' => 'Menyusun naskah mentah.'])
            ->assertOk();

        $this->assertDatabaseHas('editor_profiles', ['user_id' => $editor->id, 'is_coauthor' => true, 'coauthor_fee' => 250000]);

        // Hanya editor yang ber-centang co-author muncul di daftar pilihan penulis.
        $this->makeEditor(coauthor: false);
        $penulis = $this->makeUser();
        Sanctum::actingAs($penulis);

        $this->getJson('/api/v1/coauthors')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user_id', $editor->id)
            ->assertJsonPath('meta.royalty_percent', 5);
    }

    public function test_full_flow_with_admin_assigned_coauthor(): void
    {
        $penulis = $this->makeUser();
        $coauthor = $this->makeEditor(coauthor: true, coauthorFee: 200000);
        $editor = $this->makeEditor();
        $order = $this->makeOrder($penulis);
        [$manuscriptId, $revisionId] = $this->submit($penulis, $order);

        // Admin koreksi & setujui: menunggu penugasan co-author (belum ke editor).
        $this->review($manuscriptId, $revisionId, ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_coauthor_assignment');

        // Editor biasa (tanpa centang) tidak bisa ditunjuk sebagai co-author.
        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/assign-coauthor", ['coauthor_id' => $editor->id, 'fee' => 1])
            ->assertStatus(422);

        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/assign-coauthor", ['coauthor_id' => $coauthor->id, 'fee' => 200000])
            ->assertOk();

        $manuscript = Manuscript::findOrFail($manuscriptId);
        $this->assertSame('in_coauthoring', $manuscript->status);
        $this->assertSame($coauthor->id, $manuscript->coauthor_id);
        $this->assertContains($coauthor->name, $manuscript->authors);
        $this->assertSame($coauthor->name, collect($manuscript->authors)->last());

        // Co-author = penulis terakhir.
        $last = $manuscript->authorLinks()->reorder('position', 'desc')->first();
        $this->assertSame($coauthor->id, $last->user_id);
        $this->assertTrue($last->is_coauthor);

        // Co-author menyusun dan mengunggah: menunggu admin.
        Sanctum::actingAs($coauthor);
        $upload = $this->postJson("/api/v1/manuscripts/{$manuscriptId}/revisions", ['file' => $this->file()])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'pending_admin_review_coauthor');
        $coRevisionId = $upload->json('data.revisions.1.id');

        // Admin menolak, co-author memperbaiki, admin setuju.
        $this->review($manuscriptId, $coRevisionId, ['decision' => 'reject', 'note' => 'Perbaiki bab 2.'])
            ->assertJsonPath('data.status', 'coauthor_revision_requested');

        Sanctum::actingAs($coauthor);
        $second = $this->postJson("/api/v1/manuscripts/{$manuscriptId}/revisions", ['file' => $this->file()])->assertStatus(201);
        $secondId = $second->json('data.revisions.2.id');

        $this->review($manuscriptId, $secondId, ['decision' => 'approve'])
            ->assertJsonPath('data.status', 'pending_author_review_coauthor');

        // Penulis meminta revisi -> kembali ke co-author; lalu setuju -> baru ke editor.
        Sanctum::actingAs($penulis);
        $this->postJson("/api/v1/manuscripts/{$manuscriptId}/coauthor-review", ['decision' => 'revise', 'note' => 'Tambah contoh.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_coauthoring');

        Sanctum::actingAs($coauthor);
        $third = $this->postJson("/api/v1/manuscripts/{$manuscriptId}/revisions", ['file' => $this->file()])->assertStatus(201);
        $this->review($manuscriptId, $third->json('data.revisions.3.id'), ['decision' => 'approve'])
            ->assertJsonPath('data.status', 'pending_author_review_coauthor');

        // Co-author tidak ikut menyetujui; hanya penulis.
        Sanctum::actingAs($coauthor);
        $this->postJson("/api/v1/manuscripts/{$manuscriptId}/coauthor-review", ['decision' => 'approve'])->assertForbidden();

        Sanctum::actingAs($penulis);
        $this->postJson("/api/v1/manuscripts/{$manuscriptId}/coauthor-review", ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_editor_assignment');
    }

    public function test_author_chosen_coauthor_needs_admin_fee_and_goes_straight_to_the_coauthor(): void
    {
        $penulis = $this->makeUser();
        $coauthor = $this->makeEditor(coauthor: true, coauthorFee: 150000);
        $order = $this->makeOrder($penulis, ['coauthor_id' => $coauthor->id, 'coauthor_fee' => 150000, 'total' => 1150000]);
        [$manuscriptId, $revisionId] = $this->submit($penulis, $order);

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('coauthor_fee');

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve', 'coauthor_fee' => 50000])
            ->assertOk()
            ->assertJsonPath('data.status', 'in_coauthoring');

        $manuscript = Manuscript::findOrFail($manuscriptId);
        $this->assertSame($coauthor->id, $manuscript->coauthor_id);
        $this->assertSame(200000.0, (float) $manuscript->coauthor_fee);
        $this->assertSame(150000.0, (float) $manuscript->coauthor_requested_fee);
    }

    public function test_pool_is_limited_to_flagged_editors_and_only_one_can_claim(): void
    {
        $penulis = $this->makeUser();
        $flagged = $this->makeEditor(coauthor: true);
        $other = $this->makeEditor(coauthor: true);
        $plain = $this->makeEditor(coauthor: false);
        [$manuscriptId, $revisionId] = $this->submit($penulis, $this->makeOrder($penulis));

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve'])->assertJsonPath('data.status', 'pending_coauthor_assignment');
        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/open-coauthor-pool", ['fee' => 300000])->assertOk();

        // Editor biasa tidak boleh melihat/mengambil pool co-author.
        Sanctum::actingAs($plain);
        $this->getJson('/api/v1/editor/coauthor-pool')->assertForbidden();
        $this->postJson("/api/v1/editor/coauthor-pool/{$manuscriptId}/claim")->assertForbidden();

        Sanctum::actingAs($flagged);
        $this->getJson('/api/v1/editor/coauthor-pool')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/editor/coauthor-pool/{$manuscriptId}/claim")->assertOk();

        $manuscript = Manuscript::findOrFail($manuscriptId);
        $this->assertSame('in_coauthoring', $manuscript->status);
        $this->assertSame($flagged->id, $manuscript->coauthor_id);
        $this->assertSame('pool', $manuscript->coauthor_source);
        $this->assertSame(300000.0, (float) $manuscript->coauthor_fee);

        Sanctum::actingAs($other);
        $this->postJson("/api/v1/editor/coauthor-pool/{$manuscriptId}/claim")->assertStatus(422);
    }

    public function test_the_coauthor_can_never_also_be_the_editor_of_the_same_manuscript(): void
    {
        $penulis = $this->makeUser();
        $coauthor = $this->makeEditor(coauthor: true);
        [$manuscriptId, $revisionId] = $this->submit($penulis, $this->makeOrder($penulis));

        $this->review($manuscriptId, $revisionId, ['decision' => 'approve']);
        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/assign-coauthor", ['coauthor_id' => $coauthor->id, 'fee' => 1])->assertOk();

        Manuscript::whereKey($manuscriptId)->update(['status' => 'pending_editor_assignment']);

        // Admin tidak bisa menunjuk co-author sebagai editor.
        $this->postJson("/api/v1/admin/manuscripts/{$manuscriptId}/assign-editor", ['editor_id' => $coauthor->id, 'fee' => 1])
            ->assertStatus(422);

        // Dan co-author tidak bisa mengambilnya dari pool editor.
        Manuscript::whereKey($manuscriptId)->update(['open_for_claim' => true]);
        Sanctum::actingAs($coauthor);
        $this->getJson('/api/v1/editor/manuscript-pool')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson("/api/v1/editor/manuscript-pool/{$manuscriptId}/claim")->assertForbidden();
    }

    public function test_coauthor_signs_the_mou_with_a_fixed_royalty_and_gets_paid(): void
    {
        MouTemplate::current('regular')->update(['physical_royalty' => 30, 'ebook_royalty' => 30]);

        $penulis = $this->makeUser();
        $second = $this->makeUser();
        $coauthor = $this->makeEditor(coauthor: true, coauthorFee: 200000);
        $order = $this->makeOrder($penulis);

        foreach (['ISBN Buku Cetak', 'ISBN Ebook'] as $name) {
            $item = CustomPackageItem::create(['name' => $name, 'type' => 'service', 'price' => 100000]);
            OrderItem::create(['order_id' => $order->id, 'itemable_type' => CustomPackageItem::class, 'itemable_id' => $item->id, 'name' => $name, 'quantity' => 1, 'unit_price' => 1, 'subtotal' => 1]);
        }

        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $penulis->id, 'title' => 'Buku MOU Co', 'authors' => [$penulis->name, $second->name], 'status' => 'pending_penulis_review', 'wants_coauthor' => true]);
        foreach ([$penulis, $second] as $index => $author) {
            $manuscript->authorLinks()->create(['user_id' => $author->id, 'position' => $index + 1, 'approved_at' => now()]);
        }

        app(ManuscriptAssignmentService::class)->attach($manuscript, $coauthor, 'admin', 200000);
        $manuscript->update(['status' => 'completed']);

        $mou = Mou::where('manuscript_id', $manuscript->id)->firstOrFail();
        $signatories = $mou->signatories()->orderBy('position')->get();

        // Penulis terakhir = co-author; royalti tetap 5% (di luar pembagian rata dua penulis lain).
        $this->assertCount(3, $signatories);
        $this->assertSame($coauthor->id, $signatories->last()->user_id);
        $this->assertTrue($signatories->last()->is_coauthor);
        $this->assertEquals([15.0, 15.0, 5.0], $signatories->pluck('royalty_physical')->map(fn ($value) => (float) $value)->all());
        $this->assertEquals([15.0, 15.0, 5.0], $signatories->pluck('royalty_ebook')->map(fn ($value) => (float) $value)->all());

        // Co-author diberi tahu untuk tanda tangan MOU seperti penulis lain.
        $this->assertDatabaseHas('user_notifications', ['user_id' => $coauthor->id, 'category' => 'mou', 'subject_id' => $mou->id]);

        // Fee co-author masuk dompet setelah naskah selesai.
        $wallet = app(WalletService::class)->summary($coauthor);
        $this->assertSame(200000.0, $wallet['by_type']['coauthor_fee']);
    }
}
