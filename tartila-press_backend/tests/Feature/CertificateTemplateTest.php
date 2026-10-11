<?php

namespace Tests\Feature;

use App\Models\CertificateTemplate;
use App\Models\Event;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SampleImages;
use Tests\TestCase;

class CertificateTemplateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roleNames = ['user']): User
    {
        $user = User::create([
            'name' => 'Pengguna '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function actingAsAdmin(): User
    {
        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function uploadImage(?UploadedFile $file = null): array
    {
        $response = $this->postJson('/api/v1/admin/certificate-templates/upload-image', [
            'image' => $file ?? SampleImages::pngUpload(),
        ]);

        $response->assertStatus(201);

        return $response->json('data');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function sampleFields(): array
    {
        return [
            [
                'id' => 'f1',
                'text' => '{name}',
                'x' => 0.1,
                'y' => 0.4,
                'w' => 0.8,
                'h' => 0.12,
                'font' => 'greatvibes',
                'bold' => false,
                'size' => 48,
                'color' => '#96641A',
                'align' => 'center',
                'valign' => 'middle',
                'uppercase' => false,
                'autoFit' => true,
            ],
            [
                'id' => 'f2',
                'text' => "{event_title}\n{event_date}",
                'x' => 0.2,
                'y' => 0.6,
                'w' => 0.6,
                'h' => 0.15,
                'font' => 'montserrat',
                'bold' => true,
                'size' => 18,
                'color' => '#173f5f',
                'align' => 'center',
                'valign' => 'top',
                'uppercase' => true,
                'autoFit' => true,
            ],
        ];
    }

    private function createTemplate(array $overrides = []): CertificateTemplate
    {
        $image = $overrides['image'] ?? $this->uploadImage();

        $response = $this->postJson('/api/v1/admin/certificate-templates', array_merge([
            'type' => 'event',
            'name' => 'Templat Webinar',
            'image_path' => $image['path'],
            'fields' => $this->sampleFields(),
        ], array_diff_key($overrides, ['image' => true])));

        $response->assertStatus(201);

        return CertificateTemplate::findOrFail($response->json('data.id'));
    }

    public function test_only_admins_can_manage_templates(): void
    {
        $this->getJson('/api/v1/admin/certificate-templates')->assertStatus(401);

        Sanctum::actingAs($this->makeUser());

        $this->getJson('/api/v1/admin/certificate-templates')->assertStatus(403);
        $this->getJson('/api/v1/admin/certificate-templates/meta')->assertStatus(403);
        $this->postJson('/api/v1/admin/certificate-templates', [])->assertStatus(403);
    }

    public function test_editor_meta_lists_fonts_variables_and_layout_constants(): void
    {
        $this->actingAsAdmin();

        $response = $this->getJson('/api/v1/admin/certificate-templates/meta');

        $response->assertOk();
        $response->assertJsonPath('data.default_font', 'montserrat');
        $response->assertJsonPath('data.layout.line_height', 1.25);
        $response->assertJsonPath('data.layout.page_long_side_pt', 841.89);

        $fonts = collect($response->json('data.fonts'));
        $this->assertCount(11, $fonts);
        $this->assertSame('Cinzel-Regular.ttf', $fonts->firstWhere('key', 'cinzel')['regular_file']);
        $this->assertNull($fonts->firstWhere('key', 'greatvibes')['bold_file']);

        $eventTokens = collect($response->json('data.variables.event'))->pluck('token');
        $this->assertTrue($eventTokens->contains('name'));
        $this->assertTrue($eventTokens->contains('event_date'));
        $this->assertTrue($eventTokens->contains('answer_'));

        $publicationTokens = collect($response->json('data.variables.publication'))->pluck('token');
        foreach (['name', 'role', 'book_title', 'isbn', 'published_date'] as $token) {
            $this->assertTrue($publicationTokens->contains($token), $token);
        }
    }

    public function test_admin_can_upload_png_and_jpeg_template_images(): void
    {
        $this->actingAsAdmin();

        foreach ([SampleImages::pngUpload(), SampleImages::jpegUpload()] as $file) {
            $data = $this->uploadImage($file);

            $this->assertStringStartsWith('certificate-templates/', $data['path']);
            $this->assertMatchesRegularExpression('/\.(jpg|png)$/', $data['path']);
            $this->assertSame(420, $data['width']);
            $this->assertSame(297, $data['height']);
            $this->assertNotEmpty($data['url']);
            Storage::disk('public')->assertExists($data['path']);
        }
    }

    public function test_upload_rejects_non_images_and_images_that_are_too_small(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/certificate-templates/upload-image', [
            'image' => UploadedFile::fake()->createWithContent('catatan.txt', 'bukan gambar'),
        ])->assertStatus(422)->assertJsonValidationErrors('image');

        $this->postJson('/api/v1/admin/certificate-templates/upload-image', [
            'image' => SampleImages::pngUpload('kecil.png', 100, 80),
        ])->assertStatus(422)->assertJsonValidationErrors('image');

        $this->postJson('/api/v1/admin/certificate-templates/upload-image', [])
            ->assertStatus(422)->assertJsonValidationErrors('image');
    }

    public function test_transparent_png_is_flattened_with_gd_or_rejected_without_it(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/v1/admin/certificate-templates/upload-image', [
            'image' => SampleImages::pngUpload('transparan.png', 420, 297, true),
        ]);

        if (function_exists('imagejpeg') && function_exists('imagecreatefrompng')) {
            $response->assertStatus(201);
            $this->assertStringEndsWith('.jpg', $response->json('data.path'));
        } else {
            $response->assertStatus(422)->assertJsonValidationErrors('image');
        }
    }

    public function test_large_images_are_downscaled_and_those_that_cannot_fit_in_memory_are_refused(): void
    {
        if (! function_exists('imagejpeg') || ! function_exists('imagecreatefrompng')) {
            $this->markTestSkipped('GD tidak terpasang di mesin ini.');
        }

        $this->actingAsAdmin();

        $data = $this->uploadImage(SampleImages::grayPngUpload('besar.png', 4200, 2970));
        $this->assertSame(3508, $data['width'], 'sisi terpanjang diperkecil ke 3508 px');
        $this->assertSame(2481, $data['height']);

        // Berkasnya dibuat dulu: yang dibatasi hanya pemrosesan di server.
        $file = SampleImages::grayPngUpload('besar.png', 4200, 2970);
        $limit = ini_get('memory_limit');
        ini_set('memory_limit', '96M');

        try {
            $this->postJson('/api/v1/admin/certificate-templates/upload-image', [
                'image' => $file,
            ])->assertStatus(422)
                ->assertJsonPath('errors.image.0', 'Gambar terlalu besar untuk diproses server. Perkecil resolusinya (mis. A4 pada 300 dpi = 3508 x 2480 px).');
        } finally {
            ini_set('memory_limit', $limit);
        }
    }

    public function test_admin_creates_an_event_template_with_normalized_fields(): void
    {
        $admin = $this->actingAsAdmin();

        $template = $this->createTemplate(['role' => 'editor']);

        $this->assertSame('event', $template->type);
        $this->assertNull($template->role, 'templat event tidak punya peran');
        $this->assertSame($admin->id, $template->created_by);
        $this->assertSame(420, $template->image_width);
        $this->assertSame(297, $template->image_height);
        $this->assertTrue($template->is_active);
        $this->assertCount(2, $template->fields);
        $this->assertSame('#96641a', $template->fields[0]['color']);
        $this->assertTrue($template->fields[1]['uppercase']);
        $this->assertNotEmpty($template->image_url);
    }

    public function test_publication_template_keeps_its_role(): void
    {
        $this->actingAsAdmin();

        $template = $this->createTemplate(['type' => 'publication', 'role' => 'author', 'name' => 'Sertifikat Penulis']);

        $this->assertSame('publication', $template->type);
        $this->assertSame('author', $template->role);
    }

    public function test_store_validates_the_fields(): void
    {
        $this->actingAsAdmin();
        $image = $this->uploadImage();
        $payload = [
            'type' => 'event',
            'name' => 'Templat',
            'image_path' => $image['path'],
            'fields' => $this->sampleFields(),
        ];

        $badFont = $payload;
        $badFont['fields'][0]['font'] = 'comic-sans';
        $this->postJson('/api/v1/admin/certificate-templates', $badFont)
            ->assertStatus(422)->assertJsonValidationErrors('fields.0.font');

        $badColor = $payload;
        $badColor['fields'][1]['color'] = 'merah';
        $this->postJson('/api/v1/admin/certificate-templates', $badColor)
            ->assertStatus(422)->assertJsonValidationErrors('fields.1.color');

        $outside = $payload;
        $outside['fields'][0]['x'] = 1.5;
        $this->postJson('/api/v1/admin/certificate-templates', $outside)
            ->assertStatus(422)->assertJsonValidationErrors('fields.0.x');

        $tooSmall = $payload;
        $tooSmall['fields'][0]['size'] = 2;
        $this->postJson('/api/v1/admin/certificate-templates', $tooSmall)
            ->assertStatus(422)->assertJsonValidationErrors('fields.0.size');

        $unknownImage = $payload;
        $unknownImage['image_path'] = 'certificate-templates/tidak-ada.jpg';
        $this->postJson('/api/v1/admin/certificate-templates', $unknownImage)
            ->assertStatus(422)->assertJsonValidationErrors('image_path');

        $traversal = $payload;
        $traversal['image_path'] = '../.env';
        $this->postJson('/api/v1/admin/certificate-templates', $traversal)
            ->assertStatus(422)->assertJsonValidationErrors('image_path');

        $badType = $payload;
        $badType['type'] = 'lainnya';
        $this->postJson('/api/v1/admin/certificate-templates', $badType)
            ->assertStatus(422)->assertJsonValidationErrors('type');

        $this->assertSame(0, CertificateTemplate::count());
    }

    public function test_update_changes_the_fields_and_replaces_the_image_removing_the_old_file(): void
    {
        $this->actingAsAdmin();
        $template = $this->createTemplate();
        $oldPath = $template->image_path;
        $newImage = $this->uploadImage(SampleImages::jpegUpload());

        $fields = $this->sampleFields();
        $fields[0]['text'] = 'Diberikan kepada {name}';

        $this->patchJson("/api/v1/admin/certificate-templates/{$template->id}", [
            'name' => 'Templat Baru',
            'is_active' => false,
            'image_path' => $newImage['path'],
            'fields' => $fields,
        ])->assertOk();

        $template->refresh();

        $this->assertSame('Templat Baru', $template->name);
        $this->assertFalse($template->is_active);
        $this->assertSame($newImage['path'], $template->image_path);
        $this->assertSame('Diberikan kepada {name}', $template->fields[0]['text']);
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($newImage['path']);
    }

    public function test_update_without_an_image_keeps_the_current_one(): void
    {
        $this->actingAsAdmin();
        $template = $this->createTemplate();

        $this->patchJson("/api/v1/admin/certificate-templates/{$template->id}", ['name' => 'Hanya ganti nama'])
            ->assertOk();

        Storage::disk('public')->assertExists($template->fresh()->image_path);
        $this->assertCount(2, $template->fresh()->fields);
    }

    public function test_template_in_use_by_an_event_cannot_be_deleted(): void
    {
        $admin = $this->actingAsAdmin();
        $template = $this->createTemplate();

        $event = Event::create([
            'title' => 'Event dengan Sertifikat',
            'starts_at' => now()->addWeek(),
            'created_by' => $admin->id,
            'certificate_template_id' => $template->id,
        ]);

        $this->deleteJson("/api/v1/admin/certificate-templates/{$template->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Templat ini masih dipakai oleh 1 event. Ganti templat di event tersebut dulu.');

        $this->assertDatabaseHas('certificate_templates', ['id' => $template->id]);

        $event->update(['certificate_template_id' => null]);

        $this->deleteJson("/api/v1/admin/certificate-templates/{$template->id}")->assertOk();

        $this->assertDatabaseMissing('certificate_templates', ['id' => $template->id]);
        Storage::disk('public')->assertMissing($template->image_path);
    }

    public function test_index_filters_by_type_and_reports_how_many_events_use_each_template(): void
    {
        $admin = $this->actingAsAdmin();
        $eventTemplate = $this->createTemplate(['name' => 'Untuk Event']);
        $this->createTemplate(['type' => 'publication', 'role' => 'editor', 'name' => 'Untuk Editor']);

        Event::create([
            'title' => 'Event Uji',
            'starts_at' => now()->addWeek(),
            'created_by' => $admin->id,
            'certificate_template_id' => $eventTemplate->id,
        ]);

        $all = $this->getJson('/api/v1/admin/certificate-templates');
        $all->assertOk();
        $this->assertCount(2, $all->json('data'));

        $events = $this->getJson('/api/v1/admin/certificate-templates?type=event');
        $this->assertCount(1, $events->json('data'));
        $events->assertJsonPath('data.0.name', 'Untuk Event');
        $events->assertJsonPath('data.0.events_count', 1);

        $this->getJson('/api/v1/admin/certificate-templates?type=bukan')->assertStatus(422);
    }

    public function test_preview_returns_a_pdf_for_an_unsaved_design(): void
    {
        $this->actingAsAdmin();
        $image = $this->uploadImage();

        $fields = $this->sampleFields();
        $fields[1]['text'] = '{event_title} {answer_institusi}';

        foreach ([false, true] as $long) {
            $response = $this->postJson('/api/v1/admin/certificate-templates/preview', [
                'type' => 'event',
                'image_path' => $image['path'],
                'fields' => $fields,
                'long' => $long,
            ]);

            $response->assertOk();
            $response->assertHeader('content-type', 'application/pdf');
            $this->assertStringStartsWith('%PDF-', $response->getContent());
        }

        $this->assertSame(0, CertificateTemplate::count(), 'pratinjau tidak menyimpan apa pun');
    }

    public function test_preview_requires_a_valid_design(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/v1/admin/certificate-templates/preview', [
            'type' => 'event',
            'image_path' => 'certificate-templates/tidak-ada.jpg',
            'fields' => $this->sampleFields(),
        ])->assertStatus(422)->assertJsonValidationErrors('image_path');
    }

    public function test_font_files_are_public_but_only_the_registered_ones(): void
    {
        $response = $this->withHeaders(['Origin' => 'http://localhost:5173'])
            ->get('/api/v1/certificate-fonts/Cinzel-Regular.ttf');

        $response->assertOk();
        $response->assertHeader('content-type', 'font/ttf');
        $response->assertHeader('access-control-allow-origin');

        $this->get('/api/v1/certificate-fonts/Cinzel-Bold.ttf')->assertOk();
        $this->get('/api/v1/certificate-fonts/GreatVibes-Bold.ttf')->assertStatus(404);
        $this->get('/api/v1/certificate-fonts/LICENSES.txt')->assertStatus(404);
        $this->get('/api/v1/certificate-fonts/'.rawurlencode('..\\..\\.env'))->assertStatus(404);
    }

    public function test_social_poster_templates_have_their_own_variables_and_serve_their_image(): void
    {
        $this->actingAsAdmin();

        $meta = $this->getJson('/api/v1/admin/certificate-templates/meta')->assertOk();
        $tokens = collect($meta->json('data.variables.social'))->pluck('token')->all();

        $this->assertSame(['judul', 'penulis', 'isbn', 'harga', 'link', 'blurb', 'quote', 'cover'], $tokens);

        $fields = [[
            'id' => 'f1', 'text' => '{judul}', 'x' => 0.05, 'y' => 0.1, 'w' => 0.5, 'h' => 0.1,
            'font' => 'montserrat', 'bold' => true, 'size' => 40, 'color' => '#10315f',
            'align' => 'left', 'valign' => 'top', 'uppercase' => true, 'autoFit' => true,
        ]];

        $template = $this->createTemplate(['type' => 'social', 'name' => 'Poster TERBIT', 'fields' => $fields]);

        $this->assertSame('social', $template->type);
        $this->assertNull($template->role);

        $this->getJson('/api/v1/admin/certificate-templates?type=social')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/admin/certificate-templates?type=event')->assertOk()->assertJsonCount(0, 'data');

        $image = $this->get("/api/v1/admin/certificate-templates/{$template->id}/image")->assertOk();
        $this->assertStringStartsWith('image/', $image->headers->get('Content-Type'));

        Sanctum::actingAs($this->makeUser(['penulis']));
        $this->get("/api/v1/admin/certificate-templates/{$template->id}/image")->assertForbidden();
    }
}
