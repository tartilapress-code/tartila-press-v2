<?php

namespace Modules\Publisher\Http\Controllers\Layout;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Modules\Publisher\Models\Template;

class PageNumberingController extends Controller
{
    /**
     * Tiap section punya: key, label, numbering.style, numbering.reset_at_start,
     * numbering.position, numbering.show_on_first_page.
     */
    public function update(Request $request, Template $template)
    {
        $data = $request->validate([
            'sections' => ['required', 'array', 'min:1'],
            'sections.*.key' => ['required', 'string'],
            'sections.*.label' => ['required', 'string'],
            'sections.*.numbering.style' => ['required', 'in:none,arabic,roman-lower,roman-upper,alpha'],
            'sections.*.numbering.reset_at_start' => ['required', 'boolean'],
            'sections.*.numbering.position' => [
                'required',
                'in:bottom-center,bottom-left,bottom-right,bottom-outer-alternating,top-center,top-left,top-right',
            ],
            'sections.*.numbering.show_on_first_page' => ['sometimes', 'boolean'],
        ]);

        $template->update([
            'page_numbering_config' => $data,
        ]);

        return response()->json($template->fresh());
    }

    public function show(Template $template)
    {
        return response()->json($template->page_numbering_config ?? ['sections' => []]);
    }
}
