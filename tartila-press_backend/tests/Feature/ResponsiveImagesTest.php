<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Support\ResponsiveImages;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SampleImages;
use Tests\TestCase;

/** Versi kecil (WebP) gambar unggahan untuk kartu & daftar. */
class ResponsiveImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Role::create(['name' => 'user', 'display_name' => 'User']);
    }

    private function requireGd(): void
    {
        if (! ResponsiveImages::supported()) {
            $this->markTestSkipped('GD (WebP) tidak terpasang di mesin ini; jalankan dengan php -d extension=gd.');
        }
    }

    private function width(string $path): int
    {
        return getimagesize(Storage::disk('public')->path($path))[0];
    }

    public function test_variant_names_follow_the_shared_rule(): void
    {
        $this->assertSame('uploads/covers/1/abc.w400.webp', ResponsiveImages::variantPath('uploads/covers/1/abc.png', 400));
        $this->assertSame('uploads/a.b/x.w900.webp', ResponsiveImages::variantPath('uploads/a.b/x.JPG', 900));
        $this->assertTrue(ResponsiveImages::isSource('uploads/covers/1/abc.jpeg'));
        $this->assertFalse(ResponsiveImages::isSource('uploads/covers/1/abc.w400.webp'));
        $this->assertFalse(ResponsiveImages::isSource('uploads/event-documents/1/ktp.pdf'));
    }

    public function test_uploading_an_image_creates_smaller_webp_versions_and_keeps_the_original(): void
    {
        $this->requireGd();

        $user = User::create(['name' => 'Penguji', 'email' => 'img@example.com', 'password' => 'Tartila@2026']);
        Sanctum::actingAs($user);

        $url = $this->post('/api/v1/auth/uploads/images', [
            'file' => SampleImages::pngUpload('sampul.png', 1200, 1700, alpha: true),
            'folder' => 'covers',
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.url');

        $path = 'uploads/'.explode('/storage/uploads/', $url)[1];

        Storage::disk('public')->assertExists($path);
        $this->assertSame(1200, $this->width($path));
        $this->assertSame(400, $this->width(ResponsiveImages::variantPath($path, 400)));
        $this->assertSame(900, $this->width(ResponsiveImages::variantPath($path, 900)));
        $this->assertSame('image/webp', getimagesize(Storage::disk('public')->path(ResponsiveImages::variantPath($path, 400)))['mime']);
    }

    public function test_small_images_are_never_enlarged(): void
    {
        $this->requireGd();

        Storage::disk('public')->put('uploads/profiles/1/kecil.png', SampleImages::pngUpload('kecil.png', 300, 300)->getContent());

        $this->assertSame(2, app(ResponsiveImages::class)->generate('uploads/profiles/1/kecil.png'));
        $this->assertSame(300, $this->width('uploads/profiles/1/kecil.w400.webp'));
        $this->assertSame(300, $this->width('uploads/profiles/1/kecil.w900.webp'));
    }

    public function test_command_backfills_missing_variants_once(): void
    {
        $this->requireGd();

        $disk = Storage::disk('public');
        $disk->put('uploads/covers/1/lama.png', SampleImages::pngUpload('lama.png', 1000, 1400)->getContent());
        $disk->put('uploads/articles/2/foto.jpg', SampleImages::jpegUpload('foto.jpg')->getContent());
        $disk->put('uploads/event-documents/3/ktp.pdf', '%PDF-1.4');

        $this->artisan('images:responsive')->expectsOutputToContain('2 gambar diperiksa, 4 varian dibuat.')->assertSuccessful();
        $this->artisan('images:responsive')->expectsOutputToContain('2 gambar diperiksa, 0 varian dibuat.')->assertSuccessful();

        $disk->assertExists('uploads/covers/1/lama.w400.webp');
        $disk->assertExists('uploads/articles/2/foto.w900.webp');
        $disk->assertExists('uploads/covers/1/lama.png');
    }
}
