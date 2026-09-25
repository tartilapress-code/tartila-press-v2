<?php

namespace Modules\Publisher\Http\Controllers\DraftEditing;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Publisher\Models\Manuscript;

class ManuscriptController extends Controller
{
    public function index(Request $request)
    {
        $manuscripts = Manuscript::query()
            ->with('template:id,name')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($manuscripts);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'template_id' => ['required', 'uuid', 'exists:pub_templates,id'],
            'title' => ['required', 'string', 'max:255'],
        ]);

        $data['created_by'] = $request->user()?->id;

        $manuscript = Manuscript::create($data);
        $manuscript->metadata()->create([]);

        return response()->json($manuscript->load('metadata'), 201);
    }

    public function show(Manuscript $manuscript)
    {
        return response()->json(
            $manuscript->load(['template', 'metadata', 'chapters.blocks', 'references'])
        );
    }

    public function update(Request $request, Manuscript $manuscript)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:draft,in_review,ready'],
        ]);

        // Update identitas buku (nested dalam request yang sama demi kenyamanan FE)
        if ($request->has('metadata')) {
            $metadata = $request->validate([
                'metadata.author' => ['sometimes', 'nullable', 'string'],
                'metadata.editor' => ['sometimes', 'nullable', 'string'],
                'metadata.designer' => ['sometimes', 'nullable', 'string'],
                'metadata.foreword' => ['sometimes', 'nullable', 'string'],
                'metadata.custom_fields' => ['sometimes', 'nullable', 'array'],
            ]);

            $manuscript->metadata()->updateOrCreate([], $metadata['metadata']);
        }

        $manuscript->update($data);

        return response()->json($manuscript->fresh()->load('metadata'));
    }

    public function destroy(Manuscript $manuscript)
    {
        if ($manuscript->status === 'published') {
            return response()->json([
                'message' => 'Naskah yang sudah terbit tidak bisa dihapus.',
            ], 422);
        }

        $manuscript->delete();

        return response()->json(null, 204);
    }

    /**
     * Pindahkan naskah menjadi entri di katalog buku terbit.
     * Integrasi nyata ke tabel katalog (mis. membuat baris "Book" di sistem
     * utama) sebaiknya dipanggil di sini via service/event, bukan langsung
     * query tabel lain lintas modul.
     */
    public function publish(Request $request, Manuscript $manuscript)
    {
        $data = $request->validate([
            'isbn' => ['required', 'string', 'max:32'],
            'published_book_id' => ['required', 'integer'],
        ]);

        $manuscript->update([
            'status' => 'published',
            'isbn' => $data['isbn'],
            'published_book_id' => $data['published_book_id'],
            'published_at' => now(),
        ]);

        return response()->json($manuscript->fresh());
    }
}
