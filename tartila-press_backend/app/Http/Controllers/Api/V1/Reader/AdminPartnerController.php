<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Partner;
use App\Models\Role;
use App\Models\User;
use App\Services\Reader\PartnerBookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Admin Tartila Book: kelola mitra dan tinjau (setujui / tolak dengan catatan) ebook mitra. */
class AdminPartnerController extends Controller
{
    /** Role yang tidak boleh digabung dengan mitra (mitra di Tartila Press hanya pengguna biasa). */
    private const CONFLICTING_ROLES = ['penulis', 'editor', 'admin', 'owner'];

    public function __construct(private readonly PartnerBookService $service) {}

    // ------------------------------------------------------------ Mitra

    public function partners(): JsonResponse
    {
        $counts = PartnerBookService::query()
            ->selectRaw('partner_id, partner_status, COUNT(*) as total')
            ->groupBy('partner_id', 'partner_status')
            ->get()
            ->groupBy('partner_id');

        $rows = Partner::with('user:id,name,email')->orderBy('company_name')->get()->map(fn (Partner $partner) => [
            'id' => $partner->id,
            'user_id' => $partner->user_id,
            'name' => $partner->user?->name,
            'email' => $partner->user?->email,
            'company_name' => $partner->company_name,
            'phone' => $partner->phone,
            'address' => $partner->address,
            'is_active' => $partner->is_active,
            'books' => collect($counts->get($partner->id, []))->pluck('total', 'partner_status')->map(fn ($total) => (int) $total),
        ]);

        return response()->json(['success' => true, 'message' => 'Daftar mitra berhasil diambil.', 'data' => $rows->values()]);
    }

    public function storePartner(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id', 'unique:partners,user_id'],
            'company_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:2000'],
        ], ['user_id.unique' => 'Akun ini sudah menjadi mitra.']);

        $user = User::findOrFail($validated['user_id']);
        $conflict = $user->roles()->whereIn('name', self::CONFLICTING_ROLES)->pluck('display_name');

        abort_if(
            $conflict->isNotEmpty(),
            422,
            'Akun ini sudah punya role '.$conflict->implode(', ').'. Mitra harus akun tersendiri (di Tartila Press hanya bisa membeli buku fisik).'
        );

        $partner = Partner::create($validated + ['is_active' => true]);
        $user->roles()->syncWithoutDetaching([Role::firstWhere('name', 'mitra')->id]);

        return response()->json(['success' => true, 'message' => 'Mitra ditambahkan.', 'data' => $partner], 201);
    }

    public function updatePartner(Request $request, Partner $partner): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $partner->update($validated);

        return response()->json(['success' => true, 'message' => 'Mitra diperbarui.', 'data' => $partner]);
    }

    /** Cabut status mitra: role dicabut; hanya bila belum punya buku (kalau sudah, nonaktifkan saja). */
    public function destroyPartner(Partner $partner): JsonResponse
    {
        abort_if($partner->books()->exists(), 422, 'Mitra ini sudah punya buku. Nonaktifkan saja agar datanya tetap tersimpan.');

        $partner->user?->roles()->detach(Role::firstWhere('name', 'mitra')?->id);
        $partner->delete();

        return response()->json(['success' => true, 'message' => 'Mitra dihapus.']);
    }

    // ------------------------------------------------------------ Ebook mitra

    public function books(Request $request): JsonResponse
    {
        $page = PartnerBookService::query()
            ->with(['readerBook', 'partnerAuthors', 'partner.user'])
            ->when($request->filled('status'), fn ($query) => $query->where('partner_status', $request->query('status')))
            ->when($request->filled('partner_id'), fn ($query) => $query->where('partner_id', (int) $request->query('partner_id')))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.mb_strtolower((string) $request->query('search')).'%';
                $query->whereRaw('LOWER(title) LIKE ?', [$term]);
            })
            ->orderByRaw("CASE partner_status WHEN 'submitted' THEN 0 WHEN 'rejected' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END")
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        return $this->pageResponse($page, 'Daftar ebook mitra berhasil diambil.', fn (Book $book) => PartnerBookController::row($book, $this->service));
    }

    public function book(int $bookId): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Ebook mitra berhasil diambil.',
            'data' => PartnerBookController::row(PartnerBookService::find($bookId), $this->service, true),
        ]);
    }

    public function approve(Request $request, int $bookId): JsonResponse
    {
        $book = $this->service->approve(PartnerBookService::find($bookId), $request->user());

        return response()->json(['success' => true, 'message' => 'Ebook disetujui dan tampil di katalog.', 'data' => PartnerBookController::row($book, $this->service, true)]);
    }

    public function reject(Request $request, int $bookId): JsonResponse
    {
        $validated = $request->validate(['note' => ['required', 'string', 'min:3', 'max:2000']], ['note.required' => 'Tulis catatan agar mitra tahu apa yang harus diperbaiki.']);

        $book = $this->service->reject(PartnerBookService::find($bookId), $request->user(), $validated['note']);

        return response()->json(['success' => true, 'message' => 'Ebook ditolak dengan catatan. Mitra akan memperbaikinya.', 'data' => PartnerBookController::row($book, $this->service, true)]);
    }

    public function download(int $bookId, string $kind): Response
    {
        return PartnerBookController::fileResponse($this->service, PartnerBookService::find($bookId), $kind);
    }
}
