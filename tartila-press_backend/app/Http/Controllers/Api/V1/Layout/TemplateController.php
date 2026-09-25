<?php

namespace Modules\Publisher\Http\Controllers\Layout;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Modules\Publisher\Models\Template;

class TemplateController extends Controller
{
    public function index(Request $request)
    {
        $templates = Template::query()
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($templates);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'structure_config' => ['required', 'array'],
            'page_numbering_config' => ['nullable', 'array'],
            'theme_config' => ['nullable', 'array'],
        ]);

        $data['slug'] = Str::slug($data['name']).'-'.Str::random(6);
        $data['created_by'] = $request->user()?->id;

        $template = Template::create($data);

        return response()->json($template, 201);
    }

    public function show(Template $template)
    {
        return response()->json($template);
    }

    public function update(Request $request, Template $template)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'structure_config' => ['sometimes', 'array'],
            'theme_config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $template->update($data);

        return response()->json($template);
    }

    public function destroy(Template $template)
    {
        // Cegah hapus template yang masih dipakai naskah aktif
        if ($template->manuscripts()->exists()) {
            return response()->json([
                'message' => 'Template masih digunakan oleh naskah dan tidak bisa dihapus.',
            ], 422);
        }

        $template->delete();

        return response()->json(null, 204);
    }
}
