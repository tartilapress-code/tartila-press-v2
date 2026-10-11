<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\IsbnApplication;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Package;
use App\Models\PersonalProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Riwayat status proses penerbitan: ISBN, HAKI, buku fisik. */
class PublicationProcessTest extends TestCase
{
    use RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roles = ['penulis']): User
    {
        $user = User::create(['name' => 'Penguji '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));
        PersonalProfile::create(['user_id' => $user->id, 'nik' => '2171000000000001', 'ktp_address' => 'Batam', 'phone' => '0812']);

        return $user;
    }

    /** Naskah selesai dari pesanan paket dengan fasilitas tertentu, sudah terbit sebagai buku. */
    private function completedManuscript(User $author, array $facilities): Manuscript
    {
        $package = Package::create(['name' => 'Paket Uji', 'price' => 1000000, 'discount' => 0, 'facilities' => $facilities, 'services' => ['Editing'], 'created_by' => $author->id]);
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1000000, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1000000]);
        OrderItem::create(['order_id' => $order->id, 'itemable_type' => Package::class, 'itemable_id' => $package->id, 'name' => $package->name, 'quantity' => 1, 'unit_price' => 1000000, 'subtotal' => 1000000]);

        $manuscript = Manuscript::create(['order_id' => $order->id, 'user_id' => $author->id, 'title' => 'Naskah Proses', 'authors' => [$author->name], 'status' => 'completed']);
        ManuscriptAuthor::create(['manuscript_id' => $manuscript->id, 'user_id' => $author->id, 'position' => 1, 'approved_at' => now()]);
        Book::create(['manuscript_id' => $manuscript->id, 'title' => 'Naskah Proses', 'price' => 100000, 'discount' => 0, 'is_active' => true, 'created_by' => $author->id]);

        return $manuscript;
    }

    private function signLetter(User $author, Manuscript $manuscript): int
    {
        Sanctum::actingAs($author);
        $id = $this->postJson('/api/v1/isbn-applications', ['manuscript_id' => $manuscript->id])->assertOk()->json('data.id');
        $this->postJson("/api/v1/isbn-applications/{$id}/sign", ['signature' => 'data:image/png;base64,'.self::PNG, 'mou_agreed' => true])->assertOk();

        return $id;
    }

    private function progress(User $user, Manuscript $manuscript): ?array
    {
        Sanctum::actingAs($user);

        return $this->getJson("/api/v1/manuscripts/{$manuscript->id}/publication-progress")->assertOk()->json('data');
    }

    private function step(array $progress, string $section, string $key): ?array
    {
        return collect(collect($progress['sections'])->firstWhere('key', $section)['steps'])->firstWhere('key', $key);
    }

    public function test_isbn_only_package_finishes_once_the_isbn_is_published(): void
    {
        $author = $this->makeUser();
        $admin = $this->makeUser(['admin']);
        $manuscript = $this->completedManuscript($author, ['ISBN', 'Cover']);

        // Belum ada surat: menunggu surat keaslian karya dari penulis.
        $progress = $this->progress($author, $manuscript);
        $this->assertSame('Menunggu Surat Keaslian Karya dari penulis', $this->step($progress, 'isbn', 'letter')['label']);
        $this->assertSame('current', $this->step($progress, 'isbn', 'letter')['state']);
        $this->assertFalse(collect($progress['sections'])->firstWhere('key', 'hki')['included']);
        $this->assertFalse(collect($progress['sections'])->firstWhere('key', 'physical')['included']);

        $id = $this->signLetter($author, $manuscript);
        $this->assertSame('current', $this->step($this->progress($author, $manuscript), 'isbn', 'isbn_submitted')['state']);

        // Admin: resi pengajuan ISBN -> penulis melihat resi + tautan pelacakan.
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'submit'])->assertStatus(422);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'submit', 'receipt' => 'RESI-001'])->assertOk();

        $submitted = $this->step($this->progress($author, $manuscript), 'isbn', 'isbn_submitted');
        $this->assertSame('done', $submitted['state']);
        $this->assertSame('RESI-001', $submitted['receipt']);
        $this->assertSame('https://isbn.perpusnas.go.id/landing_page/pelacakan', $submitted['tracking_url']);

        // Ditolak dengan catatan, lalu diajukan ulang.
        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'reject'])->assertStatus(422);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'reject', 'note' => 'Halaman judul belum lengkap.'])->assertOk();

        $rejected = $this->step($this->progress($author, $manuscript), 'isbn', 'isbn_rejected');
        $this->assertSame('rejected', $rejected['state']);
        $this->assertSame('Halaman judul belum lengkap.', $rejected['note']);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'submit', 'receipt' => 'RESI-002'])->assertOk();
        $this->assertNull($this->step($this->progress($author, $manuscript), 'isbn', 'isbn_rejected'));

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'publish', 'isbn' => 'abc'])->assertStatus(422);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'publish', 'isbn' => '978-623-00-1234-5'])->assertOk();

        $this->assertSame('978-623-00-1234-5', $manuscript->book()->first()->isbn);

        $progress = $this->progress($author, $manuscript);
        $this->assertTrue($progress['completed']);
        $this->assertSame('Proses selesai', $progress['current']);
        $this->assertSame(
            ['letter_signed', 'isbn_submitted', 'isbn_rejected', 'isbn_submitted', 'isbn_published'],
            array_column($progress['history'], 'stage')
        );
        $this->assertSame('Halaman judul belum lengkap.', $progress['history'][2]['note']);

        // Penulis dapat notifikasi di menu Naskah Saya.
        $this->assertDatabaseHas('user_notifications', ['user_id' => $author->id, 'subject_type' => 'manuscript', 'subject_id' => $manuscript->id, 'title' => 'Proses penerbitan: ISBN ditolak']);

        // Ringkasan di daftar Naskah Saya.
        $this->getJson('/api/v1/manuscripts/mine')->assertOk()->assertJsonPath('data.0.publication.completed', true);
    }

    public function test_hki_and_physical_book_must_finish_when_the_package_includes_them(): void
    {
        $author = $this->makeUser();
        $admin = $this->makeUser(['admin']);
        $manuscript = $this->completedManuscript($author, ['ISBN', 'HKI', 'buku eks']);
        $id = $this->signLetter($author, $manuscript);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'publish', 'isbn' => '9786230012345'])->assertOk();

        $progress = $this->progress($author, $manuscript);
        $this->assertTrue($progress['includes']['hki']);
        $this->assertTrue($progress['includes']['physical']);
        $this->assertFalse($progress['completed']);
        $this->assertSame('Pengajuan HAKI · Buku dicetak', $progress['current']);

        // HAKI dari halaman HKI admin.
        Sanctum::actingAs($admin);
        $this->putJson("/api/v1/admin/hki/order/{$manuscript->order_id}", ['status' => 'submitted', 'application_number' => 'EC001'])->assertOk();
        $this->putJson("/api/v1/admin/hki/order/{$manuscript->order_id}", ['status' => 'registered', 'registration_number' => 'REG-9'])->assertOk();

        // Buku fisik: dicetak, dikirim; penulis belum bisa konfirmasi sebelum dikirim.
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/physical", ['step' => 'printed'])->assertOk();

        Sanctum::actingAs($author);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/publication-progress/confirm-delivery")->assertStatus(422);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/physical", ['step' => 'shipped', 'note' => 'JNE 123'])->assertOk();

        $progress = $this->progress($author, $manuscript);
        $this->assertTrue($progress['can_confirm_delivery']);
        $this->assertFalse($progress['completed']);
        $this->assertSame('JNE 123', collect($progress['sections'])->firstWhere('key', 'physical')['note']);

        Sanctum::actingAs($author);
        $this->postJson("/api/v1/manuscripts/{$manuscript->id}/publication-progress/confirm-delivery")
            ->assertOk()->assertJsonPath('data.completed', true);

        $stages = array_column($this->progress($author, $manuscript)['history'], 'stage');
        foreach (['hki_submitted', 'hki_registered', 'printed', 'shipped', 'delivered'] as $stage) {
            $this->assertContains($stage, $stages);
        }
    }

    public function test_admin_can_override_whether_the_package_has_a_physical_book(): void
    {
        $author = $this->makeUser();
        $admin = $this->makeUser(['admin']);
        $manuscript = $this->completedManuscript($author, ['ISBN', 'buku eks']);
        $id = $this->signLetter($author, $manuscript);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'publish', 'isbn' => '9786230012345'])->assertOk();
        $this->assertFalse($this->getJson("/api/v1/admin/isbn-applications/{$id}/process")->json('data.completed'));

        $this->patchJson("/api/v1/admin/isbn-applications/{$id}/process/settings", ['includes_physical' => false])
            ->assertOk()->assertJsonPath('data.completed', true)->assertJsonPath('data.includes.physical_auto', true);

        // Kembali ikut paket.
        $this->patchJson("/api/v1/admin/isbn-applications/{$id}/process/settings", ['includes_physical' => null])
            ->assertOk()->assertJsonPath('data.completed', false);
    }

    public function test_access_rules(): void
    {
        $author = $this->makeUser();
        $manuscript = $this->completedManuscript($author, ['ISBN']);
        $id = $this->signLetter($author, $manuscript);

        // Bukan admin: tidak bisa mengubah proses.
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'submit', 'receipt' => 'X'])->assertForbidden();

        // Orang lain tidak bisa melihat riwayat naskah ini.
        Sanctum::actingAs($this->makeUser());
        $this->getJson("/api/v1/manuscripts/{$manuscript->id}/publication-progress")->assertForbidden();

        // Naskah belum selesai: belum ada proses penerbitan.
        $manuscript->update(['status' => 'in_editing']);
        $this->assertNull($this->progress($author, $manuscript));

        // Surat masih draft: admin belum bisa mengajukan ISBN.
        IsbnApplication::find($id)->forceFill(['status' => IsbnApplication::STATUS_DRAFT, 'signed_at' => null])->save();
        Sanctum::actingAs($this->makeUser(['admin']));
        $this->postJson("/api/v1/admin/isbn-applications/{$id}/process/isbn", ['action' => 'submit', 'receipt' => 'X'])->assertStatus(422);
    }
}
