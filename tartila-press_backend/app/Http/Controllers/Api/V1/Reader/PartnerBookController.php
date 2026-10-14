<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Partner;
use App\Models\PartnerBookEvent;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderTerm;
use App\Services\Reader\PartnerBookService;
use App\Services\Reader\ReaderRoyaltyService;
use App\Support\Languages;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/** Dashboard mitra Tartila Book: buku mitra sendiri (data, ebook, dokumen), pengajuan, dan laporan bagi hasil. */
class PartnerBookController extends Controller
{
    // Sama dengan batas unggah ebook Tartila Press.
    private const MAX_EBOOK_KB = 204800;

    public function __construct(
        private readonly PartnerBookService $service,
        private readonly ReaderRoyaltyService $royalty,
    ) {}

    public function terms(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pilihan klasifikasi berhasil diambil.',
            'data' => ReaderTerm::orderBy('name')->get(['id', 'type', 'name', 'pustaka']),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $partner = $this->partner($request);

        $books = PartnerBookService::query()
            ->where('partner_id', $partner->id)
            ->with(['readerBook', 'partnerAuthors', 'partner.user'])
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar buku mitra berhasil diambil.',
            'data' => $books->map(fn (Book $book) => self::row($book, $this->service))->values(),
            'meta' => ['company_name' => $partner->company_name],
        ]);
    }

    public function show(Request $request, int $bookId): JsonResponse
    {
        $book = $this->ownBook($request, $bookId);

        return response()->json(['success' => true, 'message' => 'Buku berhasil diambil.', 'data' => self::row($book, $this->service, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $partner = $this->partner($request);

        $book = $this->service->create($partner, $request->validate($this->rules(true)));

        return response()->json(['success' => true, 'message' => 'Draft buku dibuat. Lengkapi ebook dan dokumennya.', 'data' => self::row($book, $this->service, true)], 201);
    }

    public function update(Request $request, int $bookId): JsonResponse
    {
        $book = $this->ownBook($request, $bookId);

        $book = $this->service->update($book, $request->validate($this->rules(false)));

        return response()->json(['success' => true, 'message' => 'Buku disimpan.', 'data' => self::row($book, $this->service, true)]);
    }

    public function destroy(Request $request, int $bookId): JsonResponse
    {
        $this->service->delete($this->ownBook($request, $bookId));

        return response()->json(['success' => true, 'message' => 'Draft dihapus.']);
    }

    public function ebook(Request $request, int $bookId): JsonResponse
    {
        $book = $this->ownBook($request, $bookId);

        $validated = $request->validate([
            'file' => ['required', 'file', 'extensions:pdf', 'mimetypes:application/pdf', 'max:'.self::MAX_EBOOK_KB],
            'page_count' => ['nullable', 'integer', 'min:1', 'max:20000'],
        ], [
            'file.extensions' => 'Ebook harus berupa PDF.',
            'file.mimetypes' => 'Ebook harus berupa PDF.',
            'file.max' => 'Ukuran ebook maksimal 200 MB.',
        ]);

        $this->service->storeEbook($book, $validated['file'], $validated['page_count'] ?? null);

        return response()->json(['success' => true, 'message' => 'Ebook diunggah.', 'data' => self::row(PartnerBookService::find($book->id), $this->service, true)]);
    }

    public function document(Request $request, int $bookId, string $kind): JsonResponse
    {
        $book = $this->ownBook($request, $bookId);

        $validated = $request->validate([
            'file' => ['required', 'file', 'extensions:pdf,jpg,jpeg,png', 'mimetypes:application/pdf,image/jpeg,image/png', 'max:10240'],
            'percent' => [$kind === 'turnitin' ? 'required' : 'nullable', 'numeric', 'min:0', 'max:100'],
        ], [
            'file.extensions' => 'Berkas harus berupa PDF, JPG, atau PNG.',
            'file.mimetypes' => 'Berkas harus berupa PDF, JPG, atau PNG.',
            'file.max' => 'Ukuran berkas maksimal 10 MB.',
            'percent.required' => 'Isi persentase kemiripan dari hasil Turnitin.',
        ]);

        $this->service->storeDocument($book, $kind, $validated['file'], isset($validated['percent']) ? (float) $validated['percent'] : null);

        return response()->json(['success' => true, 'message' => PartnerBookService::DOCUMENTS[$kind].' diunggah.', 'data' => self::row(PartnerBookService::find($book->id), $this->service, true)]);
    }

    public function download(Request $request, int $bookId, string $kind): Response
    {
        return self::fileResponse($this->service, $this->ownBook($request, $bookId), $kind);
    }

    public function submit(Request $request, int $bookId): JsonResponse
    {
        $book = $this->service->submit($this->ownBook($request, $bookId), $request->user());

        return response()->json(['success' => true, 'message' => 'Buku diajukan ke admin untuk disetujui.', 'data' => self::row($book, $this->service, true)]);
    }

    public function reopen(Request $request, int $bookId): JsonResponse
    {
        $book = $this->service->reopen($this->ownBook($request, $bookId), $request->user());

        return response()->json(['success' => true, 'message' => 'Buku ditarik kembali ke draft untuk direvisi.', 'data' => self::row($book, $this->service, true)]);
    }

    /** Laporan bagi hasil mitra: bagian mitra (30% pembelian, 15% bacaan) per buku pada rentang tanggal. */
    public function report(Request $request): JsonResponse
    {
        $partner = $this->partner($request);

        $validated = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d']]);
        $to = $validated['to'] ?? Carbon::now('Asia/Jakarta')->toDateString();
        $from = $validated['from'] ?? Carbon::parse($to, 'Asia/Jakarta')->subDays(29)->toDateString();

        $ids = PartnerBookService::query()->where('partner_id', $partner->id)->where('partner_status', 'approved')->pluck('id')->all();

        $rows = $ids === [] ? collect() : $this->royalty->report($from, $to, null, $ids);

        $rows = $rows->map(function (array $row) use ($partner) {
            $mine = collect($row['authors'])->firstWhere('user_id', $partner->user_id);
            $row['my_amount'] = (float) ($mine['amount'] ?? 0);

            return $row;
        })->values();

        return response()->json([
            'success' => true,
            'message' => 'Laporan bagi hasil berhasil diambil.',
            'data' => [
                'from' => $from,
                'to' => $to,
                'rows' => $rows,
                'total' => round($rows->sum('my_amount'), 2),
            ],
        ]);
    }

    // ------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function rules(bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'about' => ['nullable', 'string', 'max:10000'],
            'front_cover' => ['nullable', 'string', 'max:500', 'http_url'],
            'author_ids' => [$required, 'array', 'min:1', 'max:10'],
            'author_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'pustaka' => [$required, Rule::in(array_keys(ReaderBook::PUSTAKA))],
            'education_field_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'genre_id' => ['nullable', 'integer'],
            'age_limit' => ['sometimes', Rule::in(array_keys(ReaderBook::AGE_LIMITS))],
            'language' => [$required, Rule::in(Languages::CODES)],
            'price' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'access_days' => ['nullable', 'integer', 'min:1', 'max:36500'],
        ];
    }

    private function partner(Request $request): Partner
    {
        $partner = $request->user()->partner;

        abort_unless($partner && $partner->is_active, 403, 'Akun mitra Anda tidak aktif. Hubungi admin Tartila Book.');

        return $partner;
    }

    private function ownBook(Request $request, int $bookId): Book
    {
        $book = PartnerBookService::find($bookId);

        abort_unless($book->partner_id === $this->partner($request)->id, 404, 'Buku tidak ditemukan.');

        return $book;
    }

    /** Unduh berkas privat (ebook atau dokumen) sebagai lampiran. */
    public static function fileResponse(PartnerBookService $service, Book $book, string $kind): Response
    {
        $file = $service->documentPath($book, $kind);

        abort_unless($file && Storage::disk('local')->exists($file['path']), 404, 'Berkas belum ada.');

        return Storage::disk('local')->download($file['path'], $file['name'], ['Cache-Control' => 'private, no-store']);
    }

    /**
     * Bentuk buku mitra untuk respons (mitra dan admin).
     *
     * @return array<string, mixed>
     */
    public static function row(Book $book, PartnerBookService $service, bool $detail = false): array
    {
        $reader = $book->readerBook;
        $documents = (array) $book->partner_documents;

        $row = [
            'id' => $book->id,
            'title' => $book->title,
            'slug' => $book->slug,
            'description' => $book->description,
            'about' => $book->about,
            'front_cover' => $book->front_cover,
            'status' => $book->partner_status,
            'note' => $book->partner_note,
            'editable' => $service->isEditable($book),
            'submitted_at' => $book->partner_submitted_at?->toIso8601String(),
            'reviewed_at' => $book->partner_reviewed_at?->toIso8601String(),
            'partner' => $book->partner ? ['id' => $book->partner->id, 'company_name' => $book->partner->company_name, 'user_id' => $book->partner->user_id] : null,
            'authors' => $book->partnerAuthors->map(fn ($author) => ['id' => $author->id, 'name' => $author->name])->values(),
            'reader_book_id' => $reader?->id,
            'pustaka' => $reader?->pustaka,
            'education_field_id' => $reader?->education_field_id,
            'category_id' => $reader?->category_id,
            'genre_id' => $reader?->genre_id,
            'age_limit' => $reader?->age_limit,
            'language' => $reader?->language,
            'price' => $reader?->price,
            'access_days' => $reader?->access_days,
            'is_listed' => $reader ? ReaderBook::listed()->whereKey($reader->id)->exists() : false,
            'ebook' => [
                'has' => $book->hasEbook(),
                'name' => $book->ebook_name,
                'pages' => $book->ebook_pages,
                'uploaded_at' => $book->ebook_uploaded_at?->toIso8601String(),
            ],
            'documents' => collect(PartnerBookService::DOCUMENTS)->map(fn ($label, $kind) => isset($documents[$kind]['path']) ? [
                'label' => $label,
                'name' => $documents[$kind]['name'] ?? null,
                'percent' => $documents[$kind]['percent'] ?? null,
                'uploaded_at' => $documents[$kind]['uploaded_at'] ?? null,
            ] : null)->all(),
            'missing' => $service->missing($book),
        ];

        if ($detail) {
            $row['events'] = PartnerBookEvent::with('user:id,name')->where('book_id', $book->id)->orderByDesc('id')->get()->map(fn (PartnerBookEvent $event) => [
                'action' => $event->action,
                'note' => $event->note,
                'by' => $event->user?->name,
                'created_at' => $event->created_at?->toIso8601String(),
            ])->values();
        }

        return $row;
    }
}
