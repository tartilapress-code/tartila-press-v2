<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Event;
use App\Models\EventAttendance;
use App\Models\EventRegistration;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Support\SampleImages;
use Tests\TestCase;

class EventAttendanceTest extends TestCase
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
            'name' => $name ?? 'Peserta '.uniqid(),
            'email' => uniqid('user').'@example.com',
            'password' => 'Tartila@2026',
        ]);

        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        return $user;
    }

    private function makeTemplate(string $type = 'event'): CertificateTemplate
    {
        $path = 'certificate-templates/'.uniqid().'.png';
        Storage::disk('public')->put($path, SampleImages::png(420, 297));

        return CertificateTemplate::create([
            'type' => $type,
            'name' => 'Templat '.$type,
            'image_path' => $path,
            'image_width' => 420,
            'image_height' => 297,
            'fields' => [[
                'id' => 'n',
                'text' => '{name} - {answer_institusi}',
                'x' => 0.1, 'y' => 0.4, 'w' => 0.8, 'h' => 0.12,
                'font' => 'cinzel', 'bold' => true, 'size' => 30, 'color' => '#173f5f',
                'align' => 'center', 'valign' => 'middle', 'uppercase' => false, 'autoFit' => true,
            ]],
        ]);
    }

    /**
     * Event dengan absensi yang sedang dibuka (kecuali ditimpa $overrides).
     */
    private function makeEvent(array $overrides = []): Event
    {
        return Event::create(array_merge([
            'title' => 'Webinar Absensi '.uniqid(),
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHours(2),
            'created_by' => $this->makeUser(['admin'])->id,
            'attendance_enabled' => true,
            'attendance_opens_at' => now()->subMinutes(30),
            'attendance_closes_at' => now()->addHours(2),
            'certificate_template_id' => $this->makeTemplate()->id,
        ], $overrides));
    }

    private function addFields(Event $event): void
    {
        $event->attendanceFields()->createMany([
            ['key' => 'institusi', 'label' => 'Institusi', 'type' => 'text', 'required' => true, 'sort_order' => 0],
            ['key' => 'peran', 'label' => 'Peran', 'type' => 'select', 'options' => ['Guru', 'Dosen', 'Mahasiswa'], 'required' => true, 'sort_order' => 1],
            ['key' => 'catatan', 'label' => 'Catatan', 'type' => 'textarea', 'required' => false, 'sort_order' => 2],
        ]);
    }

    private function register(User $user, Event $event, string $status = 'confirmed'): EventRegistration
    {
        return EventRegistration::create([
            'event_id' => $event->id,
            'user_id' => $user->id,
            'status' => $status,
        ]);
    }

    private function answers(array $overrides = []): array
    {
        return ['answers' => array_merge(['institusi' => 'SMAN 1 Contoh', 'peran' => 'Guru', 'catatan' => ''], $overrides)];
    }

    /*
    |--------------------------------------------------------------------------
    | Pengaturan oleh admin
    |--------------------------------------------------------------------------
    */

    public function test_admin_configures_attendance_with_fields_and_a_certificate_template(): void
    {
        $admin = $this->makeUser(['admin']);
        $template = $this->makeTemplate();
        $event = Event::create(['title' => 'Seminar', 'starts_at' => now()->addWeek(), 'created_by' => $admin->id]);
        Sanctum::actingAs($admin);

        $response = $this->putJson("/api/v1/admin/events/{$event->id}/attendance", [
            'attendance_enabled' => true,
            'attendance_opens_at' => now()->addWeek()->toISOString(),
            'attendance_closes_at' => now()->addWeek()->addHours(3)->toISOString(),
            'certificate_template_id' => $template->id,
            'fields' => [
                ['label' => 'Nama Institusi', 'type' => 'text', 'required' => true],
                ['label' => 'Peran', 'type' => 'select', 'options' => ['Guru', ' Dosen ', 'Guru', ''], 'required' => false, 'help_text' => 'Pilih satu'],
                ['label' => 'Saya hadir penuh', 'type' => 'checkbox'],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.attendance_enabled', true);
        $response->assertJsonPath('data.certificate_template_id', $template->id);
        $response->assertJsonPath('data.state', 'upcoming');
        $response->assertJsonCount(3, 'data.fields');
        $response->assertJsonPath('data.fields.0.key', 'nama_institusi');
        $response->assertJsonPath('data.fields.1.options', ['Guru', 'Dosen']);
        $response->assertJsonPath('data.fields.1.required', false);
        $response->assertJsonPath('data.fields.2.key', 'saya_hadir_penuh');
        $response->assertJsonPath('data.fields.2.required', true);

        $this->assertTrue($event->fresh()->attendance_enabled);
        $this->getJson("/api/v1/admin/events/{$event->id}/attendance")->assertOk()->assertJsonCount(3, 'data.fields');
    }

    public function test_admin_attendance_settings_are_validated(): void
    {
        $admin = $this->makeUser(['admin']);
        $event = Event::create(['title' => 'Seminar', 'starts_at' => now()->addWeek(), 'created_by' => $admin->id]);
        $publicationTemplate = $this->makeTemplate('publication');
        Sanctum::actingAs($admin);
        $url = "/api/v1/admin/events/{$event->id}/attendance";

        $this->putJson($url, ['attendance_enabled' => true, 'fields' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['attendance_opens_at', 'attendance_closes_at']);

        $this->putJson($url, [
            'attendance_enabled' => true,
            'attendance_opens_at' => now()->addDay()->toISOString(),
            'attendance_closes_at' => now()->toISOString(),
            'fields' => [],
        ])->assertStatus(422)->assertJsonValidationErrors('attendance_closes_at');

        $this->putJson($url, [
            'attendance_enabled' => false,
            'certificate_template_id' => $publicationTemplate->id,
            'fields' => [],
        ])->assertStatus(422)->assertJsonValidationErrors('certificate_template_id');

        $this->putJson($url, [
            'attendance_enabled' => false,
            'fields' => [['label' => 'Peran', 'type' => 'select', 'options' => ['Satu saja']]],
        ])->assertStatus(422)->assertJsonPath('message', 'Kolom "Peran" butuh minimal 2 pilihan.');

        $this->putJson($url, [
            'attendance_enabled' => false,
            'fields' => [['label' => 'Aneh', 'type' => 'hologram']],
        ])->assertStatus(422)->assertJsonValidationErrors('fields.0.type');

        $this->putJson($url, ['attendance_enabled' => false])
            ->assertStatus(422)->assertJsonValidationErrors('fields');

        $this->assertFalse($event->fresh()->attendance_enabled);
    }

    public function test_field_keys_are_unique_and_stay_stable_when_the_form_is_edited(): void
    {
        $admin = $this->makeUser(['admin']);
        $event = Event::create(['title' => 'Seminar', 'starts_at' => now()->addWeek(), 'created_by' => $admin->id]);
        Sanctum::actingAs($admin);
        $url = "/api/v1/admin/events/{$event->id}/attendance";

        $first = $this->putJson($url, [
            'attendance_enabled' => false,
            'fields' => [
                ['label' => 'Asal Instansi', 'type' => 'text'],
                ['label' => 'Asal Instansi', 'type' => 'text'],
                ['label' => '???', 'type' => 'text'],
            ],
        ])->assertOk();

        $this->assertSame(['asal_instansi', 'asal_instansi_2', 'kolom'], collect($first->json('data.fields'))->pluck('key')->all());

        $ids = collect($first->json('data.fields'))->pluck('id');

        // Ubah label kolom pertama, buang kolom kedua, tambah kolom baru.
        $second = $this->putJson($url, [
            'attendance_enabled' => false,
            'fields' => [
                ['id' => $ids[2], 'label' => 'Kolom ketiga dipindah ke atas', 'type' => 'textarea'],
                ['id' => $ids[0], 'label' => 'Instansi (diubah)', 'type' => 'text'],
                ['label' => 'Asal Instansi', 'type' => 'text'],
            ],
        ])->assertOk();

        $fields = collect($second->json('data.fields'));
        // Kunci kolom yang baru dihapus (asal_instansi_2) tidak langsung dipakai
        // ulang oleh kolom baru, supaya jawaban lamanya tidak tertukar.
        $this->assertSame(['kolom', 'asal_instansi', 'asal_instansi_3'], $fields->pluck('key')->all());
        $this->assertSame('Instansi (diubah)', $fields[1]['label']);
        $this->assertSame($ids[0], $fields[1]['id'], 'kolom lama dipertahankan, bukan dibuat ulang');
        $this->assertNotContains($ids[1], $fields->pluck('id')->all());
        $this->assertSame(3, $event->attendanceFields()->count());
    }

    /*
    |--------------------------------------------------------------------------
    | Peserta mengisi absensi
    |--------------------------------------------------------------------------
    */

    public function test_confirmed_participant_sees_the_form_and_its_state(): void
    {
        $event = $this->makeEvent();
        $this->addFields($event);
        $user = $this->makeUser();
        $this->register($user, $event);
        Sanctum::actingAs($user);

        $response = $this->getJson("/api/v1/events/{$event->slug}/attendance");

        $response->assertOk();
        $response->assertJsonPath('data.state', 'open');
        $response->assertJsonPath('data.submitted', false);
        $response->assertJsonPath('data.has_certificate_template', true);
        $response->assertJsonPath('data.certificate', null);
        $response->assertJsonCount(3, 'data.fields');
        $response->assertJsonPath('data.fields.1.options', ['Guru', 'Dosen', 'Mahasiswa']);
    }

    public function test_only_confirmed_participants_can_open_or_submit_attendance(): void
    {
        $event = $this->makeEvent();
        $this->addFields($event);
        $outsider = $this->makeUser();
        $pending = $this->makeUser();
        $this->register($pending, $event, 'pending');

        $this->getJson("/api/v1/events/{$event->slug}/attendance")->assertStatus(401);

        foreach ([$outsider, $pending] as $user) {
            Sanctum::actingAs($user);

            $this->getJson("/api/v1/events/{$event->slug}/attendance")->assertStatus(403);
            $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers())->assertStatus(403);
        }

        $this->assertSame(0, EventAttendance::count());
    }

    public function test_event_without_attendance_has_no_attendance_page(): void
    {
        $event = $this->makeEvent(['attendance_enabled' => false]);
        $user = $this->makeUser();
        $this->register($user, $event);
        Sanctum::actingAs($user);

        $this->getJson("/api/v1/events/{$event->slug}/attendance")->assertStatus(404);
        $this->postJson("/api/v1/events/{$event->slug}/attendance", [])->assertStatus(404);
    }

    public function test_attendance_can_only_be_submitted_inside_the_admin_window(): void
    {
        $upcoming = $this->makeEvent([
            'attendance_opens_at' => now()->addHour(),
            'attendance_closes_at' => now()->addHours(3),
        ]);
        $closed = $this->makeEvent([
            'attendance_opens_at' => now()->subHours(3),
            'attendance_closes_at' => now()->subHour(),
        ]);
        $user = $this->makeUser();
        $this->register($user, $upcoming);
        $this->register($user, $closed);
        Sanctum::actingAs($user);

        $this->getJson("/api/v1/events/{$upcoming->slug}/attendance")->assertJsonPath('data.state', 'upcoming');
        $this->getJson("/api/v1/events/{$closed->slug}/attendance")->assertJsonPath('data.state', 'closed');

        $this->postJson("/api/v1/events/{$upcoming->slug}/attendance", [])
            ->assertStatus(422)->assertJsonPath('message', 'Absensi belum dibuka.');
        $this->postJson("/api/v1/events/{$closed->slug}/attendance", [])
            ->assertStatus(422)->assertJsonPath('message', 'Absensi sudah ditutup.');

        $this->assertSame(0, EventAttendance::count());
    }

    public function test_submitting_attendance_stores_the_answers_and_issues_a_certificate(): void
    {
        $event = $this->makeEvent();
        $this->addFields($event);
        $user = $this->makeUser(['user'], 'Siti Nurhaliza');
        $this->register($user, $event);
        Sanctum::actingAs($user);

        $response = $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers([
            'institusi' => '  SMAN 1 Contoh  ',
            'catatan' => '',
            'bukan_kolom' => 'diabaikan',
        ]));

        $response->assertStatus(201);
        $response->assertJsonPath('data.submitted', true);
        $response->assertJsonPath('data.answers.institusi', 'SMAN 1 Contoh');
        $response->assertJsonPath('data.answers.peran', 'Guru');
        $response->assertJsonMissingPath('data.answers.bukan_kolom');
        $response->assertJsonPath('data.certificate.number', sprintf('TP-EVT-%s-%06d', now()->format('Y'), Certificate::max('id')));

        $attendance = EventAttendance::firstOrFail();
        $this->assertSame($user->id, $attendance->user_id);
        $this->assertSame($event->id, $attendance->event_id);

        $certificate = Certificate::firstOrFail();
        $this->assertSame('event', $certificate->type);
        $this->assertSame($attendance->id, $certificate->event_attendance_id);
        $this->assertSame($user->id, $certificate->user_id);

        // Halaman absensi sekarang menampilkan jawaban dan sertifikatnya.
        $this->getJson("/api/v1/events/{$event->slug}/attendance")
            ->assertJsonPath('data.submitted', true)
            ->assertJsonPath('data.certificate.id', $certificate->id);
    }

    public function test_attendance_cannot_be_submitted_twice(): void
    {
        $event = $this->makeEvent();
        $this->addFields($event);
        $user = $this->makeUser();
        $this->register($user, $event);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers())->assertStatus(201);

        $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers())
            ->assertStatus(422)
            ->assertJsonPath('message', 'Anda sudah mengisi absensi untuk event ini.');

        $this->assertSame(1, EventAttendance::count());
        $this->assertSame(1, Certificate::count());
    }

    public function test_answers_are_validated_against_the_form_the_admin_built(): void
    {
        $event = $this->makeEvent();
        $event->attendanceFields()->createMany([
            ['key' => 'institusi', 'label' => 'Institusi', 'type' => 'text', 'required' => true, 'sort_order' => 0],
            ['key' => 'peran', 'label' => 'Peran', 'type' => 'select', 'options' => ['Guru', 'Dosen'], 'required' => true, 'sort_order' => 1],
            ['key' => 'surel', 'label' => 'Email kantor', 'type' => 'email', 'required' => false, 'sort_order' => 2],
            ['key' => 'umur', 'label' => 'Umur', 'type' => 'number', 'required' => false, 'sort_order' => 3],
            ['key' => 'telepon', 'label' => 'Telepon', 'type' => 'phone', 'required' => false, 'sort_order' => 4],
            ['key' => 'lahir', 'label' => 'Tanggal lahir', 'type' => 'date', 'required' => false, 'sort_order' => 5],
            ['key' => 'setuju', 'label' => 'Setuju', 'type' => 'checkbox', 'required' => true, 'sort_order' => 6],
        ]);
        $user = $this->makeUser();
        $this->register($user, $event);
        Sanctum::actingAs($user);
        $url = "/api/v1/events/{$event->slug}/attendance";

        $response = $this->postJson($url, ['answers' => [
            'institusi' => '',
            'peran' => 'Presiden',
            'surel' => 'bukan-email',
            'umur' => 'banyak',
            'telepon' => 'abc',
            'lahir' => '12/08/1990',
            'setuju' => false,
        ]]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors([
            'answers.institusi',
            'answers.peran',
            'answers.surel',
            'answers.umur',
            'answers.telepon',
            'answers.lahir',
            'answers.setuju',
        ]);
        $this->assertSame('Institusi wajib diisi.', $response->json('errors')['answers.institusi'][0]);
        $this->assertSame('Pilihan pada Peran tidak valid.', $response->json('errors')['answers.peran'][0]);
        $this->assertSame(0, EventAttendance::count());

        $this->postJson($url, ['answers' => [
            'institusi' => 'SMAN 1',
            'peran' => 'Dosen',
            'surel' => 'guru@sekolah.sch.id',
            'umur' => '34.5',
            'telepon' => '+62 812-3456-7890',
            'lahir' => '1990-08-12',
            'setuju' => true,
        ]])->assertStatus(201)
            ->assertJsonPath('data.answers.setuju', true)
            ->assertJsonPath('data.answers.umur', '34.5');
    }

    public function test_event_without_a_certificate_template_issues_no_certificate(): void
    {
        $event = $this->makeEvent(['certificate_template_id' => null]);
        $this->addFields($event);
        $user = $this->makeUser();
        $this->register($user, $event);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers())
            ->assertStatus(201)
            ->assertJsonPath('data.has_certificate_template', false)
            ->assertJsonPath('data.certificate', null);

        $this->assertSame(0, Certificate::count());
    }

    public function test_a_template_added_later_gives_earlier_attendees_their_certificate(): void
    {
        $event = $this->makeEvent(['certificate_template_id' => null]);
        $this->addFields($event);
        $user = $this->makeUser();
        $this->register($user, $event);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers())->assertStatus(201);
        $this->assertSame(0, Certificate::count());

        $event->update(['certificate_template_id' => $this->makeTemplate()->id]);

        $mine = $this->getJson('/api/v1/events/mine');
        $mine->assertOk();
        $this->assertNotNull($mine->json('data.0.attendance_info.certificate_id'));
        $this->assertSame(1, Certificate::count());
    }

    /*
    |--------------------------------------------------------------------------
    | Event Saya + respons publik
    |--------------------------------------------------------------------------
    */

    public function test_my_events_reports_the_attendance_state_without_the_internal_template_id(): void
    {
        $open = $this->makeEvent(['title' => 'Event Buka']);
        $this->addFields($open);
        $off = $this->makeEvent(['title' => 'Event Tanpa Absen', 'attendance_enabled' => false, 'certificate_template_id' => null]);
        $user = $this->makeUser();
        $this->register($user, $open);
        $this->register($user, $off);
        Sanctum::actingAs($user);

        $before = collect($this->getJson('/api/v1/events/mine')->json('data'))->keyBy('event.title');

        $this->assertSame('open', $before['Event Buka']['attendance_info']['state']);
        $this->assertTrue($before['Event Buka']['attendance_info']['has_certificate_template']);
        $this->assertFalse($before['Event Buka']['attendance_info']['submitted']);
        $this->assertSame('disabled', $before['Event Tanpa Absen']['attendance_info']['state']);
        $this->assertArrayNotHasKey('certificate_template_id', $before['Event Buka']['event']);

        $this->postJson("/api/v1/events/{$open->slug}/attendance", $this->answers())->assertStatus(201);

        $after = collect($this->getJson('/api/v1/events/mine')->json('data'))->keyBy('event.title');

        $this->assertTrue($after['Event Buka']['attendance_info']['submitted']);
        $this->assertNotNull($after['Event Buka']['attendance_info']['certificate_id']);
    }

    public function test_public_event_endpoints_do_not_expose_attendance_or_certificate_settings(): void
    {
        $event = $this->makeEvent();

        $private = ['attendance_enabled', 'attendance_opens_at', 'attendance_closes_at', 'certificate_template_id'];

        $show = $this->getJson("/api/v1/events/{$event->slug}")->assertOk();
        $index = $this->getJson('/api/v1/events')->assertOk();

        foreach ($private as $column) {
            $this->assertArrayNotHasKey($column, $show->json('data'), $column);
            $this->assertArrayNotHasKey($column, $index->json('data.0'), $column);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Admin melihat, mengekspor, dan menghapus absensi
    |--------------------------------------------------------------------------
    */

    public function test_admin_lists_exports_and_deletes_attendances(): void
    {
        $event = $this->makeEvent();
        $this->addFields($event);
        $user = $this->makeUser(['user'], 'Budi Santoso');
        $this->register($user, $event);

        Sanctum::actingAs($user);
        $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers([
            'institusi' => '=HYPERLINK("http://jahat.example")',
            'catatan' => "baris satu\nbaris dua",
        ]))->assertStatus(201);

        $admin = $this->makeUser(['admin']);
        Sanctum::actingAs($admin);

        $list = $this->getJson("/api/v1/admin/events/{$event->id}/attendances");
        $list->assertOk();
        $list->assertJsonCount(1, 'data');
        $list->assertJsonPath('data.0.user.name', 'Budi Santoso');
        $list->assertJsonPath('data.0.user.email', $user->email);
        $list->assertJsonPath('data.0.certificate.number', sprintf('TP-EVT-%s-%06d', now()->format('Y'), Certificate::max('id')));

        $this->getJson("/api/v1/admin/events/{$event->id}/attendance")
            ->assertJsonPath('data.attendance_count', 1)
            ->assertJsonPath('data.confirmed_registrations_count', 1);

        $csv = $this->get("/api/v1/admin/events/{$event->id}/attendances/export");
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
        $body = $csv->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $body);
        $this->assertStringContainsString('Nama,Email,"Waktu absen","Nomor sertifikat",Institusi,Peran,Catatan', $body);
        $this->assertStringContainsString('"Budi Santoso"', $body);
        $this->assertStringContainsString("\"'=HYPERLINK(", $body, 'rumus di CSV dinetralkan');
        $this->assertStringNotContainsString(',"=HYPERLINK', $body);

        $attendance = EventAttendance::firstOrFail();
        $this->deleteJson("/api/v1/admin/events/{$event->id}/attendances/{$attendance->id}")->assertOk();

        $this->assertSame(0, EventAttendance::count());
        $this->assertSame(0, Certificate::count(), 'sertifikat ikut terhapus');

        // Peserta bisa mengisi ulang.
        Sanctum::actingAs($user);
        $this->postJson("/api/v1/events/{$event->slug}/attendance", $this->answers())->assertStatus(201);
    }

    public function test_attendance_of_another_event_cannot_be_deleted_through_this_event(): void
    {
        $eventA = $this->makeEvent();
        $eventB = $this->makeEvent();
        $user = $this->makeUser();
        $registration = $this->register($user, $eventB);
        $attendance = EventAttendance::create([
            'event_id' => $eventB->id,
            'event_registration_id' => $registration->id,
            'user_id' => $user->id,
            'answers' => [],
            'submitted_at' => now(),
        ]);

        Sanctum::actingAs($this->makeUser(['admin']));

        $this->deleteJson("/api/v1/admin/events/{$eventA->id}/attendances/{$attendance->id}")->assertStatus(404);
        $this->assertSame(1, EventAttendance::count());
    }

    public function test_attendance_admin_endpoints_are_admin_only(): void
    {
        $event = $this->makeEvent();
        Sanctum::actingAs($this->makeUser());

        $this->getJson("/api/v1/admin/events/{$event->id}/attendance")->assertStatus(403);
        $this->putJson("/api/v1/admin/events/{$event->id}/attendance", [])->assertStatus(403);
        $this->getJson("/api/v1/admin/events/{$event->id}/attendances")->assertStatus(403);
        $this->get("/api/v1/admin/events/{$event->id}/attendances/export")->assertStatus(403);
    }
}
