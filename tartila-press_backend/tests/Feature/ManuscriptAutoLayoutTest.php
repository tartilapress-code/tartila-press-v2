<?php

namespace Tests\Feature;

use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Services\ManuscriptAutoLayoutService;
use App\Support\ManuscriptTemplates\DefaultTemplates;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\DocxFixture;
use Tests\TestCase;
use ZipArchive;

class ManuscriptAutoLayoutTest extends TestCase
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

    private function makeUser(array $roles): User
    {
        $user = User::create([
            'name' => 'Test User '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /** Naskah berstatus "submitted" dengan revisi penulis (.docx atau .pdf). */
    private function submitted(string $extension = 'docx'): array
    {
        $author = $this->makeUser(['penulis']);
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
            'title' => 'Embedded System',
            'authors' => [$author->name],
            'status' => 'submitted',
        ]);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $author->id, 'position' => 1]);

        $path = 'manuscripts/'.$manuscript->id.'/naskah.'.$extension;

        if ($extension === 'docx') {
            $temp = tempnam(sys_get_temp_dir(), 'fx').'.docx';
            DocxFixture::make($temp);
            Storage::disk('local')->put($path, file_get_contents($temp));
            @unlink($temp);
        } else {
            Storage::disk('local')->put($path, '%PDF-1.4 palsu');
        }

        $revision = $manuscript->revisions()->create([
            'revision_number' => 1,
            'uploaded_by' => $author->id,
            'role' => 'penulis',
            'file_path' => $path,
            'original_filename' => 'naskah.'.$extension,
            'admin_status' => 'pending',
        ]);

        return [$manuscript, $revision, $author];
    }

    public function test_author_bios_come_from_the_upload_form_or_the_public_profile(): void
    {
        Storage::fake('public');
        Http::fake([
            '93.184.215.14/*' => Http::response(base64_decode(DocxFixture::PNG), 200, ['Content-Type' => 'image/png']),
            '*' => Http::response('', 404),
        ]);

        [$manuscript, , $author] = $this->submitted();
        Storage::disk('public')->put('uploads/bio-photos/penulis.png', base64_decode(DocxFixture::PNG));

        // Pengunggah: isian saat upload menang atas Profil Publik.
        $author->publicProfile()->create(['slug' => 'penulis-satu', 'pen_name' => 'Nama Pena', 'bio' => 'Bio profil.', 'is_published' => true]);
        $manuscript->update([
            'author_bio_name' => 'Nama Saat Upload',
            'author_bio_photo' => Storage::disk('public')->url('uploads/bio-photos/penulis.png'),
        ]);

        // Penulis pendamping: dari Profil Publik (foto tautan luar).
        $second = $this->makeUser(['penulis']);
        $second->publicProfile()->create(['slug' => 'penulis-dua', 'pen_name' => 'Penulis Dua', 'bio' => 'Bio penulis dua.', 'profile_photo' => 'https://93.184.215.14/dua.png', 'is_published' => true]);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $second->id, 'position' => 2]);

        // Alamat jaringan internal tidak diunduh.
        $third = $this->makeUser(['penulis']);
        $third->publicProfile()->create(['slug' => 'penulis-tiga', 'bio' => 'Bio tiga.', 'profile_photo' => 'http://127.0.0.1/rahasia.png', 'is_published' => true]);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $third->id, 'position' => 3]);

        // Tanpa bio dan foto: dilewati.
        $fourth = $this->makeUser(['penulis']);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $fourth->id, 'position' => 4]);

        $bios = app(ManuscriptAutoLayoutService::class)->data($manuscript->fresh())['author_bio'];

        $this->assertSame(['Nama Saat Upload', 'Penulis Dua', $third->name], array_column($bios, 'name'));
        $this->assertSame(['Bio profil.', 'Bio penulis dua.', 'Bio tiga.'], array_column($bios, 'bio'));
        $this->assertSame(base64_decode(DocxFixture::PNG), $bios[0]['photo']);
        $this->assertSame(base64_decode(DocxFixture::PNG), $bios[1]['photo']);
        $this->assertNull($bios[2]['photo']);
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '127.0.0.1'));
    }

    public function test_the_embedded_system_template_is_installed_as_the_default(): void
    {
        $default = ManuscriptTemplate::default();

        $this->assertNotNull($default);
        $this->assertTrue($default->is_default);
        $this->assertSame(DefaultTemplates::EMBEDDED_SYSTEM_NAME, $default->name);
        $this->assertSame('B5', $default->config['page']['format']);
        $this->assertSame('Constantia', $default->config['typography']['body']['font']);
        $this->assertSame('{judul} | {nomor}', $default->config['footer']['odd_right']);
    }

    public function test_approving_with_auto_layout_sends_a_word_file_to_the_editor(): void
    {
        [$manuscript, $revision] = $this->submitted();
        $admin = $this->makeUser(['admin']);

        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review", [
            'decision' => 'approve',
            'auto_layout' => true,
        ])->assertOk();

        $manuscript->refresh();
        $layout = ManuscriptRevision::where('manuscript_id', $manuscript->id)->where('role', 'layout')->first();

        $this->assertNotNull($layout);
        $this->assertSame(2, $layout->revision_number);
        $this->assertSame('approved', $layout->admin_status);
        $this->assertSame($admin->id, $layout->uploaded_by);
        $this->assertSame('embedded-system-auto-layout.docx', $layout->original_filename);
        $this->assertStringContainsString(DefaultTemplates::EMBEDDED_SYSTEM_NAME, $layout->note);
        $this->assertSame(ManuscriptTemplate::default()->id, $manuscript->manuscript_template_id);
        $this->assertSame('pending_editor_assignment', $manuscript->status);

        // Berkasnya dokumen Word dengan ukuran halaman B5.
        $temp = tempnam(sys_get_temp_dir(), 'lay');
        file_put_contents($temp, Storage::disk('local')->get($layout->file_path));
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($temp) === true);
        $this->assertStringContainsString('w:w="9978"', (string) $zip->getFromName('word/document.xml'));
        $zip->close();
        @unlink($temp);

        // Revisi asli penulis tetap ada dan disetujui.
        $this->assertSame('approved', $revision->fresh()->admin_status);
    }

    public function test_admin_can_pick_another_template_and_preview_without_saving(): void
    {
        [$manuscript, $revision] = $this->submitted();
        $admin = $this->makeUser(['admin']);
        $a4 = ManuscriptTemplate::create(['name' => 'A4', 'config' => ['page' => ['format' => 'A4']], 'is_active' => true]);

        Sanctum::actingAs($admin);

        $preview = $this->get("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/auto-layout?template_id={$a4->id}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $this->assertStringStartsWith('PK', $preview->getContent());
        $this->assertSame(1, ManuscriptRevision::where('manuscript_id', $manuscript->id)->count(), 'Pratinjau tidak menyimpan revisi.');

        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review", [
            'decision' => 'approve',
            'auto_layout' => true,
            'manuscript_template_id' => $a4->id,
        ])->assertOk();

        $this->assertSame($a4->id, $manuscript->fresh()->manuscript_template_id);
    }

    public function test_auto_layout_needs_a_docx_and_nothing_changes_when_it_fails(): void
    {
        [$manuscript, $revision] = $this->submitted('pdf');

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review", [
            'decision' => 'approve',
            'auto_layout' => true,
        ])->assertStatus(422);

        $this->assertSame('pending', $revision->fresh()->admin_status);
        $this->assertSame('submitted', $manuscript->fresh()->status);

        // Tanpa auto layout tetap bisa disetujui seperti biasa.
        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review", [
            'decision' => 'approve',
        ])->assertOk();

        $this->assertSame(0, ManuscriptRevision::where('role', 'layout')->count());
    }

    public function test_rejecting_ignores_auto_layout_and_only_admins_preview(): void
    {
        [$manuscript, $revision, $author] = $this->submitted();

        Sanctum::actingAs($author);
        $this->get("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/auto-layout")->assertForbidden();

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->postJson("/api/v1/admin/manuscripts/{$manuscript->id}/revisions/{$revision->id}/review", [
            'decision' => 'reject',
            'auto_layout' => true,
        ])->assertOk();

        $this->assertSame(0, ManuscriptRevision::where('role', 'layout')->count());
        $this->assertSame('revision_requested', $manuscript->fresh()->status);
    }

    public function test_default_template_can_be_switched_but_not_deleted(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $default = ManuscriptTemplate::default();
        $other = ManuscriptTemplate::create(['name' => 'Lain', 'config' => [], 'is_active' => false]);

        $this->deleteJson("/api/v1/admin/manuscript-templates/{$default->id}")->assertStatus(422);

        $this->postJson("/api/v1/admin/manuscript-templates/{$other->id}/make-default")
            ->assertOk()
            ->assertJsonPath('data.is_default', true)
            ->assertJsonPath('data.is_active', true);

        $this->assertFalse($default->fresh()->is_default);
        $this->assertSame($other->id, ManuscriptTemplate::default()->id);
        $this->getJson('/api/v1/admin/manuscript-templates')->assertJsonPath('data.0.id', $other->id);

        $this->deleteJson("/api/v1/admin/manuscript-templates/{$default->id}")->assertOk();
    }
}
