<?php

namespace Tests\Feature;

use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\Order;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use App\Services\EditorInsightService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Kelola Editor: level, performa, ban ("dalam pemantauan") dan promosi. */
class EditorManagementTest extends TestCase
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

    private function makeUser(array $roles = ['editor'], string $name = 'Editor'): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function makeEditor(array $profile = []): User
    {
        $editor = $this->makeUser();
        // forceFill: kolom Kelola Editor (ban/promosi) tidak mass-assignable.
        (new EditorProfile)->forceFill($profile + ['user_id' => $editor->id, 'fee' => 100000, 'is_available' => true])->save();

        return $editor;
    }

    /** Naskah yang dikerjakan editor ($count kali), dengan status tertentu. */
    private function manuscripts(User $editor, int $count, string $status = 'completed', array $extra = []): array
    {
        $author = $this->makeUser(['penulis'], 'Penulis');
        $made = [];

        for ($i = 0; $i < $count; $i++) {
            $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
            $made[] = Manuscript::create($extra + ['order_id' => $order->id, 'user_id' => $author->id, 'title' => 'Naskah '.$i, 'authors' => ['A'], 'status' => $status, 'editor_id' => $editor->id]);
        }

        return $made;
    }

    private function revision(Manuscript $manuscript, int $number, string $adminStatus, ?string $createdAt = null): ManuscriptRevision
    {
        $revision = ManuscriptRevision::create([
            'manuscript_id' => $manuscript->id,
            'revision_number' => $number,
            'uploaded_by' => $manuscript->editor_id,
            'role' => 'editor',
            'file_path' => 'x.pdf',
            'original_filename' => 'x.pdf',
            'admin_status' => $adminStatus,
        ]);

        if ($createdAt) {
            $revision->forceFill(['created_at' => $createdAt])->save();
        }

        return $revision;
    }

    public function test_level_follows_the_number_of_manuscripts(): void
    {
        $expected = [0 => 1, 5 => 1, 6 => 2, 10 => 2, 11 => 3, 25 => 3, 26 => 4, 50 => 4, 51 => 5, 200 => 5];

        foreach ($expected as $count => $level) {
            $this->assertSame($level, EditorInsightService::levelFor($count), "{$count} naskah");
        }
    }

    public function test_scores_are_one_to_ten_from_matching_over_total(): void
    {
        $this->assertNull(EditorInsightService::score(0, 0));
        $this->assertSame(1.0, EditorInsightService::score(0, 4));
        $this->assertSame(10.0, EditorInsightService::score(4, 4));
        $this->assertSame(5.5, EditorInsightService::score(2, 4));
    }

    public function test_performance_counts_deadlines_rejects_and_author_revisions(): void
    {
        $editor = $this->makeEditor();

        // 1) Tepat waktu: hasil edit dikirim sebelum deadline, disetujui, penulis setuju (selesai).
        [$a] = $this->manuscripts($editor, 1, 'completed', ['editor_deadline' => '2026-03-10']);
        $this->revision($a, 1, 'approved', '2026-03-09 10:00:00');

        // 2) Terlambat, sempat direject admin, lalu disetujui, kemudian penulis minta revisi (hasil baru ada).
        [$b] = $this->manuscripts($editor, 1, 'completed', ['editor_deadline' => '2026-03-10']);
        $this->revision($b, 1, 'rejected', '2026-03-12 10:00:00');
        $this->revision($b, 2, 'approved', '2026-03-13 10:00:00');
        $this->revision($b, 3, 'approved', '2026-03-14 10:00:00');

        // 3) Penulis meminta revisi tetapi editor belum mengirim lagi (in_editing, hasil terakhir sudah disetujui).
        [$c] = $this->manuscripts($editor, 1, 'in_editing');
        $this->revision($c, 1, 'approved');

        // 4) Hasil terakhir masih menunggu keputusan penulis: belum dihitung.
        [$d] = $this->manuscripts($editor, 1, 'pending_penulis_review');
        $this->revision($d, 1, 'approved');

        $metrics = app(EditorInsightService::class)->metrics([$editor->id])[$editor->id];

        $this->assertSame(4, $metrics['total']);
        $this->assertSame(2, $metrics['completed']);
        $this->assertSame(2, $metrics['in_progress']);
        $this->assertSame(1, $metrics['level']);

        // Waktu: 1 dari 2 naskah ber-deadline tepat waktu.
        $this->assertSame(['matching' => 1, 'total' => 2, 'score' => 5.5], $metrics['performance']['on_time']);
        // Review admin: 6 hasil edit sudah direview (1 reject) -> 5 disetujui dari 6.
        $this->assertSame(['matching' => 5, 'total' => 6, 'score' => 8.5], $metrics['performance']['review']);
        // Revisi penulis: disetujui admin = a, b(2), b(3), c = 4; dihitung 4 (d menunggu). Direvisi: b(2) dan c.
        $this->assertSame(['matching' => 2, 'total' => 4, 'score' => 5.5], $metrics['performance']['author_revision']);
        $this->assertSame(6.5, $metrics['performance']['overall']);
    }

    public function test_the_admin_list_shows_numbers_fee_and_monitoring_state(): void
    {
        $editor = $this->makeEditor(['is_coauthor' => true]);
        $this->manuscripts($editor, 2, 'completed', ['editor_fee' => 150000]);
        $this->manuscripts($editor, 1, 'in_editing');

        Sanctum::actingAs($this->admin);

        $row = collect($this->getJson('/api/v1/admin/editors')->assertOk()->json('data'))->firstWhere('id', $editor->id);

        $this->assertSame(2, $row['completed']);
        $this->assertSame(1, $row['in_progress']);
        $this->assertTrue($row['is_coauthor']);
        $this->assertSame(1, $row['level']);
        $this->assertEquals(300000, $row['total_fee']);
        $this->assertEquals(300000, $row['unclaimed_fee']);
        $this->assertFalse($row['is_banned']);
    }

    public function test_only_admin_can_manage_editors(): void
    {
        $editor = $this->makeEditor();

        Sanctum::actingAs($editor);
        $this->getJson('/api/v1/admin/editors')->assertForbidden();
        $this->putJson("/api/v1/admin/editors/{$editor->id}/ban", ['banned' => true])->assertForbidden();
        $this->putJson("/api/v1/admin/editors/{$editor->id}/promote", ['promoted' => true])->assertForbidden();
    }

    public function test_a_monitored_editor_cannot_claim_from_the_pool_and_is_flagged_in_the_directory(): void
    {
        $editor = $this->makeEditor();
        [$manuscript] = $this->manuscripts($editor, 1, 'pending_editor_assignment', ['editor_id' => null, 'open_for_claim' => true]);

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/v1/admin/editors/{$editor->id}/ban", ['banned' => true, 'note' => 'Sering terlambat'])->assertOk();

        Sanctum::actingAs($editor);
        $this->getJson('/api/v1/editor/manuscript-pool')->assertOk()->assertJsonPath('meta.under_monitoring', true);
        $this->postJson("/api/v1/editor/manuscript-pool/{$manuscript->id}/claim")->assertForbidden();
        $this->assertDatabaseHas('manuscripts', ['id' => $manuscript->id, 'editor_id' => null]);

        // Penulis melihat penandanya (dan catatan internal admin tidak ikut terkirim).
        Sanctum::actingAs($this->makeUser(['penulis'], 'Penulis'));
        $listed = collect($this->getJson('/api/v1/editors')->assertOk()->json('data'))->firstWhere('user_id', $editor->id);
        $this->assertTrue($listed['under_monitoring']);
        $this->assertArrayNotHasKey('ban_note', $listed);

        // Dicabut: bisa mengambil lagi.
        Sanctum::actingAs($this->admin);
        $this->putJson("/api/v1/admin/editors/{$editor->id}/ban", ['banned' => false])->assertOk();
        Sanctum::actingAs(User::find($editor->id));
        $this->postJson("/api/v1/editor/manuscript-pool/{$manuscript->id}/claim")->assertOk();
    }

    public function test_promoted_editors_come_first_best_level_and_performance_first_max_three(): void
    {
        $plain = $this->makeEditor();

        // Level 3 (11 naskah), level 2 (6), level 1 dengan performa lebih baik, dan level 1 biasa.
        $high = $this->makeEditor(['is_promoted' => true]);
        $this->manuscripts($high, 11);
        $mid = $this->makeEditor(['is_promoted' => true]);
        $this->manuscripts($mid, 6);
        $goodLow = $this->makeEditor(['is_promoted' => true]);
        [$m] = $this->manuscripts($goodLow, 1);
        $this->revision($m, 1, 'approved');
        $badLow = $this->makeEditor(['is_promoted' => true]);
        [$n] = $this->manuscripts($badLow, 1);
        $this->revision($n, 1, 'rejected');

        Sanctum::actingAs($this->makeUser(['penulis'], 'Penulis'));
        $data = collect($this->getJson('/api/v1/editors')->assertOk()->json('data'));

        // Hanya 3 teratas yang dipromosikan: high, mid, goodLow; badLow turun ke daftar biasa.
        $this->assertSame([$high->id, $mid->id, $goodLow->id], $data->take(3)->pluck('user_id')->all());
        $this->assertSame([true, true, true], $data->take(3)->pluck('is_promoted')->all());
        $this->assertFalse($data->firstWhere('user_id', $badLow->id)['is_promoted']);
        $this->assertFalse($data->firstWhere('user_id', $plain->id)['is_promoted']);

        // Level dan performa tidak pernah dikirim ke penulis.
        foreach ($data as $row) {
            $this->assertArrayNotHasKey('level', $row);
            $this->assertArrayNotHasKey('performance', $row);
        }
    }

    public function test_promotion_is_refused_for_a_monitored_editor_and_ban_clears_it(): void
    {
        $editor = $this->makeEditor(['is_promoted' => true]);

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/v1/admin/editors/{$editor->id}/ban", ['banned' => true])->assertOk();
        $this->assertDatabaseHas('editor_profiles', ['user_id' => $editor->id, 'is_banned' => true, 'is_promoted' => false]);

        $this->putJson("/api/v1/admin/editors/{$editor->id}/promote", ['promoted' => true])->assertStatus(422);
    }

    public function test_the_public_editor_directory_lists_promoted_editors_first(): void
    {
        $first = $this->makeEditor();
        $second = $this->makeEditor(['is_promoted' => true]);

        foreach ([$first, $second] as $editor) {
            PublicProfile::create(['user_id' => $editor->id, 'slug' => 'e-'.$editor->id, 'pen_name' => 'Editor '.$editor->id, 'bio' => 'bio', 'is_published' => true]);
        }

        $names = collect($this->getJson('/api/v1/public/authors?role=editor')->assertOk()->json('data'));

        $this->assertSame('e-'.$second->id, $names->first()['slug']);
        $this->assertTrue($names->first()['is_promoted']);
        $this->assertArrayNotHasKey('level', $names->first());
    }

    public function test_an_editor_sees_their_own_level_and_performance_only(): void
    {
        $editor = $this->makeEditor();
        $this->manuscripts($editor, 6);

        Sanctum::actingAs($editor);
        $this->getJson('/api/v1/editor/insight')
            ->assertOk()
            ->assertJsonPath('data.level', 2)
            ->assertJsonPath('data.total', 6)
            ->assertJsonStructure(['data' => ['performance' => ['on_time', 'review', 'author_revision', 'overall']]]);

        Sanctum::actingAs($this->makeUser(['penulis'], 'Penulis'));
        $this->getJson('/api/v1/editor/insight')->assertForbidden();
    }
}
