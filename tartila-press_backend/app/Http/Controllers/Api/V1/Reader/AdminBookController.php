<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderTerm;
use App\Services\Reader\ReaderPresenter;
use App\Support\Languages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admin Tartila Book: buku di katalog baca (klasifikasi, harga). Ebook-nya diambil dari Tartila Press. */
class AdminBookController extends Controller
{
    public function __construct(private readonly ReaderPresenter $presenter) {}

    public function index(Request $request): JsonResponse
    {
        $page = ReaderBook::with(ReaderPresenter::RELATIONS)
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.mb_strtolower((string) $request->query('search')).'%';
                $query->whereHas('book', fn ($book) => $book->whereRaw('LOWER(title) LIKE ?', [$term]));
            })
            ->when($request->filled('published'), fn ($q) => $q->where('is_published', $request->query('published') === '1'))
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        return $this->pageResponse($page, 'Daftar buku Tartila Book berhasil diambil.', fn (ReaderBook $rb) => $this->row($rb));
    }

    /** Buku terbit di Tartila Press yang sudah punya ebook PDF dan belum ada di Tartila Book. */
    public function candidates(Request $request): JsonResponse
    {
        $books = Book::where('is_active', true)
            ->whereNotNull('ebook_file')
            ->where('ebook_file', 'like', '%.pdf')
            ->where('ebook_pages', '>', 0)
            ->whereDoesntHave('readerBook')
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.mb_strtolower((string) $request->query('search')).'%';
                $query->whereRaw('LOWER(title) LIKE ?', [$term]);
            })
            ->latest('id')->limit(30)->get(['id', 'title', 'authors_text', 'front_cover', 'languages']);

        return response()->json([
            'success' => true,
            'message' => 'Buku yang bisa ditambahkan berhasil diambil.',
            'data' => $books->map(fn (Book $b) => [
                'id' => $b->id,
                'title' => $b->title,
                'authors' => $b->authors_text,
                'cover' => $b->front_cover,
                'language' => collect($b->languages)->first(),
            ])->values(),
        ]);
    }

    public function show(ReaderBook $readerBook): JsonResponse
    {
        return response()->json(['success' => true, 'message' => 'Buku berhasil diambil.', 'data' => $this->row($readerBook)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'book_id' => ['required', 'integer', Rule::exists('books', 'id')->where('is_active', true), Rule::unique('reader_books', 'book_id')],
            ...$this->fieldRules(),
        ], ['book_id.unique' => 'Buku ini sudah ada di Tartila Book.', 'book_id.exists' => 'Pilih buku yang sudah terbit.']);

        $this->checkTerms($validated);

        $readerBook = ReaderBook::create($validated + ['is_published' => false]);

        return response()->json(['success' => true, 'message' => 'Buku ditambahkan. Ebook-nya diambil dari Tartila Press.', 'data' => $this->row($readerBook->fresh())], 201);
    }

    public function update(Request $request, ReaderBook $readerBook): JsonResponse
    {
        $validated = $request->validate($this->fieldRules());
        $this->checkTerms($validated + $readerBook->only(['pustaka']));

        abort_if(
            ($validated['is_published'] ?? false) && ! $readerBook->hasFile(),
            422,
            'Buku ini belum punya ebook PDF di Tartila Press. Unggah dulu di Admin > Buku (Tartila Press).'
        );

        // Ebook mitra tampil hanya lewat persetujuan di menu Mitra.
        abort_if(
            ($validated['is_published'] ?? false) && $readerBook->book?->isPartnerBook() && $readerBook->book->partner_status !== 'approved',
            422,
            'Ebook mitra hanya tampil setelah disetujui di menu Mitra.'
        );

        $readerBook->update($validated);

        return response()->json(['success' => true, 'message' => 'Buku diperbarui.', 'data' => $this->row($readerBook->fresh())]);
    }

    public function destroy(ReaderBook $readerBook): JsonResponse
    {
        abort_if($readerBook->book?->isPartnerBook(), 422, 'Buku mitra dikelola mitra yang bersangkutan (menu Mitra).');

        // Ebook milik buku di Tartila Press, jadi berkasnya tidak ikut dihapus.
        $readerBook->delete();

        return response()->json(['success' => true, 'message' => 'Buku dihapus dari Tartila Book.']);
    }

    /** @return array<string, mixed> */
    private function fieldRules(): array
    {
        return [
            'is_published' => ['sometimes', 'boolean'],
            'pustaka' => ['sometimes', Rule::in(array_keys(ReaderBook::PUSTAKA))],
            'education_field_id' => ['sometimes', 'nullable', 'integer'],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'genre_id' => ['sometimes', 'nullable', 'integer'],
            'age_limit' => ['sometimes', Rule::in(array_keys(ReaderBook::AGE_LIMITS))],
            'language' => ['sometimes', Rule::in(Languages::CODES)],
            'price' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100000000'],
            'access_days' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:36500'],
            'purchase_royalty_percent' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'read_fee' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:1000000'],
        ];
    }

    /** Taksonomi harus sesuai jenisnya (dan kategori sesuai jenis pustaka). @param array<string, mixed> $data */
    private function checkTerms(array $data): void
    {
        foreach (['education_field_id' => 'education_field', 'category_id' => 'category', 'genre_id' => 'genre'] as $field => $type) {
            if (empty($data[$field])) {
                continue;
            }

            $term = ReaderTerm::where('type', $type)->find($data[$field]);
            abort_unless($term, 422, 'Pilihan '.ReaderTerm::TYPES[$type].' tidak valid.');

            if ($type === 'category' && $term->pustaka && isset($data['pustaka']) && $term->pustaka !== $data['pustaka']) {
                abort(422, 'Kategori buku ini tidak berlaku untuk jenis pustaka yang dipilih.');
            }
        }
    }

    /** @return array<string, mixed> */
    private function row(ReaderBook $readerBook): array
    {
        $readerBook->loadMissing(ReaderPresenter::RELATIONS);

        return [
            ...$this->presenter->many(collect([$readerBook]))->first(),
            'book_id' => $readerBook->book_id,
            'is_published' => $readerBook->is_published,
            'has_file' => $readerBook->hasFile(),
            'file_name' => $readerBook->file_name,
            'file_size' => $readerBook->file_size,
            'education_field_id' => $readerBook->education_field_id,
            'category_id' => $readerBook->category_id,
            'genre_id' => $readerBook->genre_id,
            'purchase_royalty_percent' => $readerBook->purchase_royalty_percent,
            'read_fee' => $readerBook->read_fee,
            'read_events' => $readerBook->read_events,
            'book_active' => (bool) $readerBook->book?->is_active,
            'partner' => $readerBook->book?->isPartnerBook() ? $readerBook->book->partner?->company_name : null,
        ];
    }
}
