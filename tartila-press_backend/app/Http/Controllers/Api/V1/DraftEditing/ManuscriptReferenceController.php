<?php

namespace Modules\Publisher\Http\Controllers\DraftEditing;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Publisher\Models\Manuscript;
use Modules\Publisher\Models\ManuscriptReference;

class ManuscriptReferenceController extends Controller
{
    public function index(Manuscript $manuscript)
    {
        return response()->json($manuscript->references()->get());
    }

    public function store(Request $request, Manuscript $manuscript)
    {
        $data = $request->validate([
            'citation' => ['required', 'string'],
            'order' => ['nullable', 'integer'],
        ]);

        $data['order'] ??= $manuscript->references()->max('order') + 1;

        $reference = $manuscript->references()->create($data);

        return response()->json($reference, 201);
    }

    public function update(Request $request, Manuscript $manuscript, ManuscriptReference $reference)
    {
        $data = $request->validate([
            'citation' => ['sometimes', 'string'],
            'order' => ['sometimes', 'integer'],
        ]);

        $reference->update($data);

        return response()->json($reference);
    }

    public function destroy(Manuscript $manuscript, ManuscriptReference $reference)
    {
        $reference->delete();

        return response()->json(null, 204);
    }
}
