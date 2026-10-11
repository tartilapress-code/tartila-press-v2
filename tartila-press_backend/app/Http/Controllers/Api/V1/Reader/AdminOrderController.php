<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Reader\ReaderOrder;
use App\Services\Reader\ReaderOrderService;
use App\Services\Reader\ReaderRoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/** Admin Tartila Book: verifikasi pembayaran dan laporan royalti. */
class AdminOrderController extends Controller
{
    public function __construct(
        private readonly ReaderOrderService $orders,
        private readonly ReaderRoyaltyService $royalty,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $page = ReaderOrder::with(['user:id,name,email', 'paymentMethod'])
            ->when(in_array($request->query('status'), ['pending', 'confirmed', 'cancelled'], true), fn ($q) => $q->where('status', $request->query('status')))
            ->when(in_array($request->query('kind'), ['book', 'plan'], true), fn ($q) => $q->where('kind', $request->query('kind')))
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        $counts = ReaderOrder::selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return $this->pageResponse($page, 'Daftar pesanan berhasil diambil.', null, ['counts' => $counts]);
    }

    public function proof(ReaderOrder $order): Response
    {
        abort_unless($order->payment_proof_file && Storage::disk('local')->exists($order->payment_proof_file), 404, 'Bukti transfer belum diunggah.');

        return response()->file(Storage::disk('local')->path($order->payment_proof_file), ['Cache-Control' => 'private, no-store']);
    }

    public function verify(Request $request, ReaderOrder $order): JsonResponse
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'reject'])],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        abort_unless($order->status === 'pending', 422, 'Pesanan ini sudah diverifikasi.');
        abort_unless($order->payment_proof_file, 422, 'Pesanan ini belum mengunggah bukti transfer.');

        $order = $validated['decision'] === 'approve'
            ? $this->orders->approve($order, $validated['note'] ?? null)
            : $this->orders->reject($order, $validated['note'] ?? null);

        return response()->json([
            'success' => true,
            'message' => $validated['decision'] === 'approve' ? 'Pembayaran dikonfirmasi; pembaca sudah bisa membaca.' : 'Bukti transfer ditolak; pesanan dibatalkan.',
            'data' => $order->load(['user:id,name,email', 'paymentMethod']),
        ]);
    }

    /** Laporan royalti per buku: pembelian (persentase) + bacaan (jumlah × biaya). */
    public function royalties(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $from = $validated['from'] ?? now('Asia/Jakarta')->startOfMonth()->toDateString();
        $to = $validated['to'] ?? now('Asia/Jakarta')->toDateString();
        $rows = $this->royalty->report($from, $to, $validated['search'] ?? null);
        $page = $this->paginateCollection($rows, $request, 20);

        return $this->pageResponse($page, 'Laporan royalti berhasil dihitung.', null, [
            'from' => $from,
            'to' => $to,
            'totals' => [
                'revenue' => round($rows->sum('revenue'), 2),
                'purchase_royalty' => round($rows->sum('purchase_royalty'), 2),
                'read_events' => $rows->sum('read_events'),
                'read_royalty' => round($rows->sum('read_royalty'), 2),
                'total' => round($rows->sum('total'), 2),
            ],
        ]);
    }
}
