<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Concerns\ValidatesMouContent;
use App\Http\Controllers\Api\V1\Mou\MyMouController;
use App\Http\Controllers\Controller;
use App\Models\Mou;
use App\Models\MouSignatory;
use App\Models\MouTemplate;
use App\Models\User;
use App\Services\MouService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Template MOU distribusi buku per kategori (paket biasa / Book Chapter):
 * hak distribusi, royalti maksimal buku fisik & ebook, hak dan tanggung
 * jawab kedua pihak. Perubahan berlaku maju.
 */
class MouTemplateController extends Controller
{
    use ValidatesMouContent;

    public function __construct(private readonly MouService $service) {}

    public function show(string $category): JsonResponse
    {
        abort_unless(in_array($category, MouTemplate::CATEGORIES, true), 404);

        return response()->json([
            'success' => true,
            'message' => 'Template MOU berhasil diambil.',
            'data' => MouTemplate::current($category),
        ]);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        abort_unless(in_array($category, MouTemplate::CATEGORIES, true), 404);

        $validated = $this->validatedMouContent($request, [
            'physical_royalty' => ['required', 'numeric', 'min:0', 'max:100'],
            'ebook_royalty' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $template = MouTemplate::current($category);
        $template->update($validated + ['updated_by' => $request->user()->id]);

        return response()->json([
            'success' => true,
            'message' => 'Template MOU disimpan. Berlaku untuk MOU yang belum ditandatangani.',
            'data' => $template->fresh(),
        ]);
    }

    public function reset(Request $request, string $category): JsonResponse
    {
        abort_unless(in_array($category, MouTemplate::CATEGORIES, true), 404);

        $template = MouTemplate::current($category);
        $template->update(MouTemplate::defaults($category) + ['updated_by' => $request->user()->id]);

        return response()->json(['success' => true, 'message' => 'Template MOU dikembalikan ke isi bawaan.', 'data' => $template->fresh()]);
    }

    /** Contoh PDF dengan dua penulis fiktif. */
    public function preview(Request $request, string $category): Response
    {
        abort_unless(in_array($category, MouTemplate::CATEGORIES, true), 404);

        $template = MouTemplate::current($category);
        $content = $template->snapshot();
        $content['royalty_types'] = ['physical' => true, 'ebook' => true];

        $mou = new Mou([
            'type' => $category,
            'number' => '000/MOU/TP/PRATINJAU',
            'title' => 'Judul Buku Contoh',
            'content' => $content,
            'distribution_choice' => array_column($content['distribution_options'], 'key'),
            'status' => Mou::STATUS_PENDING,
        ]);
        $mou->created_at = now();

        $mou->setRelation('signatories', collect([1, 2])->map(function (int $position) use ($content, $category) {
            $row = new MouSignatory([
                'position' => $position,
                'royalty_physical' => $content['royalty']['physical'] / 2,
                'royalty_ebook' => $content['royalty']['ebook'] / 2,
                'chapters' => $category === 'chapter' ? 1 : null,
            ]);

            return $row->setRelation('user', new User(['name' => "Nama Penulis {$position}"]));
        }));

        return MyMouController::pdfResponse(
            $this->service->pdf($mou, sealed: true),
            'pratinjau-mou-'.$category.'.pdf',
            true
        );
    }
}
