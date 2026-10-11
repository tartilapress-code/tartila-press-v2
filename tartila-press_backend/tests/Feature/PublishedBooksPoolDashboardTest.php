<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\FieldCategory;
use App\Models\HkiRecord;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Buku Terbit penulis (ebook, HKI, sertifikat), kriteria editor pool +
 * tingkat kesulitan naskah, dan ringkasan dashboard.
 */
class PublishedBooksPoolDashboardTest extends TestCase
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

    private function makeUser(array $roles, string $name): User
    {
        $user = User::create(['name' => $name, 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /**
     * Buku terbit dari naskah dua penulis lewat pesanan paket.
     *
     * @return array{0: Book, 1: User, 2: User, 3: Order}
     */
    private function publishedBook(array $facilities = ['ISBN', 'HKI']): array
    {
        $writer = $this->makeUser(['penulis'], 'Penulis Satu');
        $coWriter = $this->makeUser(['penulis'], 'Penulis Dua');

        $package = Package::create(['name' => 'Paket '.uniqid(), 'price' => 1000000, 'discount' => 0, 'facilities' => $facilities, 'created_by' => $this->admin->id]);
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $writer->id, 'status' => 'completed', 'subtotal' => 1000000, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1000000]);
        $order->items()->create(['itemable_type' => Package::class, 'itemable_id' => $package->id, 'name' => $package->name, 'quantity' => 1, 'unit_price' => 1000000, 'subtotal' => 1000000, 'discount' => 0]);
        $order->logStatusHistory('payment_confirmed');

        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $writer->id, 'title' => 'Sistem Tertanam', 'authors' => ['Penulis Satu', 'Penulis Dua'], 'status' => 'completed']);
        $manuscript->authorLinks()->create(['user_id' => $writer->id, 'position' => 1]);
        $manuscript->authorLinks()->create(['user_id' => $coWriter->id, 'position' => 2]);

        $book = Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Sistem Tertanam', 'authors' => ['Penulis Satu', 'Penulis Dua'], 'isbn' => '978-623-00-0000-1', 'price' => 85000, 'created_by' => $this->admin->id]);

        return [$book, $writer, $coWriter, $order];
    }

    private function pdf(string $name = 'ebook.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n%%EOF\n");
    }

    // =====================================================================
    // Buku Terbit + ebook
    // =====================================================================

    public function test_author_sees_published_books_with_ebook_hki_and_certificate_info(): void
    {
        [$book, $writer, $coWriter, $order] = $this->publishedBook();

        Sanctum::actingAs($writer);
        $this->getJson('/api/v1/my-published-books')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $book->id)
            ->assertJsonPath('data.0.ebook', null)
            ->assertJsonPath('data.0.hki.status', 'pending')
            ->assertJsonPath('data.0.hki.certificate_id', null)
            ->assertJsonPath('data.0.author_certificate', null);

        // Admin mengunggah ebook → semua penulis mendapat notifikasi.
        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => $this->pdf('Sistem Tertanam Final.pdf')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.has_ebook', true);

        $this->assertSame(2, UserNotification::where('category', 'book')->whereIn('user_id', [$writer->id, $coWriter->id])->count());

        $path = $book->fresh()->ebook_file;
        Storage::disk('local')->assertExists($path);

        // Admin mengunggah sertifikat HKI → muncul di buku terbit penulis.
        $this->post("/api/v1/admin/hki/order/{$order->id}/certificate", ['file' => $this->pdf('hki.pdf')], ['Accept' => 'application/json'])
            ->assertOk();
        $recordId = HkiRecord::value('id');

        Sanctum::actingAs($coWriter);
        $this->getJson('/api/v1/my-published-books')
            ->assertOk()
            ->assertJsonPath('data.0.ebook.name', 'Sistem Tertanam Final.pdf')
            ->assertJsonPath('data.0.hki.status', 'registered')
            ->assertJsonPath('data.0.hki.certificate_id', $recordId);

        $this->get("/api/v1/my-published-books/{$book->id}/ebook")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->get("/api/v1/hki-certificates/{$recordId}/download")->assertOk();

        // Berkas ebook tidak pernah muncul di API publik.
        $public = $this->getJson("/api/v1/books/{$book->slug}")->assertOk()->json('data');
        $this->assertArrayNotHasKey('ebook_file', $public);
        $this->assertArrayNotHasKey('ebook_name', $public);
    }

    public function test_only_authors_and_admin_can_download_the_ebook(): void
    {
        [$book, $writer] = $this->publishedBook();

        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();
        $this->get("/api/v1/admin/books/{$book->id}/ebook")->assertOk();

        Sanctum::actingAs($this->makeUser(['penulis'], 'Orang Lain'));
        $this->getJson("/api/v1/my-published-books/{$book->id}/ebook")->assertNotFound();
        $this->getJson('/api/v1/my-published-books')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson("/api/v1/admin/books/{$book->id}/ebook", [])->assertForbidden();

        // Buku yang dinonaktifkan tidak lagi termasuk buku terbit.
        $book->forceFill(['is_active' => false])->save();
        Sanctum::actingAs($writer);
        $this->getJson("/api/v1/my-published-books/{$book->id}/ebook")->assertNotFound();
    }

    public function test_ebook_upload_validates_type_and_replaces_previous_file(): void
    {
        [$book] = $this->publishedBook(['ISBN']);

        Sanctum::actingAs($this->admin);
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => UploadedFile::fake()->create('ebook.docx', 10)], ['Accept' => 'application/json'])
            ->assertUnprocessable();

        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();
        $first = $book->fresh()->ebook_file;
        $this->post("/api/v1/admin/books/{$book->id}/ebook", ['file' => $this->pdf()], ['Accept' => 'application/json'])->assertOk();
        $second = $book->fresh()->ebook_file;

        $this->assertNotSame($first, $second);
        Storage::disk('local')->assertMissing($first);

        // Tanpa HKI di paket → tidak ada bagian HKI.
        Sanctum::actingAs(User::where('name', 'Penulis Satu')->first());
        $this->getJson('/api/v1/my-published-books')->assertJsonPath('data.0.hki', null);

        Sanctum::actingAs($this->admin);
        $this->deleteJson("/api/v1/admin/books/{$book->id}/ebook")->assertOk()->assertJsonPath('data.has_ebook', false);
        Storage::disk('local')->assertMissing($second);
    }

    // =====================================================================
    // Pool naskah: kriteria editor + tingkat kesulitan
    // =====================================================================

    private function manuscriptAwaitingEditor(string $title = 'Naskah Pool'): Manuscript
    {
        $writer = $this->makeUser(['penulis'], 'Penulis '.$title);

        return Manuscript::create(['user_id' => $writer->id, 'title' => $title, 'authors' => [$writer->name], 'status' => 'pending_editor_assignment']);
    }

    public function test_pool_criteria_limit_which_editors_see_and_claim_a_manuscript(): void
    {
        $law = FieldCategory::create(['name' => 'Hukum']);
        $health = FieldCategory::create(['name' => 'Kesehatan']);

        $lawEditor = $this->makeUser(['editor'], 'Editor Hukum');
        $generalEditor = $this->makeUser(['editor'], 'Editor Umum');

        Sanctum::actingAs($this->admin);
        $this->putJson("/api/v1/admin/manuscript-pool/editors/{$lawEditor->id}", ['field_category_ids' => [$law->id, $health->id]])
            ->assertOk()
            ->assertJsonPath('data.field_category_ids', [$law->id, $health->id]);
        $this->putJson("/api/v1/admin/manuscript-pool/editors/{$this->admin->id}", ['field_category_ids' => [$law->id]])
            ->assertUnprocessable();

        $special = $this->manuscriptAwaitingEditor('Naskah Hukum');
        $general = $this->manuscriptAwaitingEditor('Naskah Umum');

        $this->postJson("/api/v1/admin/manuscripts/{$special->id}/open-pool", ['fee' => 300000, 'difficulty' => 'sulit', 'pool_field_category_ids' => [$law->id]])
            ->assertOk()
            ->assertJsonPath('data.difficulty', 'sulit')
            ->assertJsonPath('data.pool_field_category_ids', [$law->id]);
        $this->postJson("/api/v1/admin/manuscripts/{$general->id}/open-pool", ['fee' => 200000, 'difficulty' => 'mudah'])
            ->assertOk();

        // Notifikasi pool hanya ke editor yang memenuhi kriteria.
        $this->assertTrue(UserNotification::where('user_id', $lawEditor->id)->where('subject_id', $special->id)->where('category', 'pool')->exists());
        $this->assertFalse(UserNotification::where('user_id', $generalEditor->id)->where('subject_id', $special->id)->where('category', 'pool')->exists());
        $this->assertTrue(UserNotification::where('user_id', $generalEditor->id)->where('subject_id', $general->id)->where('category', 'pool')->exists());

        $pool = collect($this->getJson('/api/v1/admin/manuscript-pool')
            ->assertOk()
            ->assertJsonCount(2, 'data.manuscripts')
            ->json('data.manuscripts'))->keyBy('id');
        $this->assertSame('Hukum', $pool[$special->id]['criteria']['field_categories'][0]['name']);
        $this->assertSame(1, $pool[$special->id]['eligible_editor_count']);
        $this->assertTrue($pool[$general->id]['criteria']['general']);
        $this->assertSame(2, $pool[$general->id]['eligible_editor_count']);

        Sanctum::actingAs($generalEditor);
        $this->getJson('/api/v1/editor/manuscript-pool')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $general->id)
            ->assertJsonPath('data.0.difficulty', 'mudah');
        $this->postJson("/api/v1/editor/manuscript-pool/{$special->id}/claim")->assertForbidden();
        $this->assertTrue($special->fresh()->open_for_claim);

        Sanctum::actingAs($lawEditor);
        $this->getJson('/api/v1/editor/manuscript-pool')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.my_field_categories', ['Hukum', 'Kesehatan']);
        $this->postJson("/api/v1/editor/manuscript-pool/{$special->id}/claim")->assertOk();
        $this->assertSame($lawEditor->id, $special->fresh()->editor_id);
    }

    public function test_admin_sets_difficulty_when_accepting_the_author_manuscript(): void
    {
        $manuscript = $this->manuscriptAwaitingEditor();
        $manuscript->update(['status' => 'submitted']);
        $revision = ManuscriptRevision::create(['manuscript_id' => $manuscript->id, 'revision_number' => 1, 'uploaded_by' => $manuscript->user_id, 'role' => 'penulis', 'file_path' => 'manuscripts/x.pdf', 'original_filename' => 'x.pdf', 'admin_status' => 'pending']);

        Sanctum::actingAs($this->admin);
        $url = "/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review";

        $this->postJson($url, ['decision' => 'approve', 'difficulty' => 'ekstrem'])->assertUnprocessable();
        $this->postJson($url, ['decision' => 'approve', 'difficulty' => 'sedang'])->assertOk();

        $this->assertSame('sedang', $manuscript->fresh()->difficulty);
        $this->assertSame('pending_editor_assignment', $manuscript->fresh()->status);

        // Bisa diubah kemudian lewat pengaturan pool; kosongkan kriteria = umum.
        $field = FieldCategory::create(['name' => 'Teknik']);
        $this->putJson("/api/v1/admin/manuscripts/{$manuscript->id}/pool-settings", ['difficulty' => 'sulit', 'pool_field_category_ids' => [$field->id]])
            ->assertOk()
            ->assertJsonPath('data.difficulty', 'sulit');
        $this->putJson("/api/v1/admin/manuscripts/{$manuscript->id}/pool-settings", ['pool_field_category_ids' => []])
            ->assertOk()
            ->assertJsonPath('data.pool_field_category_ids', null)
            ->assertJsonPath('data.difficulty', 'sulit');
        $this->putJson("/api/v1/admin/manuscripts/{$manuscript->id}/pool-settings", ['pool_field_category_ids' => [999]])
            ->assertUnprocessable();

        Sanctum::actingAs($this->makeUser(['editor'], 'Editor'));
        $this->putJson("/api/v1/admin/manuscripts/{$manuscript->id}/pool-settings", ['difficulty' => 'mudah'])->assertForbidden();
        $this->getJson('/api/v1/admin/manuscript-pool')->assertForbidden();
    }

    // =====================================================================
    // Ringkasan dashboard
    // =====================================================================

    public function test_dashboard_summary_is_grouped_per_role(): void
    {
        $this->getJson('/api/v1/dashboard/summary')->assertUnauthorized();

        [$book, $writer] = $this->publishedBook();
        Manuscript::create(['user_id' => $writer->id, 'title' => 'Revisi', 'authors' => ['x'], 'status' => 'revision_requested']);

        Sanctum::actingAs($writer);
        $data = $this->getJson('/api/v1/dashboard/summary')->assertOk()->json('data');
        $this->assertSame(['account', 'writer', 'wallet'], array_column($data['sections'], 'key'));

        $writerItems = collect($data['sections'][1]['items'])->keyBy('key');
        $this->assertEquals(1, $writerItems['published_books']['value']);
        $this->assertEquals(1, $writerItems['manuscript_revision']['value']);
        $this->assertTrue($writerItems['manuscript_revision']['attention']);

        $editor = $this->makeUser(['editor'], 'Editor');
        $this->manuscriptAwaitingEditor()->update(['open_for_claim' => true]);

        Sanctum::actingAs($editor);
        $data = $this->getJson('/api/v1/dashboard/summary')->assertOk()->json('data');
        $this->assertSame(['account', 'editor', 'wallet'], array_column($data['sections'], 'key'));
        $this->assertEquals(1, collect($data['sections'][1]['items'])->firstWhere('key', 'editor_pool')['value']);

        Sanctum::actingAs($this->admin);
        $data = $this->getJson('/api/v1/dashboard/summary')->assertOk()->json('data');
        $this->assertSame(['account', 'admin'], array_column($data['sections'], 'key'));
        $adminItems = collect($data['sections'][1]['items'])->keyBy('key');
        $this->assertEquals(1, $adminItems['admin_pool']['value']);
        $this->assertEquals(1000000, $adminItems['admin_revenue']['value']);
    }
}
