<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\EditorProfile;
use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Models\User;
use App\Services\ManuscriptPoolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pengaturan pool naskah: bidang keahlian tiap editor (kriteria siapa yang
 * boleh mengambil naskah pool) dan naskah yang sedang terbuka di pool.
 */
class ManuscriptPoolController extends Controller
{
    public function __construct(private readonly ManuscriptPoolService $pool) {}

    public function index(): JsonResponse
    {
        $fieldCategories = FieldCategory::orderBy('name')->get(['id', 'name']);

        $editors = User::whereHas('roles', fn ($query) => $query->where('name', 'editor'))
            ->with('editorProfile')
            ->orderBy('name')
            ->get();

        $editorFields = $editors->mapWithKeys(fn (User $editor) => [$editor->id => $this->pool->editorFieldIds($editor)]);

        $manuscripts = Manuscript::with('user:id,name')
            ->where('open_for_claim', true)
            ->latest()
            ->get()
            ->map(fn (Manuscript $manuscript) => [
                'id' => $manuscript->id,
                'title' => $manuscript->title,
                'authors' => $manuscript->authors ?? [],
                'difficulty' => $manuscript->difficulty,
                'editor_fee' => $manuscript->editor_fee === null ? null : (float) $manuscript->editor_fee,
                'editor_deadline' => $manuscript->editor_deadline?->toDateString(),
                'pool_field_category_ids' => $this->pool->criteriaOf($manuscript),
                'criteria' => $this->pool->describe($manuscript, $fieldCategories),
                'eligible_editor_count' => $editorFields
                    ->filter(fn (array $fields) => $this->pool->matches($manuscript, $fields))
                    ->count(),
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan pool naskah berhasil diambil.',
            'data' => [
                'field_categories' => $fieldCategories,
                'difficulties' => Manuscript::DIFFICULTIES,
                'editors' => $editors->map(fn (User $editor) => [
                    'id' => $editor->id,
                    'name' => $editor->name,
                    'is_available' => (bool) ($editor->editorProfile?->is_available ?? true),
                    'field_category_ids' => $editorFields[$editor->id],
                ])->values(),
                'manuscripts' => $manuscripts->values(),
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Bidang keahlian editor (kosong = hanya naskah "Umum")
    |--------------------------------------------------------------------------
    */

    public function updateEditorFields(Request $request, User $user): JsonResponse
    {
        abort_unless($user->roles()->where('name', 'editor')->exists(), 422, 'User ini bukan Editor.');

        $validated = $request->validate(ManuscriptPoolService::fieldRules('field_category_ids'));

        $profile = EditorProfile::firstOrNew(['user_id' => $user->id]);
        $profile->forceFill([
            'field_category_ids' => ManuscriptPoolService::ids($validated['field_category_ids'] ?? []),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Bidang keahlian editor berhasil disimpan.',
            'data' => [
                'id' => $user->id,
                'field_category_ids' => ManuscriptPoolService::ids($profile->field_category_ids),
            ],
        ]);
    }
}
