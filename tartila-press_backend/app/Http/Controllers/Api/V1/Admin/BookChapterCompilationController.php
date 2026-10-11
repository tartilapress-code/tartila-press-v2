<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\ManuscriptTemplate;
use App\Services\BookChapterCompilationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Admin menggabungkan naskah semua bab proyek Book Chapter menjadi satu
 * naskah buku (urut nomor bab) yang lalu dikerjakan editor.
 */
class BookChapterCompilationController extends Controller
{
    public function __construct(private readonly BookChapterCompilationService $service) {}

    public function show(Book $bookChapterProject): JsonResponse
    {
        abort_unless($bookChapterProject->is_chapter_offering, 404);

        return response()->json([
            'success' => true,
            'message' => 'Status penggabungan naskah berhasil diambil.',
            'data' => $this->service->overview($bookChapterProject),
        ]);
    }

    public function store(Request $request, Book $bookChapterProject): JsonResponse
    {
        $validated = $request->validate([
            'auto_layout' => ['nullable', 'boolean'],
            'manuscript_template_id' => ['nullable', 'integer', Rule::exists('manuscript_templates', 'id')],
            'allow_missing' => ['nullable', 'boolean'],
        ]);

        $template = null;

        if (! empty($validated['auto_layout'])) {
            $template = isset($validated['manuscript_template_id'])
                ? ManuscriptTemplate::find($validated['manuscript_template_id'])
                : ManuscriptTemplate::default();

            abort_unless($template, 422, 'Belum ada template naskah. Buat template di menu Template Naskah.');
        }

        $isNew = $bookChapterProject->compilation()->doesntExist();

        try {
            $compilation = $this->service->compile(
                $bookChapterProject,
                $request->user(),
                $template,
                (bool) ($validated['allow_missing'] ?? false)
            );
        } catch (HttpExceptionInterface $exception) {
            throw $exception;
        } catch (RuntimeException $exception) {
            abort(422, 'Penggabungan gagal: '.$exception->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => $isNew
                ? 'Naskah semua bab berhasil digabung menjadi satu buku dan dikirim ke editor.'
                : 'Naskah gabungan baru berhasil dibuat.',
            'data' => $compilation,
        ], $isNew ? 201 : 200);
    }
}
