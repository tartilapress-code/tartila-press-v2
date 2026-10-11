<?php

namespace Tests\Feature\Security;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sapuan otorisasi untuk fitur baru: setiap endpoint admin harus menolak
 * tamu (401) dan user biasa / penulis / editor (403/404) — tidak boleh
 * sampai ke validasi (422), berhasil (2xx), atau error server (5xx).
 */
class NewFeatureAccessSweepTest extends TestCase
{
    use RefreshDatabase;

    /** Awalan URI fitur baru (sertifikat, presensi, voucher, dompet, ISBN, sosmed, template naskah, Book Chapter). */
    private const ADMIN_PREFIXES = [
        'api/v1/admin/events/{event}/attendance',
        'api/v1/admin/certificate-templates',
        'api/v1/admin/manuscript-templates',
        'api/v1/admin/manuscripts/{manuscript}/revisions/{revision}/auto-layout',
        'api/v1/admin/social',
        'api/v1/admin/isbn-applications',
        'api/v1/admin/isbn-settings',
        'api/v1/admin/withdrawals',
        'api/v1/admin/discounts',
        'api/v1/admin/vouchers',
        'api/v1/admin/voucher-grants',
        'api/v1/admin/book-chapter-projects/{bookChapterProject}/compilation',
        'api/v1/admin/finance',
        'api/v1/admin/hki',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user', 'penulis', 'editor', 'admin'] as $name) {
            Role::create(['name' => $name, 'display_name' => ucfirst($name)]);
        }
    }

    /** @return list<Route> */
    private function adminRoutes(): array
    {
        $routes = array_values(array_filter(
            RouteFacade::getRoutes()->getRoutes(),
            function (Route $route) {
                foreach (self::ADMIN_PREFIXES as $prefix) {
                    if (str_starts_with($route->uri(), $prefix)) {
                        return true;
                    }
                }

                return false;
            }
        ));

        $this->assertGreaterThan(40, count($routes), 'Sapuan tidak menemukan cukup endpoint.');

        return $routes;
    }

    private function hit(Route $route): int
    {
        // Parameter berbatasan (mis. order|withdrawal) diisi pilihan pertamanya.
        $uri = '/'.preg_replace_callback('/\{([^}?]+)\??\}/', function ($match) use ($route) {
            $pattern = $route->wheres[$match[1]] ?? null;

            return $pattern && preg_match('/^[a-z|_-]+$/i', $pattern) ? explode('|', $pattern)[0] : '1';
        }, $route->uri());
        $method = collect($route->methods())->reject(fn ($m) => $m === 'HEAD')->first();

        return $this->json($method, $uri, ['decision' => 'approve', 'amount' => 1, 'name' => 'x'])->status();
    }

    public function test_guests_are_rejected_by_every_new_admin_endpoint(): void
    {
        $failures = [];

        foreach ($this->adminRoutes() as $route) {
            $status = $this->hit($route);

            if ($status !== 401) {
                $failures[] = implode('|', $route->methods()).' '.$route->uri()." → $status";
            }
        }

        $this->assertSame([], $failures);
    }

    public function test_non_admin_roles_are_rejected_by_every_new_admin_endpoint(): void
    {
        foreach (['user', 'penulis', 'editor'] as $role) {
            $user = User::create(['name' => "Uji $role", 'email' => "$role@example.com", 'password' => 'Tartila@2026']);
            $user->roles()->attach(Role::where('name', $role)->pluck('id'));
            Sanctum::actingAs($user);
            $failures = [];

            foreach ($this->adminRoutes() as $route) {
                $status = $this->hit($route);

                if (! in_array($status, [403, 404], true)) {
                    $failures[] = "[$role] ".implode('|', $route->methods()).' '.$route->uri()." → $status";
                }
            }

            $this->assertSame([], $failures);
        }
    }
}
