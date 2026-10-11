<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapterSetting;
use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Services\BookChapterCostCalculator;
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
            ->filter(fn (Manuscript $manuscript) => $this->pool->matches($manuscript, $editorFields))
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
            ->get();

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
