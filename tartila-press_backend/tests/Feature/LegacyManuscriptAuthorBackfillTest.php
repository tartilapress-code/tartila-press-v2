<?php

namespace Tests\Feature;

use App\Models\Manuscript;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Naskah lama tanpa daftar penulis dipulihkan oleh migrasi 2026_10_17. */
class LegacyManuscriptAuthorBackfillTest extends TestCase
{
    use RefreshDatabase;

    private function runBackfill(): void
    {
        $migration = require database_path('migrations/2026_10_17_090000_backfill_missing_manuscript_authors.php');
        $migration->up();
    }

    public function test_submitter_becomes_first_author_of_legacy_manuscripts(): void
    {
        Role::create(['name' => 'penulis', 'display_name' => 'Penulis']);
        $writer = User::create(['name' => 'Penulis Lama', 'email' => 'lama@example.com', 'password' => 'Tartila@2026']);
        $coWriter = User::create(['name' => 'Penulis Bersama', 'email' => 'bersama@example.com', 'password' => 'Tartila@2026']);

        $legacyActive = Manuscript::create(['user_id' => $writer->id, 'title' => 'Lama Aktif', 'authors' => ['x'], 'status' => 'in_editing']);
        $legacyDone = Manuscript::create(['user_id' => $writer->id, 'title' => 'Lama Selesai', 'authors' => ['x'], 'status' => 'completed']);
        $modern = Manuscript::create(['user_id' => $writer->id, 'title' => 'Baru', 'authors' => ['x', 'y'], 'status' => 'submitted']);
        $modern->authorLinks()->create(['user_id' => $writer->id, 'position' => 1]);
        $modern->authorLinks()->create(['user_id' => $coWriter->id, 'position' => 2]);

        Sanctum::actingAs($writer);
        $this->getJson("/api/v1/manuscripts/{$legacyActive->id}")->assertForbidden();

        $this->runBackfill();
        $this->runBackfill(); // aman dijalankan ulang

        $this->assertSame(1, $legacyActive->authorLinks()->count());
        $this->assertNull($legacyActive->authorLinks()->first()->approved_at);
        $this->assertNotNull($legacyDone->authorLinks()->first()->approved_at);
        $this->assertSame(2, $modern->authorLinks()->count());

        $this->getJson("/api/v1/manuscripts/{$legacyActive->id}")->assertOk();
        $this->getJson('/api/v1/manuscripts/mine')->assertOk()->assertJsonCount(3, 'data');
    }
}
