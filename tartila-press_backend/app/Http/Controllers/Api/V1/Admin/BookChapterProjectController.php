<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Concerns\HasBookChapterOptionRules;
use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookCategory;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Models\EditorProfile;
use App\Models\FieldCategory;
use App\Models\User;
use App\Services\BookChapterCostGuard;
use App\Services\BookChapterProjectService;
use App\Services\MouService;
use App\Support\BookChapterPromo;
use App\Support\Languages;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookChapterProjectController extends Controller
{
    use HasBookChapterOptionRules;

    private const PROJECT_FIELD_RULES = [
        'book_category_id' => ['nullable', 'integer', 'exists:book_categories,id'],
        'field_category_id' => ['nullable', 'integer', 'exists:field_categories,id'],
        'price' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
        'description' => ['nullable', 'string'],
        'about' => ['nullable', 'string'],
        'facilities' => ['nullable', 'array'],
        'facilities.*' => ['string', 'max:255'],
        'services' => ['nullable', 'array'],
        'services.*' => ['string', 'max:255'],
        'front_cover' => ['nullable', 'string', 'max:500', 'http_url'],
        'back_cover' => ['nullable', 'string', 'max:500', 'http_url'],
        'estimated_publish_date' => ['nullable', 'date'],
        'submission_deadline' => ['nullable', 'date'],
        'owner_editor_id' => ['nullable', 'integer'],
    ];

    private const CHAPTER_RULES = [
        'chapters' => ['required', 'array', 'min:1'],
        'chapters.*.title' => ['required', 'string', 'max:255'],
        'chapters.*.price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'chapters.*.discount' => ['nullable', 'integer', 'min:0', 'max:100'],
        'chapters.*.sop_terms' => ['nullable', 'string'],
    ];

    public function __construct(
        private readonly BookChapterProjectService $service,
        private readonly BookChapterCostGuard $costGuard,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Semua proyek Book Chapter
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?search= (judul/editor pemilik).
        $query = Book::with(['category', 'fieldCategory', 'ownerEditor', 'chapters.manuscript.user', 'packageItems'])
            ->where('is_chapter_offering', true)
            ->latest()
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower((string) $request->query('search')).'%';

            $query->where(fn ($q) => $q->whereRaw('LOWER(title) LIKE ?', [$term])
                ->orWhereHas('ownerEditor', fn ($editor) => $editor->whereRaw('LOWER(name) LIKE ?', [$term])));
        }

        $projects = $query->paginate($this->perPage($request, 20));

        $settings = BookChapterSetting::current();
        $projects->getCollection()->each(fn (Book $project) => $this->service->withCostSummary($project, $settings));

        return $this->pageResponse($projects, 'Daftar proyek Book Chapter berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | Show
    |--------------------------------------------------------------------------
    */

    /** Data poster promosi sosmed (selalu data terbaru). */
    public function promo(Book $bookChapterProject): JsonResponse
    {
        abort_unless($bookChapterProject->is_chapter_offering, 404, 'Proyek Book Chapter tidak ditemukan.');

        return response()->json([
            'success' => true,
            'message' => 'Data promosi proyek berhasil diambil.',
            'data' => BookChapterPromo::present($bookChapterProject),
        ]);
    }

    public function show(Book $bookChapterProject): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Detail proyek Book Chapter berhasil diambil.',
            'data' => $this->service->withCostSummary($bookChapterProject->load([
                'category', 'fieldCategory', 'ownerEditor', 'chapters.manuscript.user', 'packageItems',
            ])),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Admin membuat proyek Book Chapter (tanpa batasan)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            ...self::PROJECT_FIELD_RULES,
            ...self::CHAPTER_RULES,
            ...$this->bookChapterOptionRules(creating: true),
            ...Languages::rules(),
        ]);
        $validated = $this->normalizeIsbnType($validated);

        $ownerEditorId = $this->resolveOwnerEditorId($validated['owner_editor_id'] ?? null);

        // Admin tidak dibatasi saat membuat proyek; respons memuat
        // cost_summary supaya kekurangan biaya minimal bisa diperingatkan.
        $book = $this->service->createProject(
            data: collect($validated)->except(['chapters', 'owner_editor_id', 'package_item_ids'])->toArray(),
            creatorId: $request->user()->id,
            isEditorCreated: false,
            ownerEditorId: $ownerEditorId,
            chapters: $validated['chapters'],
            packageItemIds: $validated['package_item_ids'] ?? [],
        );

        return response()->json([
            'success' => true,
            'message' => 'Proyek Book Chapter berhasil dibuat.',
            'data' => $this->service->withCostSummary($book),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Book $bookChapterProject): JsonResponse
    {
        $rules = [
            ...self::PROJECT_FIELD_RULES,
            ...$this->bookChapterOptionRules(),
            ...Languages::rules(),
        ];
        $rules['price'] = ['sometimes', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT];
        $rules['title'] = ['sometimes', 'required', 'string', 'max:255'];
        $rules['is_active'] = ['sometimes', 'boolean'];

        $validated = $this->normalizeIsbnType($request->validate($rules));

        if (array_key_exists('owner_editor_id', $validated)) {
            $validated['owner_editor_id'] = $this->resolveOwnerEditorId($validated['owner_editor_id']);
        }

        // Perubahan harga/diskon/HKI/ISBN/fasilitas tidak boleh membuat sisa
        // biaya 1 buku di bawah minimal (admin pun terikat).
        $this->costGuard->assertProjectChangeAllowed($bookChapterProject, $validated, BookChapterSetting::current());

        if (! empty($validated['is_active'])) {
            app(MouService::class)->assertCanPublishChapterBook($bookChapterProject);
        }

        DB::transaction(function () use ($bookChapterProject, $validated) {
            $bookChapterProject->update(collect($validated)->except('package_item_ids')->toArray());

            if (array_key_exists('package_item_ids', $validated)) {
                $this->service->syncPackageItems($bookChapterProject, $validated['package_item_ids']);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Proyek Book Chapter berhasil diperbarui.',
            'data' => $this->service->withCostSummary(
                $bookChapterProject->fresh(['category', 'fieldCategory', 'ownerEditor', 'chapters', 'packageItems'])
            ),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy
    |--------------------------------------------------------------------------
    */

    public function destroy(Book $bookChapterProject): JsonResponse
    {
        abort_if(
            $bookChapterProject->chapters()->whereNotNull('manuscript_id')->exists(),
            422,
            'Ada bab yang sudah terisi naskah, proyek tidak bisa dihapus.'
        );

        $bookChapterProject->delete();

        return response()->json([
            'success' => true,
            'message' => 'Proyek Book Chapter berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Chapter - Tambah/Ubah/Hapus
    |--------------------------------------------------------------------------
    */

    public function storeChapter(Request $request, Book $bookChapterProject): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
            'sop_terms' => ['nullable', 'string'],
        ]);

        $chapter = $this->service->addChapter($bookChapterProject, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Bab berhasil ditambahkan.',
            'data' => $chapter,
        ], 201);
    }

    public function updateChapter(Request $request, BookChapter $chapter): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
            'sop_terms' => ['nullable', 'string'],
        ]);

        $this->costGuard->assertChapterChangeAllowed($chapter, $validated, BookChapterSetting::current());

        $chapter = $this->service->updateChapter($chapter, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Bab berhasil diperbarui.',
            'data' => $chapter,
        ]);
    }

    public function destroyChapter(BookChapter $chapter): JsonResponse
    {
        $this->service->assertChapterDeletable($chapter);

        // Sisa biaya 1 buku setelah bab dihapus tidak boleh di bawah minimal.
        $this->costGuard->assertChapterDeleteAllowed($chapter, BookChapterSetting::current());

        $this->service->deleteChapter($chapter);

        return response()->json([
            'success' => true,
            'message' => 'Bab berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Bulk Import - Admin membuat banyak proyek sekaligus dari CSV
    |--------------------------------------------------------------------------
    */

    public function bulkImport(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = array_map(
            fn ($column) => strtolower(trim((string) $column)),
            fgetcsv($handle) ?: []
        );

        $created = 0;
        $errors = [];
        $rowNumber = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;

            try {
                $data = array_combine($header, array_pad($row, count($header), null));
                $this->createFromCsvRow($data, $request->user()->id);
                $created++;
            } catch (\Throwable $e) {
                $errors[] = ['row' => $rowNumber, 'message' => $e->getMessage()];
            }
        }

        fclose($handle);

        return response()->json([
            'success' => true,
            'message' => 'Import CSV selesai diproses.',
            'data' => ['created' => $created, 'errors' => $errors],
        ]);
    }

    /**
     * @param  array<string, string|null>  $row
     */
    private function createFromCsvRow(array $row, int $creatorId): void
    {
        $title = trim((string) ($row['title'] ?? ''));

        abort_if($title === '', 422, 'Kolom title wajib diisi.');

        $chapterCount = (int) ($row['chapter_count'] ?? 0);

        if ($chapterCount < 1) {
            $chapterCount = 1;
        }

        $chapters = [];

        for ($i = 1; $i <= $chapterCount; $i++) {
            $chapters[] = ['title' => "Bab {$i}"];
        }

        $price = (float) ($row['price'] ?? 0);

        abort_if(
            $price < 0 || $price > self::MAX_MONEY_AMOUNT,
            422,
            'Kolom price tidak valid atau melebihi batas maksimal.'
        );

        $frontCover = $this->blankToNull($row, 'front_cover');

        abort_if(
            $frontCover !== null && (! filter_var($frontCover, FILTER_VALIDATE_URL) || ! preg_match('#^https?://#i', $frontCover)),
            422,
            'Kolom front_cover harus berupa tautan http/https.'
        );

        // Kolom `languages` (opsional): kode bahasa dipisah ";" atau "|", mis. id;en.
        $languages = Languages::parseDelimited($row['languages'] ?? null);

        abort_if(
            $languages['unknown'] !== [],
            422,
            'Kolom languages berisi kode bahasa yang tidak dikenal: '.implode(', ', $languages['unknown']).'.'
        );

        $ownerEditorId = null;

        if (! empty($row['owner_editor_email'])) {
            $user = User::where('email', trim($row['owner_editor_email']))->first();

            if ($user && EditorProfile::where('user_id', $user->id)->exists()) {
                $ownerEditorId = $user->id;
            }
        }

        $this->service->createProject(
            data: [
                'title' => $title,
                'book_category_id' => $this->resolveExistingId(BookCategory::class, $row['book_category_id'] ?? null),
                'field_category_id' => $this->resolveExistingId(FieldCategory::class, $row['field_category_id'] ?? null),
                'price' => $price,
                'discount' => (int) ($row['discount'] ?? 0),
                'description' => $this->blankToNull($row, 'description'),
                'about' => $this->blankToNull($row, 'about'),
                'languages' => $languages['languages'],
                'estimated_publish_date' => $this->blankToNull($row, 'estimated_publish_date'),
                'submission_deadline' => $this->blankToNull($row, 'submission_deadline'),
                'front_cover' => $frontCover,
            ],
            creatorId: $creatorId,
            isEditorCreated: false,
            ownerEditorId: $ownerEditorId,
            chapters: $chapters,
        );
    }

    /**
     * @param  array<string, string|null>  $row
     */
    private function blankToNull(array $row, string $key): ?string
    {
        $value = trim((string) ($row[$key] ?? ''));

        return $value === '' ? null : $value;
    }

    private function resolveExistingId(string $modelClass, ?string $value): ?int
    {
        if (! $value || ! is_numeric($value)) {
            return null;
        }

        return $modelClass::whereKey((int) $value)->exists() ? (int) $value : null;
    }

    /*
    |--------------------------------------------------------------------------
    | Helper
    |--------------------------------------------------------------------------
    */

    private function resolveOwnerEditorId(?int $ownerEditorId): ?int
    {
        if (! $ownerEditorId) {
            return null;
        }

        abort_unless(
            EditorProfile::where('user_id', $ownerEditorId)->exists(),
            422,
            'User yang dipilih bukan Editor.'
        );

        return $ownerEditorId;
    }
}
