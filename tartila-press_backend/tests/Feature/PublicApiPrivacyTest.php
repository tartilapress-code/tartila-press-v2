<?php

namespace Tests\Feature;

use App\Http\Middleware\SanitizePublicResponse;
use App\Models\Article;
use App\Models\ArticleComment;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookReview;
use App\Models\Event;
use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Models\ManuscriptAuthor;
use App\Models\Order;
use App\Models\Package;
use App\Models\PublicProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicApiPrivacyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Kunci yang tidak boleh ada di respons endpoint publik.
     */
    private const HIDDEN_KEYS = [
        'email',
        'email_verified_at',
        'editor_fee',
        'editor_admin_fee',
        'editor_requested_fee',
        'editor_assignment_note',
        'editor_deadline',
        'user_id',
        'editor_id',
        'owner_editor_id',
        'order_id',
        'created_by',
    ];

    /**
     * Rute GET tanpa login yang bukan endpoint data (tautan verifikasi
     * bertanda tangan yang berujung pada pengalihan), sehingga tidak perlu
     * disaring.
     */
    private const UNFILTERED_PUBLIC_ROUTES = [
        'api/v1/auth/change-email/verify/{id}',
        'api/v1/auth/email/verify/{id}/{hash}',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create([
                'name' => $name,
                'display_name' => ucfirst($name),
            ]);
        }
    }

    private function makeUser(array $roleNames, string $label, ?string $penName = null): User
    {
        $user = User::create([
            'name' => 'Pengguna '.$label,
            'email' => "rahasia-{$label}@privat.test",
            'password' => 'Tartila@2026',
        ]);

        $user->roles()->attach(Role::whereIn('name', $roleNames)->pluck('id'));

        if ($penName) {
            PublicProfile::create([
                'user_id' => $user->id,
                'slug' => $label,
                'pen_name' => $penName,
                'bio' => 'Bio '.$penName,
                'is_published' => true,
            ]);
        }

        return $user;
    }

    /**
     * Data publik yang melibatkan semua jenis relasi User: penulis,
     * co-author, editor naskah, editor pemilik proyek bab, pengulas buku,
     * dan pengomentar artikel.
     *
     * @return array{emails: list<string>, urls: array<string, string>}
     */
    private function seedPublicContent(): array
    {
        $author = $this->makeUser(['penulis'], 'penulis', 'Penulis Uji');
        $coAuthor = $this->makeUser(['penulis'], 'penulis-dua', 'Penulis Dua');
        $editor = $this->makeUser(['editor'], 'editor', 'Editor Uji');
        $reviewer = $this->makeUser(['user'], 'pengulas');
        $commenter = $this->makeUser(['user'], 'pengomentar');
        $admin = $this->makeUser(['admin'], 'admin');

        // Buku terbit dari naskah selesai: ada editor, fee editor, catatan
        // penugasan admin, dan dua penulis.
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
            'title' => 'Naskah Uji Privasi',
            'authors' => [$author->name, $coAuthor->name],
            'status' => 'completed',
            'editor_id' => $editor->id,
            'editor_source' => 'author',
            'editor_fee' => 600000,
            'editor_requested_fee' => 500000,
            'editor_assignment_note' => 'Catatan internal admin untuk editor',
        ]);

        foreach ([$author, $coAuthor] as $position => $writer) {
            ManuscriptAuthor::create([
                'manuscript_id' => $manuscript->id,
                'user_id' => $writer->id,
                'position' => $position + 1,
            ]);
        }

        $book = Book::create([
            'manuscript_id' => $manuscript->id,
            'title' => 'Buku Uji Privasi',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        BookReview::create([
            'book_id' => $book->id,
            'user_id' => $reviewer->id,
            'rating' => 5,
            'comment' => 'Bagus sekali.',
        ]);

        // Proyek Book Chapter milik editor, dengan satu slot terbuka dan
        // satu slot yang sudah terisi.
        $project = Book::create([
            'title' => 'Antologi Uji Privasi',
            'price' => 100000,
            'discount' => 0,
            'is_active' => true,
            'is_chapter_offering' => true,
            'created_by' => $editor->id,
            'owner_editor_id' => $editor->id,
            'submission_deadline' => now()->addMonth(),
        ]);

        BookChapter::create([
            'book_id' => $project->id,
            'chapter_number' => 1,
            'title' => 'Bab Satu',
            'price' => 50000,
        ]);

        BookChapter::create([
            'book_id' => $project->id,
            'manuscript_id' => $manuscript->id,
            'order_id' => $order->id,
            'chapter_number' => 2,
            'title' => 'Bab Dua',
            'price' => 50000,
        ]);

        // Artikel dengan komentar dari user lain.
        $article = Article::create([
            'user_id' => $author->id,
            'title' => 'Artikel Uji Privasi',
            'field_category_id' => FieldCategory::create(['name' => 'Bidang Uji'])->id,
            'body' => 'Isi essay uji coba yang cukup panjang untuk dites.',
            'status' => 'approved',
            'published_at' => now(),
        ]);

        ArticleComment::create([
            'article_id' => $article->id,
            'user_id' => $commenter->id,
            'body' => 'Komentar uji.',
        ]);

        // Event dan paket dibuat admin (kolom created_by terisi).
        $event = Event::create([
            'title' => 'Event Uji Privasi',
            'description' => 'Deskripsi event uji coba.',
            'starts_at' => now()->addWeek(),
            'fee' => 0,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        $package = Package::create([
            'name' => 'Paket Uji Privasi',
            'price' => 1000000,
            'discount' => 0,
            'created_by' => $admin->id,
        ]);

        return [
            'emails' => User::pluck('email')->all(),
            'urls' => [
                'katalog buku' => '/api/v1/books',
                'detail buku' => "/api/v1/books/{$book->slug}",
                'daftar proyek bab' => '/api/v1/book-chapter-projects',
                'detail proyek bab' => "/api/v1/book-chapter-projects/{$project->id}",
                'daftar artikel' => '/api/v1/articles',
                'detail artikel' => "/api/v1/articles/{$article->slug}",
                'komentar artikel' => "/api/v1/articles/{$article->slug}/comments",
                'daftar penulis' => '/api/v1/public/authors?role=penulis',
                'profil penulis' => '/api/v1/public/authors/penulis',
                'profil editor' => '/api/v1/public/authors/editor',
                'daftar event' => '/api/v1/events',
                'detail event' => "/api/v1/events/{$event->slug}",
                'daftar paket' => '/api/v1/packages',
                'detail paket' => "/api/v1/packages/{$package->id}",
            ],
        ];
    }

    /**
     * Semua nama kunci terlarang yang muncul di mana pun dalam payload.
     *
     * @return list<string>
     */
    private function hiddenKeysIn(mixed $node): array
    {
        if (! is_array($node)) {
            return [];
        }

        $found = [];

        foreach ($node as $key => $value) {
            if (in_array($key, self::HIDDEN_KEYS, true)) {
                $found[] = $key;
            }

            array_push($found, ...$this->hiddenKeysIn($value));
        }

        return $found;
    }

    private function assertPublicResponseIsClean(string $content, array $emails, string $label): void
    {
        foreach ($emails as $email) {
            $this->assertStringNotContainsStringIgnoringCase(
                $email,
                $content,
                "{$label} membocorkan email {$email}."
            );
        }

        $this->assertSame(
            [],
            $this->hiddenKeysIn(json_decode($content, true)),
            "{$label} masih memuat kunci privat."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Endpoint publik tidak membocorkan data privat
    |--------------------------------------------------------------------------
    */

    public function test_public_endpoints_hide_emails_fee_data_and_internal_ids_from_guests(): void
    {
        ['emails' => $emails, 'urls' => $urls] = $this->seedPublicContent();

        foreach ($urls as $label => $url) {
            $response = $this->getJson($url);

            $response->assertOk();
            $this->assertPublicResponseIsClean($response->getContent(), $emails, $label);
        }
    }

    public function test_public_endpoints_stay_clean_for_logged_in_callers_too(): void
    {
        ['emails' => $emails, 'urls' => $urls] = $this->seedPublicContent();

        Sanctum::actingAs(User::where('email', 'rahasia-admin@privat.test')->firstOrFail());

        foreach ($urls as $label => $url) {
            $response = $this->getJson($url);

            $response->assertOk();
            $this->assertPublicResponseIsClean($response->getContent(), $emails, $label);
        }
    }

    public function test_public_endpoints_still_return_their_normal_content(): void
    {
        $this->seedPublicContent();

        $this->getJson('/api/v1/books/buku-uji-privasi')
            ->assertOk()
            ->assertJsonPath('data.title', 'Buku Uji Privasi')
            ->assertJsonPath('data.editor_name', 'Pengguna editor')
            ->assertJsonPath('data.editor_profile.public_profile.slug', 'editor')
            ->assertJsonPath('data.author_profiles.0.public_profile.slug', 'penulis')
            ->assertJsonPath('data.author_profiles.1.public_profile.slug', 'penulis-dua')
            ->assertJsonPath('data.manuscript.editor.name', 'Pengguna editor')
            ->assertJsonPath('data.manuscript.editor.public_profile.pen_name', 'Editor Uji')
            ->assertJsonPath('data.reviews.0.user.name', 'Pengguna pengulas')
            ->assertJsonPath('data.reviews.0.rating', 5);

        $this->getJson('/api/v1/book-chapter-projects')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Antologi Uji Privasi')
            ->assertJsonPath('data.0.owner_editor.name', 'Pengguna editor')
            ->assertJsonCount(2, 'data.0.chapters');

        // Frontend mengenali komentar milik sendiri lewat `comment.user.id`
        // (tombol hapus), jadi id di dalam objek user harus tetap ada.
        $commenterId = User::where('email', 'rahasia-pengomentar@privat.test')->value('id');

        $this->getJson('/api/v1/articles/artikel-uji-privasi/comments')
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Komentar uji.')
            ->assertJsonPath('data.0.user.name', 'Pengguna pengomentar')
            ->assertJsonPath('data.0.user.id', $commenterId);

        $this->getJson('/api/v1/public/authors/editor')
            ->assertOk()
            ->assertJsonPath('data.profile.slug', 'editor')
            ->assertJsonPath('data.profile.name', 'Editor Uji')
            ->assertJsonPath('data.profile.edited_books.0.title', 'Buku Uji Privasi');
    }

    /**
     * Penjaga agar tes di atas tidak lolos "kosong": tanpa penyaring,
     * fixture yang sama harus benar-benar membocorkan kunci privat (email,
     * fee, id internal) di tiap URL — kalau tidak, fixture tidak lagi
     * menjangkau relasi yang ingin dilindungi.
     */
    public function test_fixture_reaches_the_leaking_relations_when_the_sanitizer_is_off(): void
    {
        ['urls' => $urls] = $this->seedPublicContent();

        $this->withoutMiddleware(SanitizePublicResponse::class);

        // "daftar penulis" memang tidak memuat relasi User.
        unset($urls['daftar penulis']);

        $keysSeen = [];

        foreach ($urls as $label => $url) {
            $content = $this->getJson($url)->assertOk()->getContent();
            $keys = $this->hiddenKeysIn(json_decode($content, true));

            $this->assertNotEmpty($keys, "Fixture '{$label}' tidak menjangkau kunci privat apa pun.");

            array_push($keysSeen, ...$keys);
        }

        // Setiap kunci terlarang harus benar-benar muncul di salah satu
        // respons tanpa penyaring; kalau tidak, penghapusannya tidak teruji.
        $unreached = array_values(array_diff(self::HIDDEN_KEYS, $keysSeen));
        $this->assertSame([], $unreached, 'Fixture tidak menjangkau kunci: '.implode(', ', $unreached));

        $bookDetail = $this->getJson($urls['detail buku'])->assertOk();
        $bookDetail->assertJsonPath('data.manuscript.editor_fee', '600000.00');
        $bookDetail->assertJsonPath('data.manuscript.editor_assignment_note', 'Catatan internal admin untuk editor');
    }

    /**
     * Penjaga agar endpoint publik baru tidak lupa dipasangi penyaring:
     * setiap rute GET yang bisa diakses tanpa login harus memakainya.
     */
    public function test_every_unauthenticated_get_route_is_sanitized(): void
    {
        $unprotected = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/v1'))
            ->filter(fn ($route) => in_array('GET', $route->methods(), true))
            ->reject(fn ($route) => in_array($route->uri(), self::UNFILTERED_PUBLIC_ROUTES, true))
            ->filter(function ($route) {
                $middleware = collect($route->gatherMiddleware())
                    ->filter(fn ($name) => is_string($name));

                $requiresLogin = $middleware->contains(
                    fn (string $name) => str_starts_with($name, 'auth') || str_starts_with($name, 'role')
                );

                return ! $requiresLogin && ! $middleware->contains('public.sanitize');
            })
            ->map(fn ($route) => $route->uri())
            ->values()
            ->all();

        $this->assertSame(
            [],
            $unprotected,
            'Rute GET publik tanpa middleware public.sanitize: '.implode(', ', $unprotected)
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Endpoint terautentikasi/admin tidak ikut disaring
    |--------------------------------------------------------------------------
    */

    public function test_admin_endpoints_still_return_user_emails(): void
    {
        $this->seedPublicContent();

        Sanctum::actingAs(User::where('email', 'rahasia-admin@privat.test')->firstOrFail());

        $this->getJson('/api/v1/admin/users')
            ->assertOk()
            ->assertJsonFragment(['email' => 'rahasia-penulis@privat.test'])
            ->assertJsonFragment(['email' => 'rahasia-editor@privat.test']);
    }

    public function test_admin_endpoints_keep_the_internal_ids_and_fee_data_the_dashboards_need(): void
    {
        $this->seedPublicContent();

        Sanctum::actingAs(User::where('email', 'rahasia-admin@privat.test')->firstOrFail());

        $row = $this->getJson('/api/v1/admin/manuscripts')->assertOk()->json('data.0');

        foreach (['user_id', 'editor_id', 'order_id', 'editor_fee', 'editor_admin_fee',
            'editor_requested_fee', 'editor_assignment_note', 'editor_deadline'] as $key) {
            $this->assertArrayHasKey($key, $row, "Endpoint admin kehilangan kunci {$key}.");
        }

        $this->assertSame('600000.00', $row['editor_fee']);
        $this->assertSame('Catatan internal admin untuk editor', $row['editor_assignment_note']);
    }

    public function test_users_still_see_their_own_email_on_their_own_profile(): void
    {
        $this->seedPublicContent();

        Sanctum::actingAs(User::where('email', 'rahasia-penulis@privat.test')->firstOrFail());

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonFragment(['email' => 'rahasia-penulis@privat.test']);
    }

    /*
    |--------------------------------------------------------------------------
    | Perilaku middleware
    |--------------------------------------------------------------------------
    */

    public function test_sanitizer_only_removes_private_keys_and_keeps_everything_else_byte_for_byte(): void
    {
        Route::middleware('public.sanitize')->get('/__uji/sanitize', fn () => response()->json([
            'user' => ['id' => 7, 'name' => 'Ani', 'email' => 'ani@privat.test', 'email_verified_at' => null],
            'empty_object' => new \stdClass,
            'empty_list' => [],
            'rating' => 4.5,
            'float_without_fraction' => 4.0,
            'nested' => [
                ['email' => 'x@privat.test', 'keep' => 'ok'],
                ['editor_fee' => '1.00', 'title' => 'T'],
            ],
            'manuscript' => [
                'editor_fee' => '600000.00',
                'editor_admin_fee' => 0,
                'editor_requested_fee' => '500000.00',
                'editor_assignment_note' => 'rahasia',
                'editor_deadline' => '2026-10-01',
                'user_id' => 7,
                'editor_id' => 8,
                'owner_editor_id' => 8,
                'order_id' => 5,
                'created_by' => 1,
                'title' => 'Naskah',
                'book_id' => 3,
            ],
            'unicode' => 'Kopi — nikmat',
            'path' => 'a/b',
        ], 201, ['X-Uji' => 'ya']));

        $response = $this->getJson('/__uji/sanitize');

        $response->assertStatus(201);
        $response->assertHeader('X-Uji', 'ya');
        // Ekspektasi ditulis manual (bukan hasil pemrosesan ulang) dengan
        // opsi json_encode bawaan yang sama seperti respons biasa: "/" dan
        // Unicode di-escape, float tanpa pecahan ditulis tanpa ".0".
        $this->assertSame(
            '{"user":{"id":7,"name":"Ani"},"empty_object":{},"empty_list":[],"rating":4.5,'
            .'"float_without_fraction":4,"nested":[{"keep":"ok"},{"title":"T"}],'
            .'"manuscript":{"title":"Naskah","book_id":3},"unicode":'.json_encode('Kopi — nikmat').',"path":"a\/b"}',
            $response->getContent()
        );
    }

    public function test_sanitizer_handles_top_level_lists_and_leaves_other_responses_alone(): void
    {
        Route::middleware('public.sanitize')->group(function () {
            Route::get('/__uji/list', fn () => response()->json([
                ['id' => 1, 'email' => 'a@privat.test'],
                ['id' => 2],
            ]));
            Route::get('/__uji/scalar', fn () => response()->json('ok'));
            Route::get('/__uji/empty', fn () => response()->noContent());
            Route::get('/__uji/text', fn () => response('email: a@privat.test'));
        });

        $this->assertSame('[{"id":1},{"id":2}]', $this->getJson('/__uji/list')->getContent());
        $this->assertSame('"ok"', $this->getJson('/__uji/scalar')->getContent());
        $this->getJson('/__uji/empty')->assertNoContent();
        $this->assertSame('email: a@privat.test', $this->get('/__uji/text')->getContent());
    }
}
