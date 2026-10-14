<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapterSetting;
use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Services\BookChapterCostCalculator;
use App\Services\ManuscriptAssignmentService;
use App\Services\ManuscriptPoolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ManuscriptController extends Controller
{
    public function __construct(
        private readonly BookChapterCostCalculator $costCalculator,
        private readonly ManuscriptPoolService $pool,
        private readonly ManuscriptAssignmentService $assignment,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Pool - Naskah yang terbuka untuk diambil
    |--------------------------------------------------------------------------
    */

    // Hanya naskah yang kriteria bidangnya cocok dengan bidang keahlian
    // editor (naskah "Umum" terbuka untuk semua editor).
    public function pool(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->ensureEligible($user);

        $editorFields = $this->pool->editorFieldIds($user);
        $fieldCategories = FieldCategory::get(['id', 'name']);

        $manuscripts = Manuscript::with('user')
            ->where('open_for_claim', true)
            ->latest()
            ->get()
            ->filter(fn (Manuscript $manuscript) => $manuscript->coauthor_id !== $user->id && $this->pool->matches($manuscript, $editorFields))
            ->map(function (Manuscript $manuscript) use ($fieldCategories) {
                $manuscript->setAttribute('pool_criteria', $this->pool->describe($manuscript, $fieldCategories));

                return $manuscript;
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah terbuka berhasil diambil.',
            'data' => $manuscripts,
            'meta' => [
                'my_field_categories' => $fieldCategories->whereIn('id', $editorFields)->pluck('name')->values(),
                'under_monitoring' => (bool) $user->editorProfile?->is_banned,
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Claim - Editor mengambil naskah dari pool
    |--------------------------------------------------------------------------
    */

    public function claim(Request $request, Manuscript $manuscript): JsonResponse
    {
        $user = $request->user();

        $this->ensureEligible($user);

        $this->ensureNotMonitored($user);

        $manuscript = DB::transaction(function () use ($manuscript, $user) {
            $locked = Manuscript::whereKey($manuscript->id)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                $locked->open_for_claim,
                422,
                'Naskah ini sudah tidak tersedia di pool.'
            );

            abort_unless(
                $this->pool->canClaim($user, $locked),
                403,
                'Naskah ini khusus untuk editor dengan bidang keahlian tertentu.'
            );

            abort_if(
                $locked->coauthor_id === $user->id,
                403,
                'Anda co-author naskah ini, jadi tidak bisa menjadi editornya.'
            );

            $locked->update([
                'editor_id' => $user->id,
                'editor_source' => Manuscript::EDITOR_SOURCE_POOL,
                'open_for_claim' => false,
                'status' => 'in_editing',
            ]);

            return $locked;
        });

        return response()->json([
            'success' => true,
            'message' => 'Naskah berhasil diambil.',
            'data' => $manuscript->fresh(['user']),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Pool Co-author - Naskah yang terbuka untuk diambil co-author
    |--------------------------------------------------------------------------
    */

    public function coauthorPool(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->ensureCoauthor($user);

        $fieldCategories = FieldCategory::get(['id', 'name']);

        $manuscripts = Manuscript::with('user')
            ->where('coauthor_open_for_claim', true)
            ->latest()
            ->get()
            ->filter(fn (Manuscript $manuscript) => $this->assignment->canClaim($user, $manuscript))
            ->map(function (Manuscript $manuscript) use ($fieldCategories) {
                $manuscript->setAttribute('pool_criteria', $this->pool->describe($manuscript, $fieldCategories));

                return $manuscript;
            })
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah terbuka untuk co-author berhasil diambil.',
            'data' => $manuscripts,
            'meta' => [
                'royalty_percent' => $this->assignment->royaltyPercent(),
                'under_monitoring' => (bool) $user->editorProfile?->is_banned,
            ],
        ]);
    }

    public function claimCoauthor(Request $request, Manuscript $manuscript): JsonResponse
    {
        $user = $request->user();

        $this->ensureCoauthor($user);
        $this->ensureNotMonitored($user);

        $manuscript = DB::transaction(function () use ($manuscript, $user) {
            $locked = Manuscript::whereKey($manuscript->id)->lockForUpdate()->firstOrFail();

            abort_unless($locked->coauthor_open_for_claim, 422, 'Naskah ini sudah tidak tersedia di pool co-author.');
            abort_unless($this->assignment->canClaim($user, $locked), 403, 'Naskah ini tidak bisa Anda ambil sebagai co-author.');

            return $this->assignment->attach(
                $locked,
                $user,
                Manuscript::EDITOR_SOURCE_POOL,
                (float) $locked->coauthor_fee,
                null,
                $locked->coauthor_deadline?->toDateString(),
                $locked->coauthor_assignment_note
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Naskah berhasil diambil sebagai co-author.',
            'data' => $manuscript->load('user'),
        ]);
    }

    /** Naskah yang disusun user ini sebagai co-author. */
    public function coauthorMine(Request $request): JsonResponse
    {
        $this->ensureCoauthor($request->user());

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah co-author berhasil diambil.',
            'data' => $request->user()->coauthoredManuscripts()->with(['user', 'revisions'])->latest()->get()
                ->each(fn (Manuscript $manuscript) => $manuscript->hideFeesFrom($request->user(), false)),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Mine - Naskah yang ditugaskan ke editor ini
    |--------------------------------------------------------------------------
    */

    public function mine(Request $request): JsonResponse
    {
        $this->ensureEligible($request->user());

        $manuscripts = $request->user()
            ->assignedManuscripts()
            ->with(['user', 'revisions'])
            ->latest()
            ->get()
            ->each(fn (Manuscript $manuscript) => $manuscript->hideFeesFrom($request->user(), false));

        return response()->json([
            'success' => true,
            'message' => 'Daftar naskah berhasil diambil.',
            'data' => $manuscripts,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Fees - Fee saya dari naskah yang dikerjakan
    |--------------------------------------------------------------------------
    |
    | Besar fee tergantung cara editor mendapatkan naskah:
    | - ditunjuk admin        → fee yang ditetapkan admin
    | - diambil dari pool     → harga pengerjaan naskah (ditetapkan admin)
    | - dipilih langsung      → fee permintaan editor + fee dari admin
    |   oleh penulis
    | Fee dianggap selesai (bisa diterima) setelah naskah berstatus completed.
    |
    | Proyek Book Chapter milik editor dihitung terpisah (bagian "projects"):
    | fee per bab = (diskon maksimal admin − diskon yang diberikan editor)%
    | dari harga bab. Potensi = jika seluruh bab terjual & buku terbit.
    |
    */

    public function fees(Request $request): JsonResponse
    {
        $this->ensureEligible($request->user());

        $manuscripts = $request->user()
            ->assignedManuscripts()
            ->with('user:id,name')
            ->latest()
            ->get();

        $items = $manuscripts->map(fn (Manuscript $manuscript) => [
            'id' => $manuscript->id,
            'title' => $manuscript->title,
            'author' => $manuscript->user?->name,
            'status' => $manuscript->status,
            'source' => $manuscript->editor_source,
            'requested_fee' => $manuscript->editor_requested_fee === null
                ? null
                : (float) $manuscript->editor_requested_fee,
            'admin_fee' => (float) ($manuscript->editor_admin_fee ?? 0),
            'total_fee' => (float) ($manuscript->editor_fee ?? 0),
            'deadline' => $manuscript->editor_deadline?->toDateString(),
        ]);

        $total = round($items->sum('total_fee'), 2);
        $completed = round(
            $items->where('status', 'completed')->sum('total_fee'),
            2
        );

        $projects = $this->projectFees($request->user()->id);

        // Fee sebagai co-author (layanan co-author), dipisah dari fee editor.
        $coauthorItems = $request->user()
            ->coauthoredManuscripts()
            ->with('user:id,name')
            ->latest()
            ->get()
            ->map(fn (Manuscript $manuscript) => [
                'id' => $manuscript->id,
                'title' => $manuscript->title,
                'author' => $manuscript->user?->name,
                'status' => $manuscript->status,
                'source' => $manuscript->coauthor_source,
                'requested_fee' => $manuscript->coauthor_requested_fee === null ? null : (float) $manuscript->coauthor_requested_fee,
                'admin_fee' => (float) ($manuscript->coauthor_admin_fee ?? 0),
                'total_fee' => (float) ($manuscript->coauthor_fee ?? 0),
                'deadline' => $manuscript->coauthor_deadline?->toDateString(),
            ]);
        $coauthorTotal = round($coauthorItems->sum('total_fee'), 2);
        $coauthorCompleted = round($coauthorItems->where('status', 'completed')->sum('total_fee'), 2);

        return response()->json([
            'success' => true,
            'message' => 'Fee editor berhasil diambil.',
            'data' => [
                'summary' => [
                    'count' => $items->count(),
                    'total' => $total,
                    'completed' => $completed,
                    'in_progress' => round($total - $completed, 2),
                ],
                'items' => $items->values(),
                'coauthor_items' => $coauthorItems->values(),
                'coauthor_summary' => [
                    'count' => $coauthorItems->count(),
                    'total' => $coauthorTotal,
                    'completed' => $coauthorCompleted,
                    'in_progress' => round($coauthorTotal - $coauthorCompleted, 2),
                ],
                'projects' => $projects->values(),
                'project_summary' => [
                    'count' => $projects->count(),
                    'potential_fee' => round($projects->sum('potential_fee'), 2),
                    'sold_fee' => round($projects->sum('sold_fee'), 2),
                ],
            ],
        ]);
    }

    /**
     * Fee dari proyek Book Chapter yang dimiliki editor ini.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function projectFees(int $editorId)
    {
        $settings = BookChapterSetting::current();

        return Book::with(['chapters.order', 'packageItems'])
            ->where('is_chapter_offering', true)
            ->where('owner_editor_id', $editorId)
            ->latest()
            ->get()
            ->map(function (Book $project) use ($settings) {
                $summary = $this->costCalculator->summarize($project, $settings);

                // Slot terjual = sudah dibayar (order dikonfirmasi/selesai).
                $sold = $project->chapters->filter(
                    fn ($chapter) => in_array($chapter->order?->status, ['confirmed', 'completed'], true)
                );

                return [
                    'id' => $project->id,
                    'title' => $project->title,
                    'is_published' => (bool) $project->is_active,
                    'chapter_count' => $summary['chapter_count'],
                    'sold_count' => $sold->count(),
                    'discount' => (int) $project->discount,
                    'max_discount' => $summary['max_discount'],
                    'fee_percent' => $summary['fee_percent'],
                    'potential_fee' => $summary['potential_fee'],
                    'sold_fee' => round(
                        $sold->sum(fn ($chapter) => $summary['chapter_fees'][$chapter->id] ?? 0),
                        2
                    ),
                ];
            });
    }

    /*
    |--------------------------------------------------------------------------
    | Ensure only editor can access this area.
    |--------------------------------------------------------------------------
    */

    /** Editor dalam pemantauan admin tidak boleh mengambil naskah dari pool. */
    private function ensureNotMonitored($user): void
    {
        $user->loadMissing('editorProfile');

        abort_if(
            $user->editorProfile?->is_banned,
            403,
            'Akun Anda sedang dalam pemantauan admin, jadi belum bisa mengambil naskah dari pool.'
        );
    }

    private function ensureCoauthor($user): void
    {
        abort_unless(
            ManuscriptAssignmentService::isCoauthor($user) || $user->coauthoredManuscripts()->exists(),
            403,
            'Aktifkan centang co-author di profil editor Anda untuk mengakses ini.'
        );
    }

    private function ensureEligible($user): void
    {
        $allowed = $user->roles()
            ->where('name', 'editor')
            ->exists();

        abort_unless(
            $allowed,
            403,
            'Hanya Editor yang dapat mengakses ini.'
        );
    }
}
