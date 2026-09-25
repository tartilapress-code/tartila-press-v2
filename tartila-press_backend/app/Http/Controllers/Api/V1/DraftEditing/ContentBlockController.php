<?php

namespace Modules\Publisher\Http\Controllers\DraftEditing;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Publisher\Models\ContentBlock;
use Modules\Publisher\Models\ManuscriptChapter;

class ContentBlockController extends Controller
{
    public function index(ManuscriptChapter $chapter)
    {
        return response()->json($chapter->blocks()->get());
    }

    public function store(Request $request, ManuscriptChapter $chapter)
    {
        $data = $request->validate([
            'type' => ['required', 'in:heading,paragraph,image,table,quote,citation'],
            'content' => ['required', 'array'],
            'order' => ['nullable', 'integer'],
        ]);

        $data['order'] ??= $chapter->blocks()->max('order') + 1;

        $block = $chapter->blocks()->create($data);

        return response()->json($block, 201);
    }

    public function update(Request $request, ManuscriptChapter $chapter, ContentBlock $block)
    {
        $data = $request->validate([
            'type' => ['sometimes', 'in:heading,paragraph,image,table,quote,citation'],
            'content' => ['sometimes', 'array'],
            'order' => ['sometimes', 'integer'],
        ]);

        $block->update($data);

        return response()->json($block);
    }

    public function destroy(ManuscriptChapter $chapter, ContentBlock $block)
    {
        $block->delete();

        return response()->json(null, 204);
    }

    /**
     * Payload: { "order": ["uuid1", "uuid2", ...] }
     */
    public function reorder(Request $request, ManuscriptChapter $chapter)
    {
        $data = $request->validate([
            'order' => ['required', 'array'],
            'order.*' => ['required', 'uuid'],
        ]);

        foreach ($data['order'] as $index => $blockId) {
            ContentBlock::where('id', $blockId)
                ->where('chapter_id', $chapter->id)
                ->update(['order' => $index]);
        }

        return response()->json($chapter->blocks()->get());
    }
}
