<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\IsbnApplication;
use App\Models\IsbnLetterSetting;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use App\Support\Isbn\IsbnLetterRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IsbnApplicationTest extends TestCase
{
    use RefreshDatabase;

    /** PNG 1x1 RGBA 8-bit tanpa interlace. */
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roleNames = ['user'], bool $withProfile = true): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        if ($withProfile) {
            PersonalProfile::create([
                'user_id' => $user->id,
                'nik' => '2171000000000001',
                'ktp_address' => 'Jl. Contoh No. 5, Batam',
                'phone' => '081234567890',
            ]);
        }

        return $user;
    }

    private function makeManuscript(User $author, string $status = 'completed', array $coAuthors = []): Manuscript
    {
        $order = Order::create([
            'order_number' => 'ORD-'.uniqid(),
            'user_id' => $author->id,
            'status' => 'confirmed',
            'subtotal' => 1,
            'discount_total' => 0,
            'editor_fee' => 0,
            'total' => 1,
        ]);

        $manuscript = Manuscript::create([
            'order_id' => $order->id,
            'user_id' => $author->id,
            'title' => 'Judul Naskah Uji',
            'authors' => [$author->name],
            'status' => $status,
        ]);

        foreach (array_merge([$author], $coAuthors) as $index => $user) {
            ManuscriptAuthor::create([
                'manuscript_id' => $manuscript->id,
                'user_id' => $user->id,
                'position' => $index + 1,
                'approved_at' => now(),
            ]);
        }

        return $manuscript;
    }

    /** Admin menerbitkan buku dari naskah (halaman buku: /buku/{slug}). */
    private function publish(Manuscript $manuscript): Book
    {
        return Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => $manuscript->title,
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $manuscript->user_id,
        ]);
    }

    private function dataUrl(): string
    {
        return 'data:image/png;base64,'.self::PNG;
    }

    private function apply(User $user, Manuscript $manuscript)
    {
        Sanctum::actingAs($user);

        return $this->postJson('/api/v1/isbn-applications', ['manuscript_id' => $manuscript->id]);
    }

    public function test_first_author_opens_the_letter_after_the_manuscript_is_completed(): void
    {
        $first = $this->makeUser(['penulis']);
        $second = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscript($first, 'completed', [$second]);

        $response = $this->apply($first, $manuscript);

        $response->assertOk()
            ->assertJsonPath('data.type', 'regular')
            ->assertJsonPath('data.title', 'Judul Naskah Uji')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.signer_role', 'Penulis')
            ->assertJsonPath('data.applicant_data.nik', '2171000000000001');

        $this->assertStringContainsString($first->name, $response->json('data.authors_text'));
        $this->assertStringContainsString($second->name, $response->json('data.authors_text'));
        $this->assertMatchesRegularExpression('#^001/PISBN/TP/[IVX]+/\d{4}$#', $response->json('data.letter_number'));

        // Idempoten: membuka lagi memberi surat yang sama.
        $this->apply($first, $manuscript)->assertJsonPath('data.id', $response->json('data.id'));
        $this->assertSame(1, IsbnApplication::count());
    }

    public function test_only_the_first_author_and_only_for_completed_manuscripts(): void
    {
        $first = $this->makeUser(['penulis']);
        $second = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscript($first, 'completed', [$second]);

        $this->apply($second, $manuscript)->assertForbidden();
        $this->apply($this->makeUser(['penulis']), $manuscript)->assertForbidden();

        $editing = $this->makeManuscript($first, 'in_editing');
        $this->apply($first, $editing)->assertStatus(422);
    }

    public function test_incomplete_personal_data_asks_the_author_to_fill_it_in(): void
    {
        $author = $this->makeUser(['penulis'], withProfile: false);
        PersonalProfile::create(['user_id' => $author->id, 'nik' => '2171000000000002']);

        $this->apply($author, $this->makeManuscript($author))
            ->assertStatus(422)
            ->assertJsonPath('missing', ['address', 'phone']);

        $this->assertSame(0, IsbnApplication::count());
    }

    public function test_signing_locks_the_letter_and_only_the_owner_can_use_it(): void
    {
        $author = $this->makeUser(['penulis']);
        $id = $this->apply($author, $this->makeManuscript($author))->json('data.id');

        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => 'data:image/png;base64,bukangambar'])
            ->assertStatus(422);

        $response = $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])
            ->assertOk()
            ->assertJsonPath('data.status', 'signed')
            ->assertJsonPath('data.is_signed', true);

        $this->assertArrayNotHasKey('signature_path', $response->json('data'));

        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertStatus(422);
        $this->patchJson("/api/v1/isbn-applications/{$id}", ['availability_link' => 'x'])->assertStatus(405);

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->getJson("/api/v1/isbn-applications/{$id}")->assertForbidden();
        $this->getJson("/api/v1/isbn-applications/{$id}/download")->assertForbidden();
    }

    private function imageCount(string $pdf): int
    {
        return substr_count($pdf, '/Subtype /Image');
    }

    public function test_author_download_has_no_publisher_signature_or_stamp_but_admin_download_does(): void
    {
        $author = $this->makeUser(['penulis']);
        $admin = $this->makeUser(['admin']);
        $manuscript = $this->makeManuscript($author);
        $id = $this->apply($author, $manuscript)->json('data.id');
        $this->publish($manuscript);
        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertOk();

        // Tanda tangan + stempel penanggung jawab diunggah admin.
        Sanctum::actingAs($admin);
        foreach (['signature', 'stamp'] as $kind) {
            $this->post("/api/v1/admin/isbn-settings/assets/{$kind}", [
                'file' => UploadedFile::fake()->createWithContent("{$kind}.png", base64_decode(self::PNG)),
            ], ['Accept' => 'application/json'])->assertOk();
        }

        Sanctum::actingAs($author);
        $own = $this->get("/api/v1/isbn-applications/{$id}/download")->assertOk();
        $this->assertStringStartsWith('%PDF', $own->getContent());
        $this->assertSame('application/pdf', $own->headers->get('Content-Type'));
        // kop + tanda tangan penulis, tiap halaman (2 halaman, gambar dipakai ulang).
        $ownImages = $this->imageCount($own->getContent());

        Sanctum::actingAs($admin);
        $sealed = $this->get("/api/v1/admin/isbn-applications/{$id}/download")->assertOk();
        $this->assertGreaterThan($ownImages, $this->imageCount($sealed->getContent()));
    }

    public function test_admin_lists_signed_letters_and_downloading_marks_them_processed(): void
    {
        $author = $this->makeUser(['penulis']);
        $admin = $this->makeUser(['admin']);

        $signedManuscript = $this->makeManuscript($author);
        $signedId = $this->apply($author, $signedManuscript)->json('data.id');
        $this->publish($signedManuscript);
        $this->postJson("/api/v1/isbn-applications/{$signedId}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertOk();

        $other = $this->makeUser(['penulis']);
        $this->apply($other, $this->makeManuscript($other))->assertOk(); // masih draf

        Sanctum::actingAs($author);
        $this->getJson('/api/v1/admin/isbn-applications')->assertForbidden();

        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/isbn-applications')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'signed');

        // Pratinjau tidak menandai.
        $this->get("/api/v1/admin/isbn-applications/{$signedId}/download?inline=1")->assertOk();
        $this->assertSame('signed', IsbnApplication::find($signedId)->status);

        $this->get("/api/v1/admin/isbn-applications/{$signedId}/download")->assertOk();
        $application = IsbnApplication::find($signedId);
        $this->assertSame('processed', $application->status);
        $this->assertSame($admin->id, $application->processed_by);

        // Draf yang belum ditandatangani tidak bisa diunduh admin.
        $draft = IsbnApplication::where('status', 'draft')->first();
        $this->get("/api/v1/admin/isbn-applications/{$draft->id}/download")->assertStatus(422);
    }

    public function test_editor_signs_for_a_book_chapter_project_once_every_chapter_is_done(): void
    {
        $editor = $this->makeUser(['editor']);
        $writerA = $this->makeUser(['penulis']);
        $writerB = $this->makeUser(['penulis']);

        $book = Book::create([
            'title' => 'Antologi Uji',
            'price' => 100000,
            'discount' => 0,
            'is_active' => false,
            'is_chapter_compilation' => true,
            'is_editor_created' => true,
            'owner_editor_id' => $editor->id,
            'created_by' => $editor->id,
        ]);
        BookChapter::create(['book_id' => $book->id, 'manuscript_id' => $this->makeManuscript($writerA)->id, 'chapter_number' => 1, 'title' => 'Bab 1']);
        $open = BookChapter::create(['book_id' => $book->id, 'manuscript_id' => $this->makeManuscript($writerB, 'in_editing')->id, 'chapter_number' => 2, 'title' => 'Bab 2']);

        Sanctum::actingAs($editor);
        $this->postJson('/api/v1/isbn-applications', ['book_id' => $book->id])->assertStatus(422);

        $open->manuscript->update(['status' => 'completed']);

        Sanctum::actingAs($writerA);
        $this->postJson('/api/v1/isbn-applications', ['book_id' => $book->id])->assertForbidden();

        Sanctum::actingAs($editor);
        $response = $this->postJson('/api/v1/isbn-applications', ['book_id' => $book->id])
            ->assertOk()
            ->assertJsonPath('data.type', 'chapter')
            ->assertJsonPath('data.signer_role', 'Editor')
            ->assertJsonPath('data.title', 'Antologi Uji');

        $this->assertStringContainsString('Editor: '.$editor->name, $response->json('data.authors_text'));
        $this->assertStringContainsString($writerA->name, $response->json('data.authors_text'));
        $this->assertSame($editor->id, IsbnApplication::first()->applicant_id);
    }

    public function test_template_can_be_edited_reset_and_previewed(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $this->getJson('/api/v1/admin/isbn-settings')
            ->assertOk()
            ->assertJsonPath('data.responsible_name', 'Rahima Tartila')
            ->assertJsonPath('data.has_stamp', false);

        $payload = IsbnLetterSetting::DEFAULTS;
        $payload['responsible_name'] = 'Nama Baru';
        $payload['application_closing'] = 'Terima kasih banyak.';

        $this->putJson('/api/v1/admin/isbn-settings', $payload)
            ->assertOk()
            ->assertJsonPath('data.responsible_name', 'Nama Baru');

        $this->putJson('/api/v1/admin/isbn-settings', ['city' => ''] + $payload)->assertStatus(422);

        $preview = $this->get('/api/v1/admin/isbn-settings/preview')->assertOk();
        $this->assertStringStartsWith('%PDF', $preview->getContent());

        $this->postJson('/api/v1/admin/isbn-settings/reset')
            ->assertOk()
            ->assertJsonPath('data.responsible_name', 'Rahima Tartila')
            ->assertJsonPath('data.application_closing', IsbnLetterSetting::DEFAULTS['application_closing']);
    }

    public function test_asset_upload_rejects_unsupported_png_and_non_admins(): void
    {
        // PNG 16-bit palsu (byte 24 = 16)
        $png = base64_decode(self::PNG);
        $png[24] = chr(16);

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->post('/api/v1/admin/isbn-settings/assets/stamp', [
            'file' => UploadedFile::fake()->createWithContent('stamp.png', $png),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->post('/api/v1/admin/isbn-settings/assets/unknown', [
            'file' => UploadedFile::fake()->createWithContent('x.png', base64_decode(self::PNG)),
        ], ['Accept' => 'application/json'])->assertNotFound();

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->getJson('/api/v1/admin/isbn-settings')->assertForbidden();
        $this->getJson('/api/v1/admin/isbn-settings/assets/stamp')->assertForbidden();
    }

    public function test_my_manuscripts_list_points_to_the_letter(): void
    {
        $first = $this->makeUser(['penulis']);
        $second = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscript($first, 'completed', [$second]);
        $editing = $this->makeManuscript($first, 'in_editing');

        $row = fn ($user, $id) => collect($this->actingAs($user, 'sanctum')->getJson('/api/v1/manuscripts/mine')->assertOk()->json('data'))->firstWhere('id', $id);

        // Belum ada surat: hanya penulis pertama dan naskah selesai yang bisa mengajukan.
        $this->assertTrue($row($first, $manuscript->id)['can_request_isbn']);
        $this->assertFalse($row($second, $manuscript->id)['can_request_isbn']);
        $this->assertFalse($row($first, $editing->id)['can_request_isbn']);
        $this->assertNull($row($first, $manuscript->id)['isbn_application']);

        $id = $this->apply($first, $manuscript)->json('data.id');

        // Sesudah dibuka (juga setelah kembali ke daftar): tautan ke surat yang sama.
        $mine = $row($first, $manuscript->id);
        $this->assertFalse($mine['can_request_isbn']);
        $this->assertSame($id, $mine['isbn_application']['id']);
        $this->assertSame($first->id, $mine['isbn_application']['applicant_id']);
        $this->assertSame('draft', $mine['isbn_application']['status']);
        $this->assertArrayNotHasKey('applicant_data', $mine['isbn_application']);
    }

    public function test_link_is_the_book_page_and_is_filled_when_admin_continues_to_sign(): void
    {
        $author = $this->makeUser(['penulis']);
        $admin = $this->makeUser(['admin']);
        $manuscript = $this->makeManuscript($author);

        // Penulis boleh mengajukan sebelum buku terbit; link belum ada.
        $response = $this->apply($author, $manuscript)->assertOk()->assertJsonPath('data.availability_link', null);
        $id = $response->json('data.id');
        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertOk();

        // Admin: buku belum terbit -> tidak bisa lanjut tanda tangan.
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/isbn-applications')
            ->assertJsonPath('data.0.book_published', false)
            ->assertJsonPath('data.0.book_url', null);
        $this->getJson("/api/v1/admin/isbn-applications/{$id}/download")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Terbitkan bukunya dulu sebelum surat diberi tanda tangan dan stempel.');
        $this->assertSame('signed', IsbnApplication::find($id)->status);

        // Setelah admin menerbitkan buku, linknya = halaman buku, terisi saat lanjut.
        $book = $this->publish($manuscript);
        $expected = rtrim(config('app.frontend_url'), '/').'/buku/'.$book->slug;

        $this->getJson('/api/v1/admin/isbn-applications')
            ->assertJsonPath('data.0.book_published', true)
            ->assertJsonPath('data.0.book_url', $expected);

        $this->get("/api/v1/admin/isbn-applications/{$id}/download")->assertOk();
        $application = IsbnApplication::find($id);
        $this->assertSame($expected, $application->availability_link);
        $this->assertSame('processed', $application->status);
    }

    public function test_draft_link_follows_the_book_once_it_is_published(): void
    {
        $author = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscript($author);
        $id = $this->apply($author, $manuscript)->json('data.id');

        $book = $this->publish($manuscript);

        Sanctum::actingAs($author);
        $this->getJson("/api/v1/isbn-applications/{$id}")
            ->assertJsonPath('data.availability_link', rtrim(config('app.frontend_url'), '/').'/buku/'.$book->slug);
    }

    public function test_admin_sees_prefilled_isbn_form_data_and_can_edit_it(): void
    {
        $first = $this->makeUser(['penulis']);
        $second = $this->makeUser(['penulis']);
        $editor = $this->makeUser(['editor']);
        $admin = $this->makeUser(['admin']);

        $manuscript = $this->makeManuscript($first, 'completed', [$second]);
        $manuscript->update(['editor_id' => $editor->id]);
        $book = $this->publish($manuscript);
        $book->update(['cover_layout_designer' => 'Desainer Uji', 'description' => 'Abstrak buku uji.', 'includes_isbn_print' => true]);

        $id = $this->apply($first, $manuscript)->json('data.id');
        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertOk();

        // Penulis tidak melihat isian admin.
        $this->assertArrayNotHasKey('form', $this->getJson("/api/v1/isbn-applications/{$id}")->json('data'));

        Sanctum::actingAs($admin);
        $row = $this->getJson('/api/v1/admin/isbn-applications')->assertOk()->json('data.0');
        $form = $row['form'];

        $this->assertSame('lepas', $form['request_type']);
        $this->assertSame('Judul Naskah Uji', $form['title']);
        $this->assertSame([$first->name, $second->name], $form['authors']);
        $this->assertSame($editor->name, $form['editor']);
        $this->assertSame('Desainer Uji', $form['designer']);
        $this->assertSame('cetak', $form['media']);
        $this->assertNull($form['reader_group']);
        $this->assertSame('ya', $form['kdt']);
        $this->assertSame('Kepulauan Riau', $form['province']);
        $this->assertSame('Kota Batam', $form['city']);
        $this->assertSame('Tartila Press', $form['distributor']);
        $this->assertSame('Abstrak buku uji.', $form['description']);
        $this->assertSame('Pertama', $form['edition']);
        $this->assertSame('tidak', $form['illustrations']);
        $this->assertSame(
            IsbnLetterRenderer::formatMonthYear(IsbnApplication::find($id)->created_at->copy()->addDays(7)),
            $form['estimated_publish']
        );
        $this->assertSame($row['book_url'], $form['publication_url']);
        $this->assertSame([], $row['attachments']['dummy_files']);

        $this->patchJson("/api/v1/admin/isbn-applications/{$id}/form", [
            'media' => 'epub',
            'reader_group' => 'semua_umur',
            'literature_type' => 'non_fiksi',
            'translation' => 'non_terjemahan',
            'pages' => 120,
            'height_cm' => 21,
            'illustrations' => 'ya',
            'authors' => [$second->name, $first->name],
        ])->assertOk()->assertJsonPath('data.media', 'epub')->assertJsonPath('data.pages', 120);

        $edited = $this->getJson('/api/v1/admin/isbn-applications')->json('data.0.form');
        $this->assertSame('semua_umur', $edited['reader_group']);
        $this->assertSame([$second->name, $first->name], $edited['authors']);
        $this->assertSame('Desainer Uji', $edited['designer']); // yang tidak diubah tetap

        $this->patchJson("/api/v1/admin/isbn-applications/{$id}/form", ['media' => 'kaset'])->assertStatus(422);

        Sanctum::actingAs($first);
        $this->patchJson("/api/v1/admin/isbn-applications/{$id}/form", ['media' => 'pdf'])->assertForbidden();
    }

    public function test_admin_downloads_the_dummy_and_cover_for_the_file_attachment(): void
    {
        Storage::fake('public');

        $author = $this->makeUser(['penulis']);
        $admin = $this->makeUser(['admin']);
        $manuscript = $this->makeManuscript($author);
        $book = $this->publish($manuscript);

        // Revisi terakhir naskah = dummy.
        Storage::disk('local')->put('manuscripts/dummy.pdf', '%PDF-1.4 dummy');
        $manuscript->revisions()->create(['revision_number' => 1, 'uploaded_by' => $author->id, 'role' => 'penulis', 'file_path' => 'manuscripts/dummy.pdf', 'original_filename' => 'Dummy Buku.pdf']);

        $id = $this->apply($author, $manuscript)->json('data.id');
        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertOk();

        Sanctum::actingAs($admin);

        $attachments = $this->getJson('/api/v1/admin/isbn-applications')->json('data.0.attachments');
        $this->assertSame(['label' => 'Naskah', 'filename' => 'Dummy Buku.pdf', 'is_pdf' => true], $attachments['dummy']);
        $this->assertFalse($attachments['has_cover']);

        $dummy = $this->get("/api/v1/admin/isbn-applications/{$id}/dummy")->assertOk();
        $this->assertSame('%PDF-1.4 dummy', $dummy->streamedContent());

        // Ebook buku terbit didahulukan.
        Storage::disk('local')->put('ebooks/buku.pdf', '%PDF-1.7 ebook');
        $book->forceFill(['ebook_file' => 'ebooks/buku.pdf', 'ebook_name' => 'Buku Lengkap.pdf'])->save();
        $this->assertSame('%PDF-1.7 ebook', $this->get("/api/v1/admin/isbn-applications/{$id}/dummy")->streamedContent());

        // Cover belum ada -> 404; sesudah ada, gambarnya diteruskan.
        $this->get("/api/v1/admin/isbn-applications/{$id}/cover")->assertNotFound();

        Storage::disk('public')->put('covers/uji.png', base64_decode(self::PNG));
        $book->update(['front_cover' => '/storage/covers/uji.png']);

        $cover = $this->get("/api/v1/admin/isbn-applications/{$id}/cover")->assertOk();
        $this->assertSame('image/png', $cover->headers->get('Content-Type'));
        $this->assertSame(base64_decode(self::PNG), $cover->getContent());

        // Hanya admin.
        Sanctum::actingAs($author);
        $this->get("/api/v1/admin/isbn-applications/{$id}/dummy")->assertForbidden();
        $this->get("/api/v1/admin/isbn-applications/{$id}/cover")->assertForbidden();
    }

    public function test_dummy_without_any_pdf_falls_back_to_the_word_file(): void
    {
        $author = $this->makeUser(['penulis']);
        $manuscript = $this->makeManuscript($author);
        $this->publish($manuscript);

        Storage::disk('local')->put('manuscripts/naskah.docx', 'isi');
        $manuscript->revisions()->create(['revision_number' => 1, 'uploaded_by' => $author->id, 'role' => 'penulis', 'file_path' => 'manuscripts/naskah.docx', 'original_filename' => 'Naskah.docx']);

        $id = $this->apply($author, $manuscript)->json('data.id');
        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => $this->dataUrl(), 'mou_agreed' => true])->assertOk();

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->assertSame(
            ['label' => 'Naskah', 'filename' => 'Naskah.docx', 'is_pdf' => false],
            $this->getJson('/api/v1/admin/isbn-applications')->json('data.0.attachments.dummy')
        );
    }
}
