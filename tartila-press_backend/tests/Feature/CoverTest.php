<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Cover;
use App\Models\CoverProject;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Services\Cover\CoverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Cover khusus: cover paket (3 pilihan, voting 24 jam, revisi), cover Book Chapter, cover buku, penghapusan berkas. */
class CoverTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::firstOrCreate(['name' => $name], ['display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin'], 'Admin');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function image(string $name = 'c.png'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='));
    }

    /** Naskah paket yang hasil editingnya sudah disetujui, dengan $authors penulis. */
    private function manuscript(int $authors = 1, string $status = 'pending_penulis_review'): array
    {
        $users = collect(range(1, $authors))->map(fn ($i) => $this->makeUser(['penulis'], "Penulis {$i}"));
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $users[0]->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $users[0]->id, 'title' => 'Judul Cover', 'authors' => $users->pluck('name')->all(), 'status' => $status]);

        foreach ($users as $index => $user) {
            $manuscript->authorLinks()->create(['user_id' => $user->id, 'position' => $index + 1, 'approved_at' => null]);
        }

        return [$manuscript, $users];
    }

    private function uploadThree(CoverProject $project): void
    {
        Sanctum::actingAs($this->admin);

        foreach ([1, 2, 3] as $position) {
            $this->post("/api/v1/admin/covers/projects/{$project->id}/covers", ['file' => $this->image(), 'position' => $position], ['Accept' => 'application/json'])->assertOk();
        }
    }

    private function vote(User $user, Manuscript $manuscript, ?int $coverId, ?string $note = null)
    {
        Sanctum::actingAs($user);

        return $this->postJson("/api/v1/manuscripts/{$manuscript->id}/cover/vote", ['cover_id' => $coverId, 'note' => $note]);
    }

    private function covers(CoverProject $project): Collection
    {
        return $project->fresh()->covers->where('round', $project->fresh()->round)->values();
    }

    public function test_the_package_cover_bill_appears_when_admin_approves_the_editing(): void
    {
        Storage::fake('local');
        $author = $this->makeUser(['penulis'], 'Penulis');
        $editor = $this->makeUser(['editor'], 'Editor');
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 1, 'is_available' => true]);
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_id' => $editor->id, 'editor_fee' => 1, 'total' => 1]);

        Sanctum::actingAs($author);
        $id = $this->postJson('/api/v1/manuscripts', ['manuscript_template_id' => ManuscriptTemplate::default()?->id, 'order_id' => $order->id, 'title' => 'Buku Cover', 'authors' => ['A'], 'file' => UploadedFile::fake()->create('n.pdf', 50, 'application/pdf')])->assertCreated()->json('data.id');
        $revision = Manuscript::find($id)->latestRevision()->id;

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/manuscripts/{$id}/revisions/{$revision}/review", ['decision' => 'approve', 'difficulty' => 'mudah', 'fee' => 1])->assertOk();

        // Belum ada tagihan cover sebelum editing selesai.
        $this->assertDatabaseMissing('cover_projects', ['manuscript_id' => $id]);

        Sanctum::actingAs($editor);
        $editRevision = $this->postJson("/api/v1/manuscripts/{$id}/revisions", ['file' => UploadedFile::fake()->create('e.pdf', 50, 'application/pdf')])->assertCreated()->json('data.revisions.1.id');

        // Admin lain yang menerima pemberitahuan (yang menyetujui tidak diberi tahu soal aksinya sendiri).
        $otherAdmin = $this->makeUser(['admin'], 'Admin Lain');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/manuscripts/{$id}/revisions/{$editRevision}/review", ['decision' => 'approve'])->assertOk();

        // Admin klik ACC editing: langsung muncul di tagihan cover paket.
        $this->assertDatabaseHas('cover_projects', ['manuscript_id' => $id, 'source' => 'package', 'stage' => 'urgent', 'status' => 'awaiting_upload', 'title' => 'Buku Cover']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $otherAdmin->id, 'category' => 'admin_cover', 'title' => 'Tagihan cover baru']);

        $list = $this->getJson('/api/v1/admin/covers/packages')->assertOk()->json('data');
        $this->assertSame(['Buku Cover'], collect($list)->pluck('title')->all());
        $this->getJson('/api/v1/admin/covers/chapters')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_single_author_picks_a_cover_and_it_is_final_and_publishable(): void
    {
        [$manuscript, $users] = $this->manuscript();
        $project = app(CoverService::class)->openForManuscript($manuscript);

        $this->uploadThree($project);
        $project->refresh();
        $this->assertSame('voting', $project->status);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $users[0]->id, 'category' => 'cover', 'title' => 'Pilih cover buku Anda']);

        // Orang lain tidak bisa melihat atau memilih.
        $stranger = $this->makeUser(['penulis'], 'Asing');
        $this->vote($stranger, $manuscript, $this->covers($project)[0]->id)->assertForbidden();
        Sanctum::actingAs($stranger);
        $this->getJson("/api/v1/covers/{$this->covers($project)[0]->id}/image")->assertForbidden();

        // Penulis melihat gambarnya, memilih cover 2 tanpa catatan -> langsung disetujui.
        Sanctum::actingAs($users[0]);
        $this->getJson("/api/v1/covers/{$this->covers($project)[0]->id}/image")->assertOk();
        $second = $this->covers($project)[1];
        $this->vote($users[0], $manuscript, $second->id)->assertOk();

        $project->refresh();
        $this->assertSame('approved', $project->status);
        $this->assertSame($second->id, $project->chosen_cover_id);
        $this->assertNotNull(Cover::find($second->id)->public_path);

        // Layak terbit: cover terpilih dipakai di buku saat diterbitkan.
        $manuscript->update(['status' => 'completed']);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Judul Cover', 'price' => 1, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
        $this->assertSame(Storage::disk('public')->url(Cover::find($second->id)->public_path), $book->fresh()->front_cover);
        $this->assertNotNull($project->fresh()->published_at);
    }

    public function test_publishing_is_blocked_until_the_cover_is_approved(): void
    {
        [$manuscript] = $this->manuscript(status: 'completed');
        app(CoverService::class)->openForManuscript($manuscript);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/books/from-manuscript/{$manuscript->id}", ['price' => 50000])->assertStatus(422)
            ->assertJsonPath('message', 'Cover buku belum disetujui penulis. Selesaikan dulu di menu Cover.');
        $this->assertSame(0, Book::count());
    }

    public function test_several_authors_vote_unanimous_closes_early_otherwise_most_votes_win_after_24_hours(): void
    {
        Carbon::setTestNow('2026-10-01 08:00:00');
        [$manuscript, $users] = $this->manuscript(3);
        $project = app(CoverService::class)->openForManuscript($manuscript);
        $this->uploadThree($project);
        [$c1, $c2, $c3] = $this->covers($project)->all();

        // Dua suara untuk cover 3, satu untuk cover 2: belum ditutup (waktu berunding 24 jam).
        $this->vote($users[0], $manuscript, $c3->id)->assertOk();
        $this->vote($users[1], $manuscript, $c3->id)->assertOk();
        $this->vote($users[2], $manuscript, $c2->id)->assertOk();
        $this->assertSame('voting', $project->fresh()->status);

        // Boleh berunding dan mengubah pilihan; waktu belum habis.
        Carbon::setTestNow('2026-10-02 07:00:00');
        $this->assertSame(0, app(CoverService::class)->tickAll());

        Carbon::setTestNow('2026-10-02 08:30:00');
        $this->assertSame(1, app(CoverService::class)->tickAll());
        $this->assertSame('approved', $project->fresh()->status);
        $this->assertSame($c3->id, $project->fresh()->chosen_cover_id);
    }

    public function test_unanimous_votes_close_immediately_and_ties_go_to_the_lowest_number(): void
    {
        Carbon::setTestNow('2026-10-01 08:00:00');
        [$manuscript, $users] = $this->manuscript(2);
        $project = app(CoverService::class)->openForManuscript($manuscript);
        $this->uploadThree($project);
        [$c1, $c2] = $this->covers($project)->all();

        $this->vote($users[0], $manuscript, $c2->id)->assertOk();
        $this->assertSame('voting', $project->fresh()->status);
        $this->vote($users[1], $manuscript, $c2->id)->assertOk();
        $this->assertSame('approved', $project->fresh()->status);

        // Seri (1 lawan 1) setelah 24 jam: cover bernomor terkecil.
        [$other, $others] = $this->manuscript(2);
        $second = app(CoverService::class)->openForManuscript($other);
        $this->uploadThree($second);
        [$d1, $d2] = $this->covers($second)->all();
        $this->vote($others[0], $other, $d2->id);
        $this->vote($others[1], $other, $d1->id);

        Carbon::setTestNow('2026-10-02 09:00:00');
        app(CoverService::class)->tickAll();
        $this->assertSame($d1->id, $second->fresh()->chosen_cover_id);
    }

    public function test_a_note_on_the_chosen_cover_sends_it_to_admin_for_revision_then_back_for_approval(): void
    {
        [$manuscript, $users] = $this->manuscript();
        $project = app(CoverService::class)->openForManuscript($manuscript);
        $this->uploadThree($project);
        $first = $this->covers($project)[0];

        $this->vote($users[0], $manuscript, $first->id, 'Judul kurang besar.')->assertOk();
        $project->refresh();
        $this->assertSame('revision', $project->status);
        $this->assertSame($first->id, $project->chosen_cover_id);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $this->admin->id, 'title' => 'Cover perlu direvisi']);

        // Admin mengunggah revisi -> penulis diminta acc (ronde 2, satu pilihan).
        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/covers/projects/{$project->id}/revision", ['file' => $this->image('r.png')], ['Accept' => 'application/json'])->assertOk();
        $project->refresh();
        $this->assertSame('voting', $project->status);
        $this->assertSame(2, $project->round);

        $revised = $this->covers($project);
        $this->assertCount(1, $revised);
        $this->assertSame('revision', $revised[0]->kind);

        $this->vote($users[0], $manuscript, $revised[0]->id)->assertOk();
        $this->assertSame('approved', $project->fresh()->status);
        $this->assertSame($revised[0]->id, $project->fresh()->chosen_cover_id);
    }

    public function test_choosing_none_makes_admin_prepare_three_new_options(): void
    {
        [$manuscript, $users] = $this->manuscript();
        $project = app(CoverService::class)->openForManuscript($manuscript);
        $this->uploadThree($project);

        $this->vote($users[0], $manuscript, null, 'Semua kurang cocok.')->assertOk();

        $project->refresh();
        $this->assertSame('awaiting_upload', $project->status);
        $this->assertSame(2, $project->round);

        $this->uploadThree($project);
        $this->assertSame('voting', $project->fresh()->status);
        $this->assertCount(3, $this->covers($project));
    }

    public function test_book_chapter_cover_starts_early_is_public_and_moves_to_packages_when_compiled(): void
    {
        $book = Book::create(['title' => 'Proyek Bab', 'price' => 1, 'discount' => 0, 'is_chapter_offering' => true, 'is_chapter_compilation' => true, 'is_active' => false, 'created_by' => $this->admin->id, 'submission_deadline' => now()->addMonth()]);
        $project = app(CoverService::class)->ensureChapterProject($book);

        Sanctum::actingAs($this->admin);
        $this->assertSame(['Proyek Bab'], collect($this->getJson('/api/v1/admin/covers/chapters')->json('data'))->pluck('title')->all());
        $this->getJson('/api/v1/admin/covers/packages')->assertJsonCount(0, 'data');

        // Cover awal tunggal tampil publik menggantikan cover bawaan.
        $this->post("/api/v1/admin/covers/projects/{$project->id}/covers", ['file' => $this->image(), 'position' => 1], ['Accept' => 'application/json'])->assertOk();
        $this->assertNotNull($book->fresh()->front_cover);
        $this->assertSame('awaiting_upload', $project->fresh()->status);

        // Pilihan lain baru boleh diunggah pada masa tenggat.
        $this->post("/api/v1/admin/covers/projects/{$project->id}/covers", ['file' => $this->image(), 'position' => 2], ['Accept' => 'application/json'])->assertStatus(422);
        $book->update(['submission_deadline' => now()->subDay()]);
        $this->post("/api/v1/admin/covers/projects/{$project->id}/covers", ['file' => $this->image(), 'position' => 2], ['Accept' => 'application/json'])->assertOk();
        $this->post("/api/v1/admin/covers/projects/{$project->id}/covers", ['file' => $this->image(), 'position' => 3], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame('awaiting_upload', $project->fresh()->status, 'Voting baru dibuka setelah naskah gabungan siap.');

        // Naskah gabungan di-auto layout admin: pindah ke cover paket dan voting dibuka.
        [$compilation, $authors] = $this->manuscript(2, 'in_editing');
        app(CoverService::class)->chapterCompiled($book, $compilation);

        $project->refresh();
        $this->assertSame('urgent', $project->stage);
        $this->assertSame('voting', $project->status);
        $this->assertSame(['Proyek Bab'], collect($this->getJson('/api/v1/admin/covers/packages')->json('data'))->pluck('title')->all());
        $this->getJson('/api/v1/admin/covers/chapters')->assertJsonCount(0, 'data');
    }

    public function test_seven_days_after_publication_covers_and_revision_documents_are_deleted_but_history_stays(): void
    {
        Carbon::setTestNow('2026-10-01 08:00:00');
        [$manuscript, $users] = $this->manuscript();
        $project = app(CoverService::class)->openForManuscript($manuscript);
        $this->uploadThree($project);
        [$c1, $c2, $c3] = $this->covers($project)->all();
        $this->vote($users[0], $manuscript, $c1->id);

        Storage::disk('local')->put('manuscripts/x/rev.pdf', 'x');
        $revision = ManuscriptRevision::create(['manuscript_id' => $manuscript->id, 'revision_number' => 1, 'uploaded_by' => $users[0]->id, 'role' => 'penulis', 'file_path' => 'manuscripts/x/rev.pdf', 'original_filename' => 'rev.pdf', 'admin_status' => 'approved']);

        $manuscript->update(['status' => 'completed']);
        Sanctum::actingAs($this->admin);
        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Judul Cover', 'price' => 1, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $users[0]->id, 'title' => 'Buku terbit — unduh berkas yang diperlukan']);

        // Hari ke-6: pengingat; berkas masih ada. Hari ke-7: dihapus.
        Carbon::setTestNow('2026-10-07 09:00:00');
        $service = app(CoverService::class);
        $this->assertSame(1, $service->warnDue());
        $this->assertSame(0, $service->purgeDue());
        $this->assertTrue(Storage::disk('local')->exists($c2->file_path ?? Cover::find($c2->id)->file_path));

        Carbon::setTestNow('2026-10-08 09:00:00');
        $this->assertSame(1, $service->purgeDue());

        foreach ([$c1, $c2, $c3] as $cover) {
            $fresh = Cover::find($cover->id);
            $this->assertNull($fresh->file_path);
            $this->assertNotNull($fresh->purged_at);
        }
        $this->assertFalse(Storage::disk('local')->exists('manuscripts/x/rev.pdf'));
        $this->assertNull($revision->fresh()->file_path);
        $this->assertNotNull($revision->fresh()->file_purged_at);

        // Tersisa: riwayat, cover terakhir (publik) di buku.
        $this->assertNotNull($project->fresh()->files_purged_at);
        $this->assertNotNull($book->fresh()->front_cover);
        $this->assertTrue(Storage::disk('public')->exists(Cover::find($c1->id)->public_path));
        $this->assertDatabaseHas('cover_events', ['cover_project_id' => $project->id, 'action' => 'purged']);

        Sanctum::actingAs($users[0]);
        $this->getJson("/api/v1/manuscripts/{$manuscript->id}/revisions/{$revision->id}/download")->assertNotFound();
    }

    public function test_admin_replaces_the_cover_of_a_published_book(): void
    {
        $book = Book::create(['title' => 'Buku Terbit', 'price' => 1, 'discount' => 0, 'is_active' => true, 'created_by' => $this->admin->id]);

        Sanctum::actingAs($this->admin);
        $this->assertContains('Buku Terbit', collect($this->getJson('/api/v1/admin/covers/books')->assertOk()->json('data'))->pluck('title')->all());

        $this->post("/api/v1/admin/covers/books/{$book->id}", ['file' => $this->image('final.png')], ['Accept' => 'application/json'])->assertOk();
        $this->assertNotNull($book->fresh()->front_cover);
        $this->assertDatabaseHas('cover_events', ['book_id' => $book->id, 'action' => 'book_cover_replaced']);
    }

    public function test_only_admin_can_manage_covers(): void
    {
        $author = $this->makeUser(['penulis'], 'Penulis');

        Sanctum::actingAs($author);
        $this->getJson('/api/v1/admin/covers/packages')->assertForbidden();
        $this->getJson('/api/v1/admin/covers/books')->assertForbidden();
    }
}
