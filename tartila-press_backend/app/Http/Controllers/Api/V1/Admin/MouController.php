<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Concerns\ValidatesMouContent;
use App\Http\Controllers\Api\V1\Mou\MyMouController;
use App\Http\Controllers\Controller;
use App\Models\Mou;
use App\Models\MouAddendum;
use App\Services\MouService;
use App\Services\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin: daftar MOU per judul, penyesuaian isi per judul, unduh MOU dengan
 * tanda tangan + stempel penerbit, unggah PDF bermeterai, adendum.
 */
class MouController extends Controller
{
    use ValidatesMouContent;

    public function __construct(
        private readonly MouService $service,
        private readonly Notifier $notifier,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['nullable', Rule::in(array_keys(Mou::STATUS_LABELS))],
            'type' => ['nullable', Rule::in([Mou::TYPE_REGULAR, Mou::TYPE_CHAPTER])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $page = Mou::with(['signatories.user:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->query('type')))
            ->when($request->filled('search'), fn ($query) => $query->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower((string) $request->query('search')).'%']))
            ->latest()
            ->orderByDesc('id')
            ->paginate($this->perPage($request, 20));

        $counts = Mou::selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return $this->pageResponse($page, 'Daftar MOU berhasil diambil.', fn (Mou $mou) => [
            'id' => $mou->id,
            'type' => $mou->type,
            'number' => $mou->number,
            'title' => $mou->title,
            'status' => $mou->status,
            'status_label' => Mou::STATUS_LABELS[$mou->status],
            'customized' => $mou->customized,
            'signed_count' => $mou->signatories->whereNotNull('signed_at')->count(),
            'signatories_count' => $mou->signatories->count(),
            'authors' => $mou->signatories->map(fn ($row) => $row->user?->name)->filter()->values(),
            'has_final' => $mou->final_pdf_path !== null,
            'created_at' => $mou->created_at?->toIso8601String(),
        ], meta: ['counts' => ['all' => $counts->sum()] + $counts->all()]);
    }

    public function show(Mou $mou): JsonResponse
    {
        return $this->respond($this->service->sync($mou), 'MOU berhasil diambil.');
    }

    /** Sesuaikan isi MOU judul ini (tidak mengubah template utama). */
    public function update(Request $request, Mou $mou): JsonResponse
    {
        $validated = $this->validatedMouContent($request, [
            'royalty_types' => ['required', 'array'],
            'royalty_types.physical' => ['required', 'boolean'],
            'royalty_types.ebook' => ['required', 'boolean'],
            'royalty_pool' => ['required', 'array'],
            'royalty_pool.physical' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'royalty_pool.ebook' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'royalties' => ['required', 'array'],
            'royalties.*.user_id' => ['required', 'integer'],
            'royalties.*.physical' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'royalties.*.ebook' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'distribution_choice' => ['nullable', 'array'],
            'distribution_choice.*' => ['string'],
            'reset_signatures' => ['sometimes', 'boolean'],
        ]);

        $userIds = $mou->signatories()->pluck('user_id')->all();
        $royalties = collect($validated['royalties'])->keyBy('user_id');

        abort_unless($royalties->keys()->diff($userIds)->isEmpty(), 422, 'Daftar penulis tidak sesuai.');

        foreach (['physical', 'ebook'] as $type) {
            abort_if(
                $validated['royalty_types'][$type] && $royalties->sum(fn ($row) => (float) ($row[$type] ?? 0)) > 100,
                422,
                'Total royalti '.($type === 'physical' ? 'buku fisik' : 'ebook').' tidak boleh lebih dari 100%.'
            );
        }

        $keys = array_column($validated['distribution_options'], 'key');
        $choice = $validated['distribution_mode'] === 'one'
            ? array_values(array_intersect((array) ($validated['distribution_choice'] ?? []), $keys))
            : $keys;

        abort_if($validated['distribution_mode'] === 'one' && count($choice) > 1, 422, 'Pilih satu hak distribusi.');

        $content = collect($validated)->only(['title', 'opening', 'distribution_options', 'distribution_mode', 'first_party_terms', 'second_party_terms', 'closing_terms', 'contact_note'])->all();
        $content['royalty_types'] = $validated['royalty_types'];
        $content['royalty'] = [
            'physical' => $validated['royalty_types']['physical'] ? (float) ($validated['royalty_pool']['physical'] ?? 0) : null,
            'ebook' => $validated['royalty_types']['ebook'] ? (float) ($validated['royalty_pool']['ebook'] ?? 0) : null,
        ];

        $mou = $this->service->customize(
            $mou,
            $content,
            $royalties->map(fn ($row) => ['physical' => (float) ($row['physical'] ?? 0), 'ebook' => (float) ($row['ebook'] ?? 0)])->all(),
            $choice === [] ? null : $choice,
            $request->boolean('reset_signatures'),
            $request->user()
        );

        return $this->respond($mou, 'Isi MOU judul ini disimpan.');
    }

    public function resetToTemplate(Mou $mou): JsonResponse
    {
        return $this->respond($this->service->resetToTemplate($mou), 'MOU kembali mengikuti template utama.');
    }

    /** MOU dengan tanda tangan + stempel penerbit, untuk diberi meterai. */
    public function sealedPdf(Request $request, Mou $mou): Response
    {
        abort_unless($mou->isBinding() || $request->boolean('inline'), 422, 'Semua penulis harus menandatangani MOU dulu.');

        return MyMouController::pdfResponse(
            $this->service->pdf($mou, sealed: $mou->isBinding()),
            'MOU '.$mou->title.'.pdf',
            $request->boolean('inline')
        );
    }

    /** Unggah PDF MOU yang sudah ditandatangani, distempel dan bermeterai. */
    public function uploadFinal(Request $request, Mou $mou): JsonResponse
    {
        abort_unless($mou->isBinding(), 422, 'Semua penulis harus menandatangani MOU dulu.');

        $request->validate(['file' => ['required', 'file', 'mimes:pdf', 'max:10240']]);

        $old = $mou->final_pdf_path;
        $file = $request->file('file');
        $path = $file->storeAs('mou/final/'.$mou->id, Str::random(24).'.pdf', 'local');

        $mou->update([
            'final_pdf_path' => $path,
            'final_pdf_name' => Str::limit($file->getClientOriginalName(), 200, ''),
            'final_uploaded_at' => now(),
            'status' => Mou::STATUS_COMPLETED,
            'updated_by' => $request->user()->id,
        ]);

        if ($old && $old !== $path) {
            Storage::disk('local')->delete($old);
        }

        $this->notifier->guard(fn () => $this->notifier->notify(
            $mou->signatories()->with('user')->get()->pluck('user')->filter(),
            'mou',
            'MOU bermeterai sudah tersedia',
            $mou->title,
            "/dashboard/mou/{$mou->id}",
            ['subject_type' => 'mou', 'subject_id' => $mou->id, 'email' => true, 'email_lines' => [
                "MOU distribusi buku \"{$mou->title}\" sudah ditandatangani penerbit dan bermeterai.",
                'Buka menu Royalti Saya untuk melihat atau mengunduhnya.',
            ]]
        ));

        return $this->respond($mou->fresh(), 'PDF MOU bermeterai diunggah dan bisa dibuka penulis.');
    }

    public function finalPdf(Request $request, Mou $mou): Response
    {
        abort_unless($mou->final_pdf_path, 404, 'PDF bermeterai belum diunggah.');

        return MyMouController::fileResponse($mou->final_pdf_path, 'MOU '.$mou->title.' (bermeterai).pdf', $request->boolean('inline'));
    }

    public function deleteFinal(Mou $mou): JsonResponse
    {
        if ($mou->final_pdf_path) {
            Storage::disk('local')->delete($mou->final_pdf_path);
        }

        $mou->update([
            'final_pdf_path' => null,
            'final_pdf_name' => null,
            'final_uploaded_at' => null,
            'status' => $mou->isBinding() ? Mou::STATUS_SIGNED : $mou->status,
        ]);

        return $this->respond($mou->fresh(), 'PDF bermeterai dihapus.');
    }

    /** Adendum yang sudah disepakati kedua pihak (PDF). */
    public function storeAddendum(Request $request, Mou $mou): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'note' => ['nullable', 'string', 'max:2000'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ]);

        $file = $request->file('file');

        $mou->addenda()->create([
            'title' => $validated['title'],
            'note' => $validated['note'] ?? null,
            'file_path' => $file->storeAs('mou/addenda/'.$mou->id, Str::random(24).'.pdf', 'local'),
            'file_name' => Str::limit($file->getClientOriginalName(), 200, ''),
            'created_by' => $request->user()->id,
        ]);

        $this->notifier->guard(fn () => $this->notifier->notify(
            $mou->signatories()->with('user')->get()->pluck('user')->filter(),
            'mou',
            'Adendum MOU ditambahkan',
            $mou->title.' — '.$validated['title'],
            "/dashboard/mou/{$mou->id}",
            ['subject_type' => 'mou', 'subject_id' => $mou->id, 'email' => true]
        ));

        return $this->respond($mou->fresh(), 'Adendum ditambahkan.');
    }

    public function addendum(Request $request, Mou $mou, MouAddendum $addendum): Response
    {
        abort_unless($addendum->mou_id === $mou->id, 404);

        return MyMouController::fileResponse($addendum->file_path, $addendum->file_name, $request->boolean('inline'));
    }

    public function destroyAddendum(Mou $mou, MouAddendum $addendum): JsonResponse
    {
        abort_unless($addendum->mou_id === $mou->id, 404);

        Storage::disk('local')->delete($addendum->file_path);
        $addendum->delete();

        return $this->respond($mou->fresh(), 'Adendum dihapus.');
    }

    private function respond(Mou $mou, string $message): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $this->service->present($mou, null, admin: true),
        ]);
    }
}
