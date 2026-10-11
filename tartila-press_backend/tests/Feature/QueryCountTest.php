<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookChapter;
use App\Models\Manuscript;
use App\Models\Role;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pengaman query N+1: jumlah query sebuah daftar tidak boleh ikut bertambah
 * ketika jumlah barisnya bertambah (lihat docs/Laporan-Uji-Performa).
 */
class QueryCountTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }

        $this->admin = $this->makeUser(['admin']);
    }

    private function makeUser(array $roles = []): User
    {
        $user = User::create(['name' => 'Penguji '.uniqid(), 'email' => uniqid('u').'@example.com', 'password' => 'Tartila@2026']);
        $user->roles()->attach(Role::whereIn('name', $roles)->pluck('id'));

        return $user;
    }

    /** Buku terbit dari naskah yang punya editor + proyek Book Chapter berisi 3 bab. */
    private function addRows(int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $writer = $this->makeUser(['penulis']);
            $editor = $this->makeUser(['editor']);
            $manuscript = Manuscript::create(['user_id' => $writer->id, 'editor_id' => $editor->id, 'title' => 'Naskah '.uniqid(), 'authors' => [$writer->name], 'status' => 'completed']);
            $manuscript->authorLinks()->create(['user_id' => $writer->id, 'position' => 1]);

            Book::create(['title' => 'Buku '.uniqid(), 'price' => 100000, 'discount' => 0, 'is_active' => true, 'manuscript_id' => $manuscript->id, 'created_by' => $this->admin->id]);

            $project = Book::create(['title' => 'Proyek '.uniqid(), 'price' => 50000, 'discount' => 0, 'is_active' => true, 'is_chapter_offering' => true, 'owner_editor_id' => $editor->id, 'created_by' => $this->admin->id]);
            foreach ([1, 2, 3] as $number) {
                BookChapter::create(['book_id' => $project->id, 'chapter_number' => $number, 'title' => "Bab {$number}"]);
            }

            Voucher::create(['code' => strtoupper(uniqid('V')), 'source' => Voucher::SOURCE_ADMIN, 'targets' => [['type' => 'book', 'id' => $project->id]], 'discount_percent' => 10, 'is_active' => true]);
        }
    }

    private function queriesFor(string $uri): int
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson($uri)->assertOk();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    public function test_list_endpoints_do_not_run_a_query_per_row(): void
    {
        $endpoints = [
            [null, '/api/v1/books'],
            [null, '/api/v1/book-chapter-projects'],
            ['admin', '/api/v1/admin/books'],
            ['admin', '/api/v1/admin/book-chapter-projects'],
            ['admin', '/api/v1/admin/manuscripts'],
            ['admin', '/api/v1/admin/vouchers'],
            ['admin', '/api/v1/admin/hki'],
            ['admin', '/api/v1/admin/isbn-applications'],
            ['admin', '/api/v1/dashboard/summary'],
        ];

        $measure = function () use ($endpoints): array {
            $counts = [];
            foreach ($endpoints as [$role, $uri]) {
                $role ? Sanctum::actingAs($this->admin) : $this->app['auth']->forgetGuards();
                $counts[$uri.($role ? ' (admin)' : '')] = $this->queriesFor($uri);
            }

            return $counts;
        };

        $this->addRows(2);
        $small = $measure();

        $this->addRows(5);
        $large = $measure();

        foreach ($small as $endpoint => $queries) {
            $this->assertLessThanOrEqual($queries, $large[$endpoint], "{$endpoint}: jumlah query bertambah mengikuti jumlah baris (N+1).");
        }
    }
}
