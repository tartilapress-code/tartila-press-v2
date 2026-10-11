<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Event;
use App\Models\EventAttendance;
use App\Models\EventRegistration;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Services\CertificateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SampleImages;
use Tests\TestCase;

class MyCertificatesTest extends TestCase
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

    private function makeUser(array $roleNames = ['user'], ?string $name = null): User
    {
        $user = User::create([
            'name' => $name ?? 'Pengguna '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function makeTemplate(string $type = 'event', ?string $role = null, bool $active = true): CertificateTemplate
    {
        $path = 'certificate-templates/'.uniqid().'.png';
        Storage::disk('public')->put($path, SampleImages::png(420, 297));

        return CertificateTemplate::create([
            'type' => $type,
            'name' => "Templat {$type} {$role}",
            'role' => $role,
            'image_path' => $path,
            'image_width' => 420,
            'image_height' => 297,
            'is_active' => $active,
            'fields' => [[
                'id' => 'n',
                'text' => '{name}',
                'x' => 0.1, 'y' => 0.4, 'w' => 0.8, 'h' => 0.12,
                'font' => 'cinzel', 'bold' => true, 'size' => 30, 'color' => '#173f5f',
                'align' => 'center', 'valign' => 'middle', 'uppercase' => false, 'autoFit' => true,
            ]],
        ]);
    }

    private function attend(User $user, array $eventOverrides = []): Certificate
    {
        $event = Event::create(array_merge([
            'title' => 'Webinar Sertifikat',
            'starts_at' => now()->subDay(),
            'ends_at' => now()->subDay()->addHours(2),
            'created_by' => $this->makeUser(['admin'])->id,
            'attendance_enabled' => true,
            'attendance_opens_at' => now()->subDay(),
            'attendance_closes_at' => now()->subHours(20),
            'certificate_template_id' => $this->makeTemplate()->id,
        ], $eventOverrides));

        $registration = EventRegistration::create([
            'event_id' => $event->id,
            'user_id' => $user->id,
            'status' => 'confirmed',
        ]);

        $attendance = EventAttendance::create([
            'event_id' => $event->id,
            'event_registration_id' => $registration->id,
            'user_id' => $user->id,
            'answers' => ['institusi' => 'SMAN 1'],
            'submitted_at' => now()->subHours(22),
        ]);

        return app(CertificateService::class)->issueForAttendance($attendance->load('event'))
            ?? Certificate::make();
    }

    private function makeBook(array $attributes = [], ?User $author = null, ?User $editor = null): Book
    {
        $manuscript = null;

        if ($author) {
            $order = Order::create([
                'order_number' => 'ORD-'.uniqid(),
                'user_id' => $author->id,
                'status' => 'confirmed',
                'subtotal' => 500000,
                'discount_total' => 0,
                'editor_fee' => 0,
                'total' => 500000,
            ]);

            $manuscript = Manuscript::create([
                'order_id' => $order->id,
                'user_id' => $author->id,
                'title' => 'Naskah '.uniqid(),
                'authors' => [$author->name],
                'status' => 'completed',
                'editor_id' => $editor?->id,
            ]);

            ManuscriptAuthor::create([
                'manuscript_id' => $manuscript->id,
                'user_id' => $author->id,
                'position' => 1,
            ]);
        }

        return Book::create(array_merge([
            'manuscript_id' => $manuscript?->id,
            'title' => 'Menulis dengan Hati',
            'authors_text' => $author?->name ?? 'Penulis',
            'isbn' => '978-623-1234-56-7',
            'citation_publication_date' => '2026-03-15',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $author?->id ?? $this->makeUser(['admin'])->id,
        ], $attributes));
    }

    /*
    |--------------------------------------------------------------------------
    | Sertifikat event
    |--------------------------------------------------------------------------
    */

    public function test_certificates_require_login(): void
    {
        $this->getJson('/api/v1/certificates')->assertStatus(401);
        $this->getJson('/api/v1/certificates/1/download')->assertStatus(401);
    }

    public function test_attendee_lists_and_downloads_the_event_certificate_any_time(): void
    {
        $user = $this->makeUser(['user'], 'Siti Nurhaliza');
        $certificate = $this->attend($user);
        Sanctum::actingAs($user);

        $list = $this->getJson('/api/v1/certificates');

        $list->assertOk();
        $list->assertJsonCount(1, 'data');
        $list->assertJsonPath('data.0.id', $certificate->id);
        $list->assertJsonPath('data.0.category', 'event');
        $list->assertJsonPath('data.0.title', 'Webinar Sertifikat');
        $list->assertJsonPath('data.0.number', $certificate->number);
        $this->assertNotEmpty($list->json('data.0.subtitle'));

        // Event dan absensinya sudah lama lewat: tetap bisa diunduh.
        $download = $this->get("/api/v1/certificates/{$certificate->id}/download");

        $download->assertOk();
        $download->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $download->getContent());
        $this->assertStringContainsString('attachment', $download->headers->get('content-disposition'));
        $this->assertStringContainsString("{$certificate->number}.pdf", $download->headers->get('content-disposition'));

        $inline = $this->get("/api/v1/certificates/{$certificate->id}/download?inline=1");
        $this->assertStringContainsString('inline', $inline->headers->get('content-disposition'));
    }

    public function test_certificates_belong_to_their_owner_only(): void
    {
        $owner = $this->makeUser();
        $certificate = $this->attend($owner);

        Sanctum::actingAs($this->makeUser());
        $this->getJson('/api/v1/certificates')->assertJsonCount(0, 'data');
        $this->get("/api/v1/certificates/{$certificate->id}/download")->assertStatus(404);

        Sanctum::actingAs($this->makeUser(['admin']));
        $this->get("/api/v1/certificates/{$certificate->id}/download")->assertOk();
    }

    public function test_certificate_values_follow_the_event_and_the_attendance_answers(): void
    {
        $user = $this->makeUser(['user'], 'Siti Nurhaliza');
        $certificate = $this->attend($user, [
            'title' => 'Webinar Nasional',
            'starts_at' => '2026-08-12 02:00:00',
            'ends_at' => '2026-08-14 08:00:00',
        ]);

        $certificate->load('attendance.user', 'attendance.event.category');
        $values = app(CertificateService::class)->valuesFor($certificate);

        $this->assertSame('Siti Nurhaliza', $values['name']);
        $this->assertSame('Webinar Nasional', $values['event_title']);
        $this->assertSame('12–14 Agustus 2026', $values['event_date']);
        $this->assertSame('2026', $values['event_year']);
        $this->assertSame($certificate->number, $values['certificate_number']);
        $this->assertSame('SMAN 1', $values['answer_institusi']);
    }

    public function test_event_certificate_disappears_when_its_template_is_removed(): void
    {
        $user = $this->makeUser();
        $certificate = $this->attend($user);
        Sanctum::actingAs($user);

        $certificate->attendance->event->update(['certificate_template_id' => null]);

        $this->getJson('/api/v1/certificates')->assertJsonCount(0, 'data');
        $this->get("/api/v1/certificates/{$certificate->id}/download")->assertStatus(404);
    }

    /*
    |--------------------------------------------------------------------------
    | Sertifikat penulis / editor
    |--------------------------------------------------------------------------
    */

    public function test_author_and_editor_get_their_own_certificate_for_a_published_book(): void
    {
        $author = $this->makeUser(['penulis'], 'Budi Penulis');
        $editor = $this->makeUser(['editor'], 'Ani Editor');
        $book = $this->makeBook([], $author, $editor);
        $this->makeTemplate('publication');

        Sanctum::actingAs($author);
        $authorList = $this->getJson('/api/v1/certificates');
        $authorList->assertOk()->assertJsonCount(1, 'data');
        $authorList->assertJsonPath('data.0.category', 'author');
        $authorList->assertJsonPath('data.0.title', 'Menulis dengan Hati');
        $authorList->assertJsonPath('data.0.subtitle', 'ISBN 978-623-1234-56-7 · Terbit Maret 2026');
        $authorList->assertJsonPath('data.0.number', sprintf('TP-PUB-2026-%06d', Certificate::max('id')));

        Sanctum::actingAs($editor);
        $editorList = $this->getJson('/api/v1/certificates');
        $editorList->assertOk()->assertJsonCount(1, 'data');
        $editorList->assertJsonPath('data.0.category', 'editor');
        $editorList->assertJsonPath('data.0.number', sprintf('TP-PUB-2026-%06d', Certificate::max('id')));

        $this->assertSame(2, Certificate::where('book_id', $book->id)->count());

        $this->get('/api/v1/certificates/'.$editorList->json('data.0.id').'/download')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        // Milik penulis tidak bisa diunduh editor.
        $authorCertificate = Certificate::where('role', 'author')->firstOrFail();
        $this->get("/api/v1/certificates/{$authorCertificate->id}/download")->assertStatus(404);
    }

    public function test_publication_certificate_values_come_from_the_book(): void
    {
        $author = $this->makeUser(['penulis'], 'Budi Penulis');
        $this->makeBook(['title' => 'Judul Buku Uji', 'isbn' => '978-1', 'citation_publication_date' => '2026-01-31'], $author);
        $this->makeTemplate('publication');
        Sanctum::actingAs($author);

        $this->getJson('/api/v1/certificates')->assertOk();

        $certificate = Certificate::with('book', 'user')->firstOrFail();
        $values = app(CertificateService::class)->valuesFor($certificate);

        $this->assertSame('Budi Penulis', $values['name']);
        $this->assertSame('Penulis', $values['role']);
        $this->assertSame('Judul Buku Uji', $values['book_title']);
        $this->assertSame('978-1', $values['isbn']);
        // Tanggal terbit tidak boleh bergeser karena zona waktu.
        $this->assertSame('31 Januari 2026', $values['published_date']);
        $this->assertSame('Januari 2026', $values['published_month_year']);
        $this->assertSame('2026', $values['published_year']);
        $this->assertSame('2026-01-31', $certificate->issued_at->format('Y-m-d'));
    }

    public function test_books_without_isbn_or_publication_date_or_inactive_get_no_certificate(): void
    {
        $author = $this->makeUser(['penulis']);
        $this->makeTemplate('publication');
        $this->makeBook(['title' => 'Tanpa ISBN', 'isbn' => null], $author);
        $this->makeBook(['title' => 'ISBN Kosong', 'isbn' => ''], $author);
        $this->makeBook(['title' => 'Tanpa Tanggal', 'citation_publication_date' => null], $author);
        $this->makeBook(['title' => 'Belum Aktif', 'is_active' => false], $author);
        $this->makeBook(['title' => 'Lengkap'], $author);
        Sanctum::actingAs($author);

        $list = $this->getJson('/api/v1/certificates');

        $list->assertOk()->assertJsonCount(1, 'data');
        $list->assertJsonPath('data.0.title', 'Lengkap');
    }

    public function test_no_publication_certificates_until_an_active_template_exists(): void
    {
        $author = $this->makeUser(['penulis']);
        $this->makeBook([], $author);
        Sanctum::actingAs($author);

        $this->getJson('/api/v1/certificates')->assertJsonCount(0, 'data');
        $this->assertSame(0, Certificate::count());

        $inactive = $this->makeTemplate('publication', null, false);
        $this->getJson('/api/v1/certificates')->assertJsonCount(0, 'data');

        $inactive->update(['is_active' => true]);
        $this->getJson('/api/v1/certificates')->assertJsonCount(1, 'data');

        // Dinonaktifkan lagi: sertifikat yang sudah ada tidak bisa diunduh.
        $inactive->update(['is_active' => false]);
        $this->getJson('/api/v1/certificates')->assertJsonCount(0, 'data');
        $this->get('/api/v1/certificates/'.Certificate::firstOrFail()->id.'/download')->assertStatus(404);
    }

    public function test_role_specific_templates_win_over_the_all_roles_template(): void
    {
        $general = $this->makeTemplate('publication');
        $editorOnly = $this->makeTemplate('publication', 'editor');

        $this->assertSame($editorOnly->id, CertificateTemplate::resolveForPublication('editor')->id);
        $this->assertSame($general->id, CertificateTemplate::resolveForPublication('author')->id);

        $editorOnly->update(['is_active' => false]);
        $this->assertSame($general->id, CertificateTemplate::resolveForPublication('editor')->id);

        $general->update(['is_active' => false]);
        $this->assertNull(CertificateTemplate::resolveForPublication('editor'));
    }

    public function test_someone_who_is_both_author_and_editor_gets_two_certificates_for_the_book(): void
    {
        $both = $this->makeUser(['penulis', 'editor'], 'Penulis Merangkap');
        $this->makeBook([], $both, $both);
        $this->makeTemplate('publication');
        Sanctum::actingAs($both);

        $list = $this->getJson('/api/v1/certificates');

        $list->assertOk()->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing(['author', 'editor'], collect($list->json('data'))->pluck('category')->all());

        // Dibuka berulang kali tidak menggandakan sertifikat.
        $this->getJson('/api/v1/certificates')->assertJsonCount(2, 'data');
        $this->assertSame(2, Certificate::count());
    }

    public function test_project_owner_editor_gets_a_certificate_for_a_chapter_compilation_book(): void
    {
        $editor = $this->makeUser(['editor'], 'Editor Pemilik');
        $this->makeBook(['is_chapter_compilation' => true, 'owner_editor_id' => $editor->id]);
        $this->makeTemplate('publication');
        Sanctum::actingAs($editor);

        $list = $this->getJson('/api/v1/certificates');

        $list->assertOk()->assertJsonCount(1, 'data');
        $list->assertJsonPath('data.0.category', 'editor');
    }

    public function test_the_list_groups_all_categories_newest_first(): void
    {
        $user = $this->makeUser(['penulis', 'editor']);
        $this->makeTemplate('publication');
        $this->attend($user);
        $this->makeBook(['citation_publication_date' => '2025-01-10'], $user);
        Sanctum::actingAs($user);

        $categories = collect($this->getJson('/api/v1/certificates')->json('data'))->pluck('category')->all();

        // Event (kemarin) lebih baru dari buku yang terbit Januari 2025.
        $this->assertSame(['event', 'author'], $categories);
    }
}
