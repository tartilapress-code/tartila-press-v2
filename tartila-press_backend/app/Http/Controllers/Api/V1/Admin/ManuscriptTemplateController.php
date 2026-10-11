<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ManuscriptTemplate;
use App\Support\ManuscriptTemplates\TemplateSchema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Template naskah buatan admin: seluruh tata letak buku (halaman, margin,
 * tipografi, heading, header/footer, elemen visual, bagian awal/isi/penutup).
 * Penulis akan memilih salah satu template aktif pada tahap berikutnya.
 */
class ManuscriptTemplateController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Meta - Skema form editor (grup, kolom, pilihan) dan nilai bawaan
    |--------------------------------------------------------------------------
    */

    public function meta(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Data editor template naskah berhasil diambil.',
            'data' => [
                'tabs' => TemplateSchema::TABS,
                'groups' => TemplateSchema::groups(),
                'defaults' => TemplateSchema::defaults(),
                'fonts' => TemplateSchema::FONTS,
                'page_formats' => TemplateSchema::PAGE_FORMATS,
                'front_items' => TemplateSchema::FRONT_ITEMS,
                'body_items' => TemplateSchema::BODY_ITEMS,
                'back_items' => TemplateSchema::BACK_ITEMS,
            ],
        ]);
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Daftar template naskah berhasil diambil.',
            'data' => ManuscriptTemplate::orderByDesc('is_default')->latest()->get(),
        ]);
    }

    public function show(ManuscriptTemplate $manuscriptTemplate): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Template naskah berhasil diambil.',
            'data' => $manuscriptTemplate,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $template = ManuscriptTemplate::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'config' => TemplateSchema::normalize($validated['config'] ?? []),
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Template naskah berhasil dibuat.',
            'data' => $template,
        ], 201);
    }

    public function update(Request $request, ManuscriptTemplate $manuscriptTemplate): JsonResponse
    {
        $validated = $request->validate(array_map(
            fn (array $rule) => in_array('required', $rule, true) ? ['sometimes', ...$rule] : $rule,
            $this->rules()
        ));

        $attributes = collect($validated)->only(['name', 'description', 'is_active'])->all();

        if (array_key_exists('config', $validated)) {
            // Kolom yang tidak dikirim tetap memakai nilai tersimpan.
            $attributes['config'] = TemplateSchema::normalize(
                array_replace_recursive($manuscriptTemplate->config ?? [], $validated['config'] ?? [])
            );
        }

        $manuscriptTemplate->update($attributes);

        return response()->json([
            'success' => true,
            'message' => 'Template naskah disimpan.',
            'data' => $manuscriptTemplate->fresh(),
        ]);
    }

    /** Salin template (nama diberi " (salinan)") untuk dijadikan variasi. */
    public function duplicate(Request $request, ManuscriptTemplate $manuscriptTemplate): JsonResponse
    {
        $copy = ManuscriptTemplate::create([
            'name' => mb_substr($manuscriptTemplate->name, 0, 140).' (salinan)',
            'description' => $manuscriptTemplate->description,
            'config' => $manuscriptTemplate->config,
            'is_active' => false,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Template disalin (nonaktif sampai Anda mengaktifkannya).',
            'data' => $copy,
        ], 201);
    }

    /** Jadikan template bawaan (dipilih otomatis saat auto layout). */
    public function makeDefault(ManuscriptTemplate $manuscriptTemplate): JsonResponse
    {
        ManuscriptTemplate::where('is_default', true)->update(['is_default' => false]);
        $manuscriptTemplate->update(['is_default' => true, 'is_active' => true]);

        return response()->json([
            'success' => true,
            'message' => 'Template dijadikan bawaan.',
            'data' => $manuscriptTemplate->fresh(),
        ]);
    }

    public function destroy(ManuscriptTemplate $manuscriptTemplate): JsonResponse
    {
        abort_if($manuscriptTemplate->is_default, 422, 'Template bawaan tidak bisa dihapus. Jadikan template lain sebagai bawaan dulu.');

        $manuscriptTemplate->delete();

        return response()->json([
            'success' => true,
            'message' => 'Template naskah dihapus.',
        ]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            ...TemplateSchema::rules('config'),
        ];
    }
}
