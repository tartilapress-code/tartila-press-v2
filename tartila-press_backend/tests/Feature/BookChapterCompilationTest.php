<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\ChapterRevisionRequest;
use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Models\Mou;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\ManuscriptAutoLayoutService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\DocxFixture;
use Tests\TestCase;
use ZipArchive;

class BookChapterCompilationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $editor;

    /** @var list<string> */
    private array $temp = [];

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin']);
        $this->editor = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $this->editor->id, 'fee' => 50000, 'is_available' => true]);
    }

    protected function tearDown(): void
    {
        array_map('unlink', array_filter($this->temp, 'file_exists'));
        parent::tearDown();
    }

    private function makeUser(array $roles): User
    {
        $user = User::create([
            'name' => 'Penguji '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    private function chapterFile(string $marker): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'bab').'.docx';
        DocxFixture::chapter($path, "Judul $marker", "Penulis $marker", $marker);
        $this->temp[] = $path;

        return new UploadedFile($path, "bab-$marker.docx", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);
    }

    /** Proyek dengan $count bab; editor pemilik proyek = $this->editor. */
    private function project(int $count = 2): Book
    {
        Sanctum::actingAs($this->admin);

        $id = $this->postJson('/api/v1/admin/book-chapter-projects', [
            'title' => 'Buku Bersama IoT',
            'price' => 100000,
            'discount' => 0,
            'includes_isbn_print' => false,
            'owner_editor_id' => $this->editor->id,
            'chapters' => array_map(fn ($n) => ['title' => "Topik $n"], range(1, $count)),
        ])->assertCreated()->json('data.id');

        return Book::findOrFail($id);
    }

    /** Penulis membeli slot bab, dibayar, lalu mengunggah naskah .docx. */
    private function submitChapter(Book $book, int $index, string $marker): array
    {
        $author = $this->makeUser(['penulis']);
        $chapter = $book->chapters()->orderBy('chapter_number')->get()[$index];

        Sanctum::actingAs($author);
        $order = $this->postJson('/api/v1/orders', ['type' => 'book_chapter', 'book_chapter_id' => $chapter->id])->json('data');

        Sanctum::actingAs($this->admin);
        $this->patchJson("/api/v1/admin/orders/{$order['id']}/status", ['status' => 'confirmed'])->assertOk();

        Sanctum::actingAs($author);
        $manuscript = $this->postJson('/api/v1/manuscripts', ['manuscript_template_id' => ManuscriptTemplate::default()?->id, 'order_id' => $order['id'], 'file' => $this->chapterFile($marker)])
            ->assertCreated()->json('data');

        return [Manuscript::findOrFail($manuscript['id']), $author];
    }

    private function approveLatest(Manuscript $manuscript): void
    {
        Sanctum::actingAs($this->admin);
        $revision = $manuscript->latestRevision();
        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review", ['decision' => 'approve'])->assertOk();
    }

    private function compile(Book $book, array $payload = ['auto_layout' => true])
    {
        Sanctum::actingAs($this->admin);

        return $this->postJson("/api/v1/admin/book-chapter-projects/{$book->id}/compilation", $payload);
    }

    private function documentXml(ManuscriptRevision $revision): string
    {
        $file = tempnam(sys_get_temp_dir(), 'hasil');
        $this->temp[] = $file;
        file_put_contents($file, Storage::disk('local')->get($revision->file_path));
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($file) === true);
        $xml = (string) $zip->getFromName('word/document.xml');
        $zip->close();

        return $xml;
    }

    public function test_chapters_wait_for_each_other_then_become_one_book_for_the_editor(): void
    {
        $book = $this->project();
        [$first, $authorA] = $this->submitChapter($book, 0, 'A');
        [$second, $authorB] = $this->submitChapter($book, 1, 'B');

        // Bab disetujui admin tidak langsung ke editor.
        $this->approveLatest($first);
        $this->assertSame('awaiting_compilation', $first->fresh()->status);
        $this->assertNull($first->fresh()->editor_id);

        Sanctum::actingAs($this->admin);
        $this->getJson("/api/v1/admin/book-chapter-projects/{$book->id}/compilation")
            ->assertOk()
            ->assertJsonPath('data.blockers', ['BAB 2 belum disetujui admin.'])
            ->assertJsonPath('data.compilation', null);
        $this->compile($book)->assertStatus(422);

        $this->approveLatest($second);

        $response = $this->compile($book)->assertCreated();
        $compilation = Manuscript::findOrFail($response->json('data.id'));

        // Satu naskah buku untuk editor pemilik proyek; penulis = penulis tiap bab.
        $this->assertSame($book->id, $compilation->compiled_book_id);
        $this->assertNull($compilation->order_id);
        $this->assertSame('in_editing', $compilation->status);
        $this->assertSame($this->editor->id, $compilation->editor_id);
        $this->assertSame(Manuscript::EDITOR_SOURCE_PROJECT_OWNER, $compilation->editor_source);
        $this->assertSame([$authorA->id, $authorB->id], $compilation->authorLinks()->pluck('user_id')->all());
        $this->assertSame(['compiled', 'compiled'], [$first->fresh()->status, $second->fresh()->status]);

        // Notifikasi: editor sekali saja (naskah gabungan disimpan beberapa
        // kali dalam satu transaksi), penulis bab diberi tahu.
        $this->assertSame(1, UserNotification::where('user_id', $this->editor->id)->where('title', 'Naskah baru ditugaskan kepada Anda')->count());
        $this->assertTrue(UserNotification::where('user_id', $authorB->id)->where('title', 'Naskah semua bab sudah digabung')->exists());

        // Berkas gabungan: BAB 1 lalu BAB 2, sudah di-auto layout (B5).
        $revision = $compilation->revisions()->first();
        $this->assertSame('compilation', $revision->role);
        $this->assertSame('approved', $revision->admin_status);
        $xml = $this->documentXml($revision);
        $this->assertLessThan(strpos($xml, 'BAB 2'), strpos($xml, 'BAB 1'));
        $this->assertStringContainsString('Isi bab A', $xml);
        $this->assertStringContainsString('Isi bab B', $xml);
        $this->assertStringContainsString('w:w="9978"', $xml);

        // Editor: naskah gabungan di daftarnya + naskah awal per bab.
        Sanctum::actingAs($this->editor);
        $this->assertContains($compilation->id, collect($this->getJson('/api/v1/editor/manuscripts')->json('data'))->pluck('id')->all());
        $chapters = $this->getJson("/api/v1/manuscripts/{$compilation->id}/compilation-chapters")->assertOk()->json('data');
        $this->assertSame([1, 2], array_column($chapters, 'chapter_number'));
        $this->assertSame('bab-B.docx', $chapters[1]['manuscript']['revisions'][0]['original_filename']);

        $chapterRevision = $chapters[1]['manuscript']['revisions'][0]['id'];
        $this->get("/api/v1/manuscripts/{$second->id}/revisions/{$chapterRevision}/download")->assertOk();

        // Editor lain tidak boleh.
        Sanctum::actingAs($this->makeUser(['editor']));
        $this->getJson("/api/v1/manuscripts/{$compilation->id}/compilation-chapters")->assertForbidden();
        $this->get("/api/v1/manuscripts/{$second->id}/revisions/{$chapterRevision}/download")->assertForbidden();
    }

    public function test_a_revision_note_on_a_chapter_goes_to_that_chapters_author(): void
    {
        $book = $this->project();
        [$first] = $this->submitChapter($book, 0, 'A');
        [$second, $authorB] = $this->submitChapter($book, 1, 'B');
        $this->approveLatest($first);
        $this->approveLatest($second);
        $compilation = Manuscript::findOrFail($this->compile($book)->json('data.id'));

        Sanctum::actingAs($this->editor);
        $this->postJson("/api/v1/manuscripts/{$compilation->id}/compilation-chapters/{$second->id}/revision-request", ['note' => 'Lengkapi sumber Tabel 2.1.'])
            ->assertCreated();

        $this->assertSame('revision_requested', $second->fresh()->status);
        $this->assertSame('compiled', $first->fresh()->status);

        // Penulis bab 2 melihat catatannya dan mengunggah revisi (.docx).
        Sanctum::actingAs($authorB);
        $this->getJson("/api/v1/manuscripts/{$second->id}")
            ->assertOk()
            ->assertJsonPath('data.chapter_revision_requests.0.note', 'Lengkapi sumber Tabel 2.1.');
        $this->post("/api/v1/manuscripts/{$second->id}/revisions", ['file' => UploadedFile::fake()->create('revisi.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertStatus(422);
        $this->post("/api/v1/manuscripts/{$second->id}/revisions", ['file' => $this->chapterFile('B2')], ['Accept' => 'application/json'])
            ->assertCreated();
        $this->assertSame('submitted', $second->fresh()->status);

        // Penggabungan ulang menunggu revisi bab disetujui admin.
        $this->compile($book)->assertStatus(422);
        $this->approveLatest($second->fresh());
        $this->assertSame('compiled', $second->fresh()->status);
        $this->assertNotNull(ChapterRevisionRequest::first()->resolved_at);

        // Admin bisa menggabung ulang: revisi gabungan baru memakai bab terbaru.
        $this->compile($book)->assertOk();
        $latest = $compilation->revisions()->where('role', 'compilation')->reorder('revision_number', 'desc')->first();
        $this->assertSame(2, $compilation->revisions()->where('role', 'compilation')->count());
        $this->assertStringContainsString('Isi bab B2', $this->documentXml($latest));

        // Penulis bab tidak boleh memberi catatan revisi.
        Sanctum::actingAs($authorB);
        $this->postJson("/api/v1/manuscripts/{$compilation->id}/compilation-chapters/{$first->id}/revision-request", ['note' => 'x'])->assertForbidden();
    }

    public function test_final_review_by_every_chapter_author_completes_all_chapters(): void
    {
        $book = $this->project();
        [$first, $authorA] = $this->submitChapter($book, 0, 'A');
        [$second, $authorB] = $this->submitChapter($book, 1, 'B');
        $this->approveLatest($first);
        $this->approveLatest($second);
        $compilation = Manuscript::findOrFail($this->compile($book)->json('data.id'));

        Sanctum::actingAs($this->editor);
        $this->post("/api/v1/manuscripts/{$compilation->id}/revisions", ['file' => $this->chapterFile('editor')], ['Accept' => 'application/json'])
            ->assertCreated();
        $this->approveLatest($compilation->fresh());
        $this->assertSame('pending_penulis_review', $compilation->fresh()->status);

        // MOU Book Chapter disetujui saat menyetujui naskah akhir.
        foreach ([$authorA, $authorB] as $author) {
            PersonalProfile::create(['user_id' => $author->id, 'nik' => '2171000000000001', 'ktp_address' => 'Batam', 'phone' => '0812']);
        }

        $approve = ['decision' => 'approve', 'mou_agreed' => true, 'signature' => 'data:image/png;base64,'.DocxFixture::PNG];

        Sanctum::actingAs($authorA);
        $this->postJson("/api/v1/manuscripts/{$compilation->id}/final-review", ['decision' => 'approve'])->assertStatus(422);
        $this->postJson("/api/v1/manuscripts/{$compilation->id}/final-review", $approve)->assertOk();
        $this->assertSame('pending_penulis_review', $compilation->fresh()->status);

        Sanctum::actingAs($authorB);
        $this->postJson("/api/v1/manuscripts/{$compilation->id}/final-review", $approve)->assertOk();

        $this->assertSame('completed', $compilation->fresh()->status);
        $this->assertSame(Mou::STATUS_SIGNED, $book->chapterMou()->first()->status);
        $this->assertSame(['completed', 'completed'], [$first->fresh()->status, $second->fresh()->status]);

        // Naskah gabungan tidak memunculkan tombol ISBN pribadi.
        $mine = collect($this->getJson('/api/v1/manuscripts/mine')->json('data'))->firstWhere('id', $compilation->id);
        $this->assertFalse($mine['can_request_isbn']);

        // Selesai → tidak bisa digabung ulang.
        $this->compile($book)->assertStatus(422);
    }

    public function test_security_nobody_reaches_another_projects_chapters_or_compilation(): void
    {
        // Proyek A (editor $this->editor) dan proyek B (editor lain), keduanya digabung.
        $bookA = $this->project();
        [$a1, $authorA1] = $this->submitChapter($bookA, 0, 'A');
        [$a2] = $this->submitChapter($bookA, 1, 'B');
        $this->approveLatest($a1);
        $this->approveLatest($a2);
        $compilationA = Manuscript::findOrFail($this->compile($bookA)->json('data.id'));

        $editorB = $this->makeUser(['editor']);
        EditorProfile::create(['user_id' => $editorB->id, 'fee' => 1, 'is_available' => true]);
        $bookB = $this->project();
        $bookB->update(['owner_editor_id' => $editorB->id]);
        [$b1] = $this->submitChapter($bookB, 0, 'C');
        [$b2] = $this->submitChapter($bookB, 1, 'D');
        $this->approveLatest($b1);
        $this->approveLatest($b2);
        $compilationB = Manuscript::findOrFail($this->compile($bookB)->json('data.id'));
        $b1Revision = $b1->latestRevision()->id;

        // Editor A tidak bisa memberi catatan / mengunduh bab proyek B.
        Sanctum::actingAs($this->editor);
        $this->postJson("/api/v1/manuscripts/{$compilationA->id}/compilation-chapters/{$b1->id}/revision-request", ['note' => 'x'])->assertNotFound();
        $this->get("/api/v1/manuscripts/{$b1->id}/revisions/{$b1Revision}/download")->assertForbidden();
        $this->getJson("/api/v1/manuscripts/{$compilationB->id}")->assertForbidden();
        $this->getJson("/api/v1/manuscripts/{$compilationB->id}/compilation-chapters")->assertForbidden();
        $this->assertSame('compiled', $b1->fresh()->status);

        // Penulis bab A: hanya melihat naskah gabungan bukunya, tidak bisa
        // mengelola bab, mengunggah ke naskah gabungan, atau membuka bab lain.
        Sanctum::actingAs($authorA1);
        $this->getJson("/api/v1/manuscripts/{$compilationA->id}")->assertOk();
        $this->getJson("/api/v1/manuscripts/{$compilationA->id}/compilation-chapters")->assertForbidden();
        $this->postJson("/api/v1/manuscripts/{$compilationA->id}/compilation-chapters/{$a2->id}/revision-request", ['note' => 'x'])->assertForbidden();
        $this->post("/api/v1/manuscripts/{$compilationA->id}/revisions", ['file' => $this->chapterFile('X')], ['Accept' => 'application/json'])->assertStatus(422);
        $this->get("/api/v1/manuscripts/{$a2->id}/revisions/{$a2->latestRevision()->id}/download")->assertForbidden();
        $this->getJson("/api/v1/manuscripts/{$compilationB->id}")->assertForbidden();

        // Naskah gabungan yang selesai tidak bisa dipakai membuka surat ISBN pribadi.
        $compilationA->update(['status' => 'completed']);
        $this->postJson('/api/v1/isbn-applications', ['manuscript_id' => $compilationA->id])->assertStatus(422);

        // Buku biasa (bukan proyek Book Chapter) tidak bisa "digabung".
        Sanctum::actingAs($this->admin);
        $plain = Book::create(['title' => 'Buku Biasa Uji', 'price' => 1, 'created_by' => $this->admin->id]);
        $this->getJson("/api/v1/admin/book-chapter-projects/{$plain->id}/compilation")->assertNotFound();
        $this->postJson("/api/v1/admin/book-chapter-projects/{$plain->id}/compilation", ['auto_layout' => false])->assertStatus(422);
    }

    public function test_security_author_photo_path_cannot_escape_the_public_disk(): void
    {
        Storage::fake('public');
        Storage::disk('local')->put('rahasia.png', base64_decode(DocxFixture::PNG));

        $book = $this->project();
        [$chapter] = $this->submitChapter($book, 0, 'A');

        foreach (['../local/rahasia.png', '../../../../.env', '/etc/passwd', 'C:\\Windows\\win.ini', 'file:///C:/Windows/win.ini'] as $path) {
            $chapter->update(['author_bio_text' => 'Bio uji.', 'author_bio_photo' => $path]);
            $data = app(ManuscriptAutoLayoutService::class)->compilationData($book, [$chapter->fresh()], null);

            $this->assertNull($data['author_bio'][0]['photo'], "Foto terbaca dari $path");
        }
    }

    public function test_missing_chapters_need_confirmation_and_without_owner_editor_admin_assigns(): void
    {
        $book = $this->project(3);
        $book->update(['owner_editor_id' => null]);
        [$first] = $this->submitChapter($book, 0, 'A');
        [$third] = $this->submitChapter($book, 2, 'C');
        $this->approveLatest($first);
        $this->approveLatest($third);

        $this->compile($book)->assertStatus(422)->assertJsonPath('message', 'Masih ada 1 bab yang belum terisi naskah. Gabungkan tanpa bab tersebut?');

        $compilation = Manuscript::findOrFail($this->compile($book, ['auto_layout' => false, 'allow_missing' => true])->assertCreated()->json('data.id'));
        $this->assertSame('pending_editor_assignment', $compilation->status);
        $this->assertStringContainsString('BAB 1, 3', $compilation->revisions()->first()->note);

        // Admin menugaskan editor seperti naskah biasa (tanpa pesanan).
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/v1/admin/manuscripts/{$compilation->id}/assign-editor", ['editor_id' => $this->editor->id, 'fee' => 250000])
            ->assertOk();
        $this->assertSame('in_editing', $compilation->fresh()->status);
    }
}
