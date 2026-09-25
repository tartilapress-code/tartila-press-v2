<?php

namespace Modules\Publisher\Http\Controllers\DraftEditing;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Publisher\Models\Manuscript;
use Modules\Publisher\Models\ManuscriptChapter;

class ManuscriptChapterController extends Controller
{
    public function index(Manuscript $manuscript)
    {
        return response()->json($manuscript->chapters()->with('blocks')->get());
    }

    public function store(Request $request, Manuscript $manuscript)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'order' => ['nullable', 'integer'],
        ]);

        $data['order'] ??= $manuscript->chapters()->max('order') + 1;

        $chapter = $manuscript->chapters()->create($data);

        return response()->json($chapter, 201);
    }

    public function update(Request $request, Manuscript $manuscript, ManuscriptChapter $chapter)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'order' => ['sometimes', 'integer'],
        ]);

        $chapter->update($data);

        return response()->json($chapter);
    }

    public function destroy(Manuscript $manuscript, ManuscriptChapter $chapter)
    {
        $chapter->delete();

        return response()->json(null, 204);
    }

    /**
     * Urutkan ulang bab, dipanggil dari drag-and-drop di FE.
     * Payload: { "order": ["uuid1", "uuid2", "uuid3"] }
     */
    public function reorder(Request $request, Manuscript $manuscript)
    {
        $data = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['required', 'uuid'],
        ]);

        foreach ($data['order'] as $index => $chapterId) {
            ManuscriptChapter::where('id', $chapterId)
                ->where('manuscript_id', $manuscript->id)
                ->update(['order' => $index]);
        }

        return response()->json($manuscript->chapters()->get());
    }
}
