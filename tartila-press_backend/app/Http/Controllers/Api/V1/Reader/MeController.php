<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\PaymentMethod;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderEntitlement;
use App\Models\Reader\ReaderOrder;
use App\Services\Reader\ReaderAccessService;
use App\Services\Reader\ReaderOrderService;
use App\Services\Reader\ReaderPresenter;
use App\Services\Reader\ReaderRoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** Milik pembaca: rak buku, langganan & akses, pesanan (beli/langganan), royalti penulis. */
class MeController extends Controller
{
    public function __construct(
        private readonly ReaderPresenter $presenter,
        private readonly ReaderAccessService $access,
        private readonly ReaderOrderService $orders,
        private readonly ReaderRoyaltyService $royalty,
    ) {}

    /** Rak: ?tab=reading (lanjut baca) | saved | liked | purchased. */
    public function shelf(Request $request): JsonResponse
    {
        $user = $request->user();
        $tab = (string) $request->query('tab', 'reading');

        abort_unless(in_array($tab, ['reading', 'saved', 'liked', 'purchased'], true), 422, 'Tab rak tidak dikenal.');

        $query = ReaderBook::listed()
            ->with(ReaderPresenter::RELATIONS);

        match ($tab) {
            'saved' => $query->whereIn('id', DB::table('reader_saves')->where('user_id', $user->id)->select('reader_book_id')),
            'liked' => $query->whereIn('id', DB::table('reader_likes')->where('user_id', $user->id)->select('reader_book_id')),
            'purchased' => $query->whereIn('id', ReaderEntitlement::active()->where('user_id', $user->id)->where('kind', 'book')->select('reader_book_id')),
            default => $query->whereIn('id', DB::table('reader_progress')->where('user_id', $user->id)->select('reader_book_id')),
        };

        $books = $query->get();

        if ($tab === 'reading') {
            $order = DB::table('reader_progress')->where('user_id', $user->id)->orderByDesc('last_read_at')->pluck('reader_book_id')->flip();
            $books = $books->sortBy(fn (ReaderBook $b) => $order[$b->id] ?? PHP_INT_MAX)->values();
        }

        return response()->json([
            'success' => true,
            'message' => 'Rak berhasil diambil.',
            'data' => $this->presenter->many($books, $user)->values(),
        ]);
    }

    /** Semua penanda halaman milik pembaca (dengan judul bukunya). */
    public function bookmarks(Request $request): JsonResponse
    {
        $rows = DB::table('reader_bookmarks')
            ->join('reader_books', 'reader_books.id', '=', 'reader_bookmarks.reader_book_id')
            ->join('books', 'books.id', '=', 'reader_books.book_id')
            ->where('reader_bookmarks.user_id', $request->user()->id)
            ->orderByDesc('reader_bookmarks.id')
            ->get(['reader_bookmarks.id', 'reader_bookmarks.page', 'reader_bookmarks.note', 'reader_books.id as reader_book_id', 'books.title']);

        return response()->json(['success' => true, 'message' => 'Penanda berhasil diambil.', 'data' => $rows]);
    }

    /** Langganan aktif dan buku yang dibeli. */
    public function access(Request $request): JsonResponse
    {
        $user = $request->user();
        $subscription = $this->access->activeSubscription($user);

        return response()->json([
            'success' => true,
            'message' => 'Akses berhasil diambil.',
            'data' => [
                'subscription' => $subscription ? [
                    'plan' => $subscription->plan?->name,
                    'starts_at' => $subscription->starts_at->toIso8601String(),
                    'ends_at' => $subscription->ends_at?->toIso8601String(),
                ] : null,
                'purchases' => ReaderEntitlement::active()->with('readerBook.book:id,title')
                    ->where('user_id', $user->id)->where('kind', 'book')->get()
                    ->map(fn (ReaderEntitlement $e) => [
                        'reader_book_id' => $e->reader_book_id,
                        'title' => $e->readerBook?->book?->title,
                        'ends_at' => $e->ends_at?->toIso8601String(),
                    ])->values(),
            ],
        ]);
    }

    public function orders(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pesanan berhasil diambil.',
            'data' => ReaderOrder::with('paymentMethod')
                ->where('user_id', $request->user()->id)
                ->latest('id')->limit(100)->get(),
        ]);
    }

    public function storeOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['required', Rule::in(['book', 'plan'])],
            'target_id' => ['required', 'integer'],
            'payment_method_id' => [
                PaymentMethod::where('is_active', true)->exists() ? 'required' : 'nullable',
                'integer',
                Rule::exists('payment_methods', 'id')->where('is_active', true),
            ],
        ], [
            'payment_method_id.required' => 'Pilih rekening tujuan pembayaran.',
            'payment_method_id.exists' => 'Rekening yang dipilih tidak tersedia.',
        ]);

        $order = $this->orders->create($request->user(), $validated['kind'], (int) $validated['target_id'], $validated['payment_method_id'] ?? null);

        return response()->json([
            'success' => true,
            'message' => 'Pesanan dibuat. Transfer lalu unggah bukti pembayaran dalam 1×24 jam.',
            'data' => $order,
        ], 201);
    }

    public function uploadProof(Request $request, ReaderOrder $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 403, 'Anda tidak berwenang mengakses pesanan ini.');
        abort_unless($order->status === 'pending', 422, 'Bukti transfer hanya untuk pesanan yang menunggu pembayaran.');

        if ($order->isOverdue()) {
            $this->orders->reject($order, ReaderOrder::AUTO_CANCEL_NOTE, auto: true);
            abort(422, 'Batas waktu pembayaran 1×24 jam sudah lewat, pesanan dibatalkan. Silakan buat pesanan baru.');
        }

        $request->validate(['file' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096']]);

        $old = $order->payment_proof_file;
        $path = $request->file('file')->store('reader/payment-proofs/'.$order->id, 'local');

        $order->update(['payment_proof_file' => $path, 'payment_proof_uploaded_at' => now()]);

        if ($old) {
            Storage::disk('local')->delete($old);
        }

        return response()->json([
            'success' => true,
            'message' => 'Bukti transfer diunggah. Menunggu verifikasi admin.',
            'data' => $order->fresh('paymentMethod'),
        ]);
    }

    /** Royalti baca milik penulis (bacaan + pembelian) pada rentang tanggal. */
    public function royalty(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $from = $validated['from'] ?? now('Asia/Jakarta')->startOfMonth()->toDateString();
        $to = $validated['to'] ?? now('Asia/Jakarta')->toDateString();
        $user = $request->user();

        $rows = $this->royalty->reportForUser($user, $from, $to)->map(function (array $row) use ($user) {
            $mine = collect($row['authors'])->firstWhere('user_id', $user->id);

            return [
                'reader_book_id' => $row['reader_book_id'],
                'title' => $row['title'],
                'authors_count' => count($row['authors']),
                'orders' => $row['orders'],
                'read_events' => $row['read_events'],
                'purchase_royalty' => $row['purchase_royalty'],
                'read_royalty' => $row['read_royalty'],
                'total' => $row['total'],
                'my_amount' => $mine['amount'] ?? 0,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Royalti baca berhasil diambil.',
            'data' => ['from' => $from, 'to' => $to, 'rows' => $rows->values(), 'my_total' => round($rows->sum('my_amount'), 2)],
        ]);
    }
}
