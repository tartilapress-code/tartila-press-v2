<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookExternalSale;
use App\Services\BookRoyaltyService;
use App\Services\Reader\ReaderRoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoyaltyController extends Controller
{
    private const EXTERNAL_SALE_RULES = [
        'marketplace_name' => ['required', 'string', 'max:255'],
        // Buku fisik / ebook: menentukan royalti yang dipakai (MOU).
        'format' => ['nullable', 'in:physical,ebook'],
        'original_price' => ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'discount_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
        'discounted_price' => ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT],
        'quantity_sold' => ['required', 'integer', 'min:0'],
    ];

    public function __construct(
        private readonly BookRoyaltyService $service,
        private readonly ReaderRoyaltyService $readerRoyalty,
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Semua buku terbit yang punya penerima royalti, beserta pembagiannya
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        // Per halaman: ?search= judul. Hanya buku yang penulisnya terhubung ke
        // akun (buku biasa dari naskah, atau Book Chapter dengan bab berisi naskah).
        $query = Book::with([...BookRoyaltyService::SHARE_RELATIONS, 'externalSales', 'orderItems.order.voucher'])
            ->where('is_active', true)
            ->where(fn ($q) => $q
                ->where(fn ($regular) => $regular->where('is_chapter_compilation', false)->whereNotNull('manuscript_id'))
                ->orWhere(fn ($compilation) => $compilation->where('is_chapter_compilation', true)
                    ->whereHas('chapters', fn ($chapter) => $chapter->whereNotNull('manuscript_id'))))
            ->latest()
            ->orderByDesc('id');

        if ($request->filled('search')) {
            $query->whereRaw('LOWER(title) LIKE ?', ['%'.mb_strtolower((string) $request->query('search')).'%']);
        }

        $page = $query->paginate($this->perPage($request, 20));
        $data = [];
        $reader = $this->readerRoyalty->forBooks($page->getCollection());

        foreach ($page->getCollection() as $book) {
            $shares = $this->service->shares($book);

            // Buku tanpa penulis yang terhubung ke akun tidak punya royalti.
            if ($shares === []) {
                continue;
            }

            $totalRate = round(array_sum(array_column($shares, 'rate')), 4);
            $totalEbookRate = round(array_sum(array_column($shares, 'ebook_rate')), 4);
            $package = $this->service->package($book);
            $mou = $this->service->bindingMou($book);

            $data[] = [
                'id' => $book->id,
                'title' => $book->title,
                'authors_text' => $book->authors_text,
                'price' => $book->price,
                'package' => $package,
                'package_label' => BookRoyaltyService::PACKAGE_LABELS[$package],
                'royalty_percentage' => $totalRate,
                'ebook_royalty_percentage' => $totalEbookRate,
                'mou' => $mou ? ['id' => $mou->id, 'number' => $mou->number] : null,
                'shares' => array_map(function (array $share) use ($book, $reader) {
                    $summary = $this->service->summarize($book, $share['rate'], $share['user_id'], $share['ebook_rate']);
                    $readerAmount = (float) (collect($reader[$book->id]['authors'] ?? [])->firstWhere('user_id', $share['user_id'])['amount'] ?? 0);

                    return $share + [
                        'royalty_amount' => round($summary['total_royalty_amount'] + $readerAmount, 2),
                        'reader_royalty_amount' => $readerAmount,
                    ];
                }, $shares),
                'reader' => isset($reader[$book->id]) ? [
                    'orders' => $reader[$book->id]['orders'],
                    'revenue' => $reader[$book->id]['revenue'],
                    'purchase_percent' => $reader[$book->id]['purchase_percent'],
                    'purchase_royalty' => $reader[$book->id]['purchase_royalty'],
                    'read_events' => $reader[$book->id]['read_events'],
                    'read_fee' => $reader[$book->id]['read_fee'],
                    'read_royalty' => $reader[$book->id]['read_royalty'],
                    'total' => $reader[$book->id]['total'],
                ] : null,
                'external_sales' => $book->externalSales->map(fn (BookExternalSale $sale) => [
                    'id' => $sale->id,
                    'marketplace_name' => $sale->marketplace_name,
                    'format' => $sale->format,
                    'original_price' => $sale->original_price,
                    'discount_percentage' => $sale->discount_percentage,
                    'discounted_price' => $sale->discounted_price,
                    'quantity_sold' => $sale->quantity_sold,
                ])->values(),
                ...$this->service->summarize($book, $totalRate, null, $totalEbookRate),
            ];

            // Sumber ketiga (ebook Tartila Book) ikut dijumlahkan ke total buku.
            $data[array_key_last($data)]['total_royalty_amount'] = round(
                $data[array_key_last($data)]['total_royalty_amount'] + (float) ($reader[$book->id]['total'] ?? 0),
                2
            );
        }

        $page->setCollection(collect($data));

        return $this->pageResponse($page, 'Daftar royalti buku berhasil diambil.');
    }

    /*
    |--------------------------------------------------------------------------
    | External Sales - Penjualan buku di luar sistem (dicatat manual admin)
    |--------------------------------------------------------------------------
    */

    public function storeExternalSale(Request $request, Book $book): JsonResponse
    {
        $validated = $request->validate(self::EXTERNAL_SALE_RULES);

        $sale = $book->externalSales()->create([...$validated, 'format' => $validated['format'] ?? 'physical']);

        return response()->json([
            'success' => true,
            'message' => 'Penjualan luar sistem berhasil dicatat.',
            'data' => $sale,
        ], 201);
    }

    public function updateExternalSale(Request $request, BookExternalSale $bookExternalSale): JsonResponse
    {
        $rules = collect(self::EXTERNAL_SALE_RULES)
            ->map(fn (array $rules) => ['sometimes', ...$rules])
            ->toArray();

        $validated = $request->validate($rules);

        if (array_key_exists('format', $validated)) {
            $validated['format'] ??= 'physical';
        }

        $bookExternalSale->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Penjualan luar sistem berhasil diperbarui.',
            'data' => $bookExternalSale,
        ]);
    }

    public function destroyExternalSale(BookExternalSale $bookExternalSale): JsonResponse
    {
        $bookExternalSale->delete();

        return response()->json([
            'success' => true,
            'message' => 'Penjualan luar sistem berhasil dihapus.',
        ]);
    }
}
