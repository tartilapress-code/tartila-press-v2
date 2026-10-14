<?php

namespace Tests\Feature;

use App\Models\EditorProfile;
use App\Models\Manuscript;
use App\Models\ManuscriptTemplate;
use App\Models\Order;
use App\Models\Package;
use App\Models\Role;
use App\Models\User;
use App\Models\UserNotification;
use App\Notifications\NoticeMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    private function makeUser(array $roles, string $name = 'Penguji'): User
    {
        $user = User::create(['name' => $name.' '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->markEmailAsVerified();
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /** @return list<string> judul notifikasi user (terbaru dulu) */
    private function titles(User $user, ?string $category = null): array
    {
        return UserNotification::where('user_id', $user->id)
            ->when($category, fn ($query) => $query->where('category', $category))
            ->orderByDesc('id')->pluck('title')->all();
    }

    private function emailsTo(User $user): array
    {
        $titles = [];

        Notification::assertSentTo($user, NoticeMail::class, function (NoticeMail $mail) use (&$titles) {
            $titles[] = $mail->title;

            return true;
        });

        return $titles;
    }

    // ----------------------------------------------------------- Pesanan

    public function test_new_orders_notify_admins_and_email_the_office(): void
    {
        Notification::fake();
        config(['app.order_notification_email' => 'tartilapresofficial@gmail.com']);

        $admin = $this->makeUser(['admin'], 'Admin');
        $otherAdmin = $this->makeUser(['admin'], 'Admin Dua');
        $buyer = $this->makeUser(['user'], 'Pembeli');
        $package = Package::create(['name' => 'Paket Terbit Cepat', 'price' => 1500000, 'discount' => 0, 'created_by' => $admin->id]);

        Sanctum::actingAs($buyer);
        $order = Order::findOrFail($this->postJson('/api/v1/orders', ['type' => 'package', 'package_id' => $package->id])->assertCreated()->json('data.id'));

        foreach ([$admin, $otherAdmin] as $each) {
            $this->assertSame(["Pesanan baru {$order->order_number}"], $this->titles($each, 'admin_order'));
        }

        $this->assertSame([], $this->titles($buyer));

        Notification::assertSentOnDemand(NoticeMail::class, function (NoticeMail $mail, array $channels, AnonymousNotifiable $notifiable) use ($order, $buyer) {
            $body = implode("\n", $mail->lines);

            return $notifiable->routes['mail'] === 'tartilapresofficial@gmail.com'
                && $mail->title === "Pesanan baru {$order->order_number}"
                && str_contains($body, 'Paket Terbit Cepat')
                && str_contains($body, 'Rp 1.500.000')
                && str_contains($body, $buyer->email);
        });

        // Bukti transfer → admin; konfirmasi admin → pembeli (bukan admin pelaku).
        $this->post("/api/v1/orders/{$order->id}/payment-proof", ['file' => UploadedFile::fake()->createWithContent('bukti.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame("Bukti transfer diunggah · {$order->order_number}", $this->titles($admin, 'admin_order')[0]);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/orders/{$order->id}/verify-payment", ['decision' => 'approve'])->assertOk();
        $this->assertSame(["Pembayaran pesanan {$order->order_number} dikonfirmasi"], $this->titles($buyer, 'order'));
        $this->assertCount(2, $this->titles($admin));

        // Pesan admin → pembeli; balasan pembeli → admin.
        $this->postJson("/api/v1/orders/{$order->id}/messages", ['body' => 'Naskah ditunggu ya.'])->assertCreated();
        $this->assertSame("Pesan baru dari admin · {$order->order_number}", $this->titles($buyer)[0]);
        Sanctum::actingAs($buyer);
        $this->postJson("/api/v1/orders/{$order->id}/messages", ['body' => 'Siap, terima kasih.'])->assertCreated();
        $this->assertSame("Pesan baru dari pembeli · {$order->order_number}", $this->titles($otherAdmin)[0]);
    }

    public function test_an_order_still_succeeds_when_the_mail_server_is_down(): void
    {
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 9, 'mail.mailers.smtp.timeout' => 1]);
        Log::spy();

        $admin = $this->makeUser(['admin']);
        $package = Package::create(['name' => 'Paket', 'price' => 1000, 'discount' => 0, 'created_by' => $admin->id]);

        Sanctum::actingAs($this->makeUser(['user']));
        $this->postJson('/api/v1/orders', ['type' => 'package', 'package_id' => $package->id])->assertCreated();

        $this->assertCount(1, $this->titles($admin));
        Log::shouldHaveReceived('warning')->withArgs(fn ($message) => str_starts_with($message, 'Email notifikasi gagal dikirim'));
    }

    // ------------------------------------------------------------ Naskah

    public function test_manuscript_updates_reach_authors_and_editor_by_app_and_email(): void
    {
        Notification::fake();

        $admin = $this->makeUser(['admin'], 'Admin');
        $author = $this->makeUser(['penulis'], 'Penulis Utama');
        $coAuthor = $this->makeUser(['penulis'], 'Penulis Dua');
        $editor = $this->makeUser(['editor'], 'Editor');
        EditorProfile::create(['user_id' => $editor->id, 'fee' => 1, 'is_available' => true]);
        $order = Order::create(['order_number' => 'ORD-'.uniqid(), 'user_id' => $author->id, 'status' => 'confirmed', 'subtotal' => 1, 'discount_total' => 0, 'editor_fee' => 0, 'total' => 1]);
        $pdf = fn () => UploadedFile::fake()->create('naskah.pdf', 50, 'application/pdf');

        // Penulis mengirim naskah → admin (app) + penulis pendamping (app + email).
        Sanctum::actingAs($author);
        $id = $this->post('/api/v1/manuscripts', ['manuscript_template_id' => ManuscriptTemplate::default()?->id, 'order_id' => $order->id, 'title' => 'Sistem Tertanam', 'author_user_ids' => [$coAuthor->id], 'file' => $pdf()], ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');
        $manuscript = Manuscript::findOrFail($id);
        $review = fn (string $decision, ?string $note = null) => $this->postJson(
            "/api/v1/admin/manuscripts/{$id}/revisions/{$manuscript->fresh()->latestRevision()->id}/review",
            ['decision' => $decision, 'note' => $note]
        )->assertOk();

        $this->assertSame(['Naskah baru menunggu review'], $this->titles($admin, 'admin_manuscript'));
        $this->assertSame(['Naskah diterima'], $this->titles($coAuthor, 'manuscript'));
        $this->assertSame([], $this->titles($author));

        // Admin menolak → semua penulis + catatan.
        Sanctum::actingAs($admin);
        $review('reject', 'Lengkapi daftar pustaka.');
        $this->assertSame('Naskah perlu direvisi', $this->titles($author)[0]);
        $this->assertStringContainsString('Lengkapi daftar pustaka.', UserNotification::where('user_id', $author->id)->latest('id')->value('body'));

        // Revisi → disetujui → tugaskan editor.
        Sanctum::actingAs($author);
        $this->post("/api/v1/manuscripts/{$id}/revisions", ['file' => $pdf()], ['Accept' => 'application/json'])->assertCreated();
        Sanctum::actingAs($admin);
        $review('approve');
        $this->assertSame('Naskah disetujui admin', $this->titles($author)[0]);
        $this->postJson("/api/v1/admin/manuscripts/{$id}/assign-editor", ['editor_id' => $editor->id, 'fee' => 100000])->assertOk();
        $this->assertSame(['Naskah baru ditugaskan kepada Anda'], $this->titles($editor, 'assigned_manuscript'));
        $this->assertSame('Naskah sedang diedit', $this->titles($coAuthor)[0]);

        // Editor mengunggah → admin; admin setuju → penulis review akhir.
        Sanctum::actingAs($editor);
        $this->post("/api/v1/manuscripts/{$id}/revisions", ['file' => $pdf()], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame('Hasil editor menunggu review', $this->titles($admin, 'admin_manuscript')[0]);
        Sanctum::actingAs($admin);
        $review('approve');
        $this->assertSame('Hasil edit siap direview', $this->titles($author)[0]);
        $this->assertSame('Hasil edit disetujui admin', $this->titles($editor)[0]);

        // Penulis minta revisi lagi → editor; lalu selesai.
        Sanctum::actingAs($coAuthor);
        $this->postJson("/api/v1/manuscripts/{$id}/final-review", ['decision' => 'revise', 'note' => 'Perbaiki Bab 2.'])->assertOk();
        $this->assertSame('Penulis meminta revisi lagi', $this->titles($editor)[0]);
        $this->assertStringContainsString('Perbaiki Bab 2.', UserNotification::where('user_id', $editor->id)->latest('id')->value('body'));

        Sanctum::actingAs($editor);
        $this->post("/api/v1/manuscripts/{$id}/revisions", ['file' => $pdf()], ['Accept' => 'application/json'])->assertCreated();
        Sanctum::actingAs($admin);
        $review('approve');
        foreach ([$author, $coAuthor] as $who) {
            Sanctum::actingAs($who);
            $this->postJson("/api/v1/manuscripts/{$id}/final-review", ['decision' => 'approve'])->assertOk();
        }

        $this->assertSame('Naskah selesai', $this->titles($author, 'manuscript')[0]);
        $this->assertSame('MOU distribusi buku perlu ditandatangani', $this->titles($author, 'mou')[0]);
        $this->assertSame('Naskah selesai', $this->titles($editor)[0]);

        // Email: penulis & editor menerima email untuk setiap update naskah.
        $this->assertContains('Naskah perlu direvisi', $this->emailsTo($author));
        $this->assertContains('Naskah selesai', $this->emailsTo($author));
        $this->assertContains('Naskah baru ditugaskan kepada Anda', $this->emailsTo($editor));
        $this->assertContains('Penulis meminta revisi lagi', $this->emailsTo($editor));
        Notification::assertNotSentTo($admin, NoticeMail::class);

        // Tidak ada notifikasi ganda untuk peristiwa yang sama.
        $this->assertSame(1, UserNotification::where('user_id', $editor->id)->where('title', 'Naskah baru ditugaskan kepada Anda')->count());
    }

    // --------------------------------------------------------------- API

    public function test_summary_and_mark_read_only_touch_the_users_own_notifications(): void
    {
        $user = $this->makeUser(['penulis']);
        $other = $this->makeUser(['penulis']);
        $make = fn (User $who, string $category, ?int $subject = null) => UserNotification::create([
            'user_id' => $who->id, 'category' => $category, 'title' => 'Uji', 'link' => '/dashboard',
            'subject_type' => $subject ? 'manuscript' : null, 'subject_id' => $subject,
        ]);

        $make($user, 'manuscript', 12);
        $make($user, 'manuscript', 12);
        $make($user, 'manuscript', 15);
        $wallet = $make($user, 'wallet');
        $make($user, 'order');
        $foreign = $make($other, 'order');

        $this->getJson('/api/v1/notifications/summary')->assertUnauthorized();

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/notifications/summary')
            ->assertOk()
            ->assertJsonPath('data.unread_total', 5)
            ->assertJsonPath('data.by_category.manuscript', 3)
            ->assertJsonPath('data.subjects.manuscript', [12, 15]);

        $this->postJson('/api/v1/notifications/read', [])->assertStatus(422);
        $this->postJson('/api/v1/notifications/read', ['subject_type' => 'manuscript', 'subject_id' => 12])->assertJsonPath('data.updated', 2);
        $this->postJson('/api/v1/notifications/read', ['categories' => ['wallet']])->assertJsonPath('data.updated', 1);
        $this->postJson('/api/v1/notifications/read', ['ids' => [$foreign->id, $wallet->id]])->assertJsonPath('data.updated', 0);
        $this->assertNull($foreign->fresh()->read_at);

        $this->getJson('/api/v1/notifications/summary')->assertJsonPath('data.unread_total', 2);
        $this->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('meta.total', 5);

        $this->postJson('/api/v1/notifications/read', ['all' => true])->assertJsonPath('data.updated', 2);
        $this->getJson('/api/v1/notifications/summary')->assertJsonPath('data.unread_total', 0);
        $this->assertNull($foreign->fresh()->read_at);
    }

    public function test_user_text_cannot_inject_links_into_emails(): void
    {
        $this->assertSame('Klik \\[di sini\\]\\(https://penipu.example\\) \\#1', NoticeMail::plain("Klik [di sini](https://penipu.example)\n#1"));
    }
}
