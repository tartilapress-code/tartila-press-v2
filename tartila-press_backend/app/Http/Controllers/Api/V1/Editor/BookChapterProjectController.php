<?php

namespace App\Http\Controllers\Api\V1\Editor;

use App\Http\Controllers\Api\V1\Concerns\HasBookChapterOptionRules;
use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\BookChapterSetting;
use App\Services\BookChapterCostGuard;
use App\Services\BookChapterLimitValidator;
use App\Services\BookChapterProjectService;
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
        'front_cover' => ['nullable', 'string', 'max:500'],
        'back_cover' => ['nullable', 'string', 'max:500'],
        'estimated_publish_date' => ['nullable', 'date'],
        'submission_deadline' => ['nullable', 'date'],
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
        private readonly BookChapterLimitValidator $limitValidator,
        private readonly BookChapterCostGuard $costGuard,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Proyek Book Chapter milik editor ini
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $this->ensureEligible($request->user());

        $projects = Book::with(['category', 'fieldCategory', 'chapters.manuscript.user', 'packageItems'])
            ->where('is_chapter_offering', true)
            ->where('created_by', $request->user()->id)
            ->where('is_editor_created', true)
            ->latest()
            ->get();

        $settings = BookChapterSetting::current();
        $projects->each(fn (Book $project) => $this->service->withCostSummary($project, $settings));

        return response()->json([
            'success' => true,
            'message' => 'Daftar proyek Book Chapter berhasil diambil.',
            'data' => $projects,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show
    |--------------------------------------------------------------------------
    */

    public function show(Request $request, Book $bookChapterProject): JsonResponse
    {
        $this->ensureOwner($request, $bookChapterProject);

        return response()->json([
            'success' => true,
            'message' => 'Detail proyek Book Chapter berhasil diambil.',
            'data' => $this->service->withCostSummary(
                $bookChapterProject->load(['category', 'fieldCategory', 'chapters.manuscript.user', 'packageItems'])
            ),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Editor membuat proyek sendiri (dibatasi settings admin)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->ensureEligible($user);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            ...self::PROJECT_FIELD_RULES,
            ...self::CHAPTER_RULES,
            ...$this->bookChapterOptionRules(),
            ...Languages::rules(),
        ]);

        $settings = BookChapterSetting::current();
        $packageItemIds = $validated['package_item_ids'] ?? [];

        $this->limitValidator->assertWithinLimits(
            $validated,
            $validated['chapters'],
            $settings
        );

        // Sisa biaya 1 buku (harga bab − HKI − ISBN − fasilitas/layanan) harus
        // memenuhi minimal yang ditetapkan admin.
        $this->costGuard->assertNewProjectMeetsMinimum(
            $validated,
            $validated['chapters'],
            $packageItemIds,
            $settings
        );

        $book = $this->service->createProject(
            data: collect($validated)->except(['chapters', 'package_item_ids'])->toArray(),
            creatorId: $user->id,
            isEditorCreated: true,
            ownerEditorId: $user->id,
            chapters: $validated['chapters'],
            packageItemIds: $packageItemIds,
        );

        return response()->json([
            'success' => true,
            'message' => 'Proyek Book Chapter berhasil dibuat.',
            'data' => $this->service->withCostSummary($book, $settings),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Editor mengubah field buku pada proyeknya sendiri
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Book $bookChapterProject): JsonResponse
    {
        $this->ensureOwner($request, $bookChapterProject);

        $rules = [
            ...self::PROJECT_FIELD_RULES,
            ...$this->bookChapterOptionRules(),
            ...Languages::rules(),
        ];
        $rules['price'] = ['sometimes', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT];
        $rules['title'] = ['sometimes', 'required', 'string', 'max:255'];

        $validated = $request->validate($rules);

        $settings = BookChapterSetting::current();

        if (array_key_exists('price', $validated) || array_key_exists('discount', $validated)) {
            $price = (float) ($validated['price'] ?? $bookChapterProject->price);
            $discount = (int) ($validated['discount'] ?? $bookChapterProject->discount);

            abort_if(
                $price < (float) $settings->min_price,
                422,
                "Harga buku minimal Rp {$settings->min_price}."
            );

            abort_if(
                $discount > $settings->max_discount,
                422,
                "Diskon buku maksimal {$settings->max_discount}%."
            );
        }

        // Perubahan harga/diskon/HKI/ISBN/fasilitas tidak boleh membuat sisa
        // biaya 1 buku di bawah minimal.
        $this->costGuard->assertProjectChangeAllowed($bookChapterProject, $validated, $settings);

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
                $bookChapterProject->fresh(['category', 'fieldCategory', 'chapters', 'packageItems']),
                $settings
            ),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Chapter - Tambah/Ubah/Hapus (terbatas pada proyek sendiri)
    |--------------------------------------------------------------------------
    */

    public function storeChapter(Request $request, Book $bookChapterProject): JsonResponse
    {
        $this->ensureOwner($request, $bookChapterProject);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
            'sop_terms' => ['nullable', 'string'],
        ]);

        $settings = BookChapterSetting::current();

        if ($settings->max_chapters) {
            abort_if(
                $bookChapterProject->chapters()->count() >= $settings->max_chapters,
                422,
                "Jumlah bab maksimal {$settings->max_chapters}."
            );
        }

        if (array_key_exists('price', $validated) && $validated['price'] !== null) {
            abort_if(
                (float) $validated['price'] < (float) $settings->min_price,
                422,
                "Harga bab tidak boleh di bawah Rp {$settings->min_price}."
            );
        }

        if (array_key_exists('discount', $validated) && $validated['discount'] !== null) {
            abort_if(
                (int) $validated['discount'] > $settings->max_discount,
                422,
                "Diskon bab tidak boleh di atas {$settings->max_discount}%."
            );
        }

        $chapter = $this->service->addChapter($bookChapterProject, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Bab berhasil ditambahkan.',
            'data' => $chapter,
        ], 201);
    }

    public function updateChapter(Request $request, BookChapter $chapter): JsonResponse
    {
        $this->ensureOwner($request, $chapter->book);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
            'discount' => ['nullable', 'integer', 'min:0', 'max:100'],
            'sop_terms' => ['nullable', 'string'],
        ]);

        $settings = BookChapterSetting::current();

        if (array_key_exists('price', $validated) && $validated['price'] !== null) {
            abort_if(
                (float) $validated['price'] < (float) $settings->min_price,
                422,
                "Harga bab tidak boleh di bawah Rp {$settings->min_price}."
            );
        }

        if (array_key_exists('discount', $validated) && $validated['discount'] !== null) {
            abort_if(
                (int) $validated['discount'] > $settings->max_discount,
                422,
                "Diskon bab tidak boleh di atas {$settings->max_discount}%."
            );
        }

        $this->costGuard->assertChapterChangeAllowed($chapter, $validated, $settings);

        $chapter = $this->service->updateChapter($chapter, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Bab berhasil diperbarui.',
            'data' => $chapter,
        ]);
    }

    public function destroyChapter(Request $request, BookChapter $chapter): JsonResponse
    {
        $this->ensureOwner($request, $chapter->book);

        $settings = BookChapterSetting::current();

        abort_if(
            $chapter->book->chapters()->count() <= $settings->min_chapters,
            422,
            "Jumlah bab tidak boleh kurang dari {$settings->min_chapters}."
        );

        $this->service->assertChapterDeletable($chapter);

        // Sisa biaya 1 buku setelah bab dihapus tidak boleh di bawah minimal.
        $this->costGuard->assertChapterDeleteAllowed($chapter, $settings);

        $this->service->deleteChapter($chapter);

        return response()->json([
            'success' => true,
            'message' => 'Bab berhasil dihapus.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function ensureEligible($user): void
    {
        $allowed = $user->roles()->where('name', 'editor')->exists();

        abort_unless($allowed, 403, 'Hanya Editor yang dapat mengakses ini.');
    }

    private function ensureOwner(Request $request, Book $book): void
    {
        $this->ensureEligible($request->user());

        abort_unless(
            $book->is_editor_created && $book->created_by === $request->user()->id,
            403,
            'Anda tidak berwenang mengelola proyek Book Chapter ini.'
        );
    }
}
