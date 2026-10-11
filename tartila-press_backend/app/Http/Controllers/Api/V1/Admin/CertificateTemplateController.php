<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CertificateTemplate;
use App\Support\Certificates\CertificateFonts;
use App\Support\Certificates\CertificateRenderer;
use App\Support\Certificates\CertificateVariables;
use App\Support\Certificates\TemplateFields;
use App\Support\Certificates\TemplateImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CertificateTemplateController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Meta - font, daftar penanda data, dan konstanta tata letak untuk editor
    |--------------------------------------------------------------------------
    */

    public function meta(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Data editor sertifikat berhasil diambil.',
            'data' => [
                'fonts' => CertificateFonts::meta(),
                'default_font' => CertificateFonts::DEFAULT_FONT,
                'variables' => [
                    CertificateTemplate::TYPE_EVENT => CertificateVariables::catalogue(CertificateTemplate::TYPE_EVENT),
                    CertificateTemplate::TYPE_PUBLICATION => CertificateVariables::catalogue(CertificateTemplate::TYPE_PUBLICATION),
                    CertificateTemplate::TYPE_SOCIAL => CertificateVariables::catalogue(CertificateTemplate::TYPE_SOCIAL),
                ],
                'layout' => [
                    'page_long_side_pt' => (float) config('certificates.page_long_side_pt'),
                    'line_height' => (float) config('certificates.line_height'),
                    'min_font_size_ratio' => (float) config('certificates.min_font_size_ratio'),
                    'min_font_size_pt' => (float) config('certificates.min_font_size_pt'),
                    'step_pt' => 0.5,
                    'max_fields' => TemplateFields::MAX_FIELDS,
                ],
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Index - Semua templat (bisa disaring per tipe)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['nullable', Rule::in(CertificateTemplate::TYPES)],
        ]);

        $templates = CertificateTemplate::query()
            ->when($validated['type'] ?? null, fn ($query, $type) => $query->ofType($type))
            ->withCount('events')
            ->latest('updated_at')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar templat sertifikat berhasil diambil.',
            'data' => $templates,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Upload image - Simpan gambar templat (dinormalisasi), kembalikan path-nya
    |--------------------------------------------------------------------------
    */

    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png',
                'max:'.config('certificates.template_image.max_kb'),
            ],
        ], [
            'image.required' => 'Pilih gambar templat terlebih dahulu.',
            'image.mimes' => 'Gambar templat harus berformat JPG atau PNG.',
            'image.max' => 'Ukuran gambar maksimal '.(config('certificates.template_image.max_kb') / 1024).' MB.',
            'image.uploaded' => 'Gambar gagal diunggah (kemungkinan melebihi batas ukuran server).',
        ]);

        $stored = TemplateImage::store($request->file('image'));

        return response()->json([
            'success' => true,
            'message' => 'Gambar templat berhasil diunggah.',
            'data' => [
                'path' => $stored['path'],
                'width' => $stored['width'],
                'height' => $stored['height'],
                'url' => Storage::disk(config('certificates.template_image.disk'))->url($stored['path']),
            ],
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Preview - PDF contoh dari rancangan yang belum disimpan
    |--------------------------------------------------------------------------
    */

    public function preview(Request $request): Response
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(CertificateTemplate::TYPES)],
            'role' => ['nullable', Rule::in(CertificateTemplate::ROLES)],
            'image_path' => ['required', 'string', $this->storedImageRule()],
            'long' => ['sometimes', 'boolean'],
            ...TemplateFields::rules('fields'),
        ]);

        $fields = TemplateFields::normalize($validated['fields']);
        [$width, $height] = $this->imageSize($validated['image_path']);

        $values = CertificateVariables::withSampleAnswers(
            $fields,
            CertificateVariables::samples(
                $validated['type'],
                (bool) ($validated['long'] ?? false),
                $validated['role'] ?? null
            )
        );

        try {
            $pdf = app(CertificateRenderer::class)->render(
                $validated['image_path'],
                $width,
                $height,
                $fields,
                $values,
                'Pratinjau sertifikat'
            );
        } catch (\Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'fields' => ['Pratinjau gagal dibuat: '.$exception->getMessage()],
            ]);
        }

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="pratinjau-sertifikat.pdf"',
            'Cache-Control' => 'no-store',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin membuat templat
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(CertificateTemplate::TYPES)],
            'name' => ['required', 'string', 'max:150'],
            'role' => ['nullable', Rule::in(CertificateTemplate::ROLES)],
            'image_path' => ['required', 'string', $this->storedImageRule()],
            'is_active' => ['sometimes', 'boolean'],
            ...TemplateFields::rules('fields'),
        ]);

        [$width, $height] = $this->imageSize($validated['image_path']);

        $template = CertificateTemplate::create([
            'type' => $validated['type'],
            'name' => $validated['name'],
            'role' => $validated['type'] === CertificateTemplate::TYPE_PUBLICATION ? ($validated['role'] ?? null) : null,
            'image_path' => $validated['image_path'],
            'image_width' => $width,
            'image_height' => $height,
            'fields' => TemplateFields::normalize($validated['fields']),
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Templat sertifikat berhasil dibuat.',
            'data' => $template,
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Show
    |--------------------------------------------------------------------------
    */

    public function show(CertificateTemplate $certificateTemplate): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Detail templat sertifikat berhasil diambil.',
            'data' => $certificateTemplate->loadCount('events'),
        ]);
    }

    /** Gambar latar templat (JPEG/PNG), diteruskan lewat API untuk kanvas poster. */
    public function image(CertificateTemplate $certificateTemplate): Response
    {
        $path = $certificateTemplate->image_path;

        abort_unless(Storage::disk('public')->exists($path), 404, 'Gambar templat tidak ditemukan.');

        return response(Storage::disk('public')->get($path), 200, [
            'Content-Type' => Storage::disk('public')->mimeType($path) ?: 'image/jpeg',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Tipe templat tidak bisa diubah (event/buku sudah merujuknya)
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, CertificateTemplate $certificateTemplate): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'role' => ['sometimes', 'nullable', Rule::in(CertificateTemplate::ROLES)],
            'image_path' => ['sometimes', 'required', 'string', $this->storedImageRule()],
            'is_active' => ['sometimes', 'boolean'],
            'fields' => ['sometimes', 'required', 'array', 'max:'.TemplateFields::MAX_FIELDS],
            ...collect(TemplateFields::rules('fields'))->except('fields')->all(),
        ]);

        $attributes = collect($validated)->only(['name', 'role', 'is_active'])->all();

        if ($certificateTemplate->type === CertificateTemplate::TYPE_EVENT) {
            unset($attributes['role']);
        }

        if (isset($validated['fields'])) {
            $attributes['fields'] = TemplateFields::normalize($validated['fields']);
        }

        $oldImage = null;

        if (isset($validated['image_path']) && $validated['image_path'] !== $certificateTemplate->image_path) {
            [$width, $height] = $this->imageSize($validated['image_path']);
            $oldImage = $certificateTemplate->image_path;
            $attributes += [
                'image_path' => $validated['image_path'],
                'image_width' => $width,
                'image_height' => $height,
            ];
        }

        $certificateTemplate->update($attributes);

        TemplateImage::delete($oldImage);

        return response()->json([
            'success' => true,
            'message' => 'Templat sertifikat berhasil diperbarui.',
            'data' => $certificateTemplate->fresh()->loadCount('events'),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy - Ditolak selama masih dipakai event
    |--------------------------------------------------------------------------
    */

    public function destroy(CertificateTemplate $certificateTemplate): JsonResponse
    {
        $usedBy = $certificateTemplate->events()->count();

        abort_if(
            $usedBy > 0,
            422,
            "Templat ini masih dipakai oleh {$usedBy} event. Ganti templat di event tersebut dulu."
        );

        $image = $certificateTemplate->image_path;
        $certificateTemplate->delete();
        TemplateImage::delete($image);

        return response()->json([
            'success' => true,
            'message' => 'Templat sertifikat berhasil dihapus.',
        ]);
    }

    /**
     * Path gambar dari langkah upload: harus berada di folder templat dan ada.
     */
    private function storedImageRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if (! is_string($value) || ! TemplateImage::isStored($value)) {
                $fail('Gambar templat tidak ditemukan. Unggah ulang gambarnya.');
            }
        };
    }

    /**
     * @return array{0: int, 1: int}
     */
    private function imageSize(string $path): array
    {
        $size = @getimagesize(Storage::disk(config('certificates.template_image.disk'))->path($path));

        abort_if($size === false, 422, 'Gambar templat tidak bisa dibaca. Unggah ulang gambarnya.');

        return [(int) $size[0], (int) $size[1]];
    }
}
