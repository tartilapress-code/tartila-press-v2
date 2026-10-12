<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Event;
use App\Models\FinanceDetail;
use App\Models\FinanceSetting;
use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\WalletWithdrawal;
use App\Services\FinanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Halaman Keuangan admin. */
class FinanceController extends Controller
{
    public function __construct(private readonly FinanceService $finance) {}

    /** Saldo rekening, total, ringkasan bulan berjalan, grafik omzet. */
    public function summary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ]);

        $now = now(FinanceService::TIMEZONE);
        $year = (int) ($validated['year'] ?? $now->year);
        $month = (int) ($validated['month'] ?? $now->month);
        $start = $now->copy()->setDate($year, $month, 1)->startOfDay();

        return response()->json([
            'success' => true,
            'message' => 'Ringkasan keuangan berhasil diambil.',
            'data' => [
                'balances' => $this->finance->balances(),
                'month_totals' => $this->finance->totals($this->finance->ledger([
                    'from' => $start->toDateString(),
                    'to' => $start->copy()->endOfMonth()->toDateString(),
                ])),
                'all_totals' => $this->finance->totals($this->finance->ledger()),
                'revenue' => $this->finance->revenueSeries($year, $month),
                'year' => $year,
                'month' => $month,
            ],
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'direction' => ['nullable', Rule::in(['in', 'out'])],
            'type' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', Rule::in(['completed', 'hold'])],
            'account' => ['nullable', 'string', 'max:20'],
        ]);

        $entries = $this->finance->ledger($filters);

        return response()->json([
            'success' => true,
            'message' => 'Transaksi berhasil diambil.',
            'data' => [
                'items' => $entries->map(fn (array $entry) => ['date' => $entry['date']->toIso8601String()] + $entry)->values(),
                'totals' => $this->finance->totals($entries),
                'types' => FinanceService::typeLabels(),
                'manual_categories' => FinanceTransaction::CATEGORIES,
                'accounts' => $this->accounts(),
            ],
        ]);
    }

    public function storeTransaction(Request $request): JsonResponse
    {
        $transaction = FinanceTransaction::create($this->validateTransaction($request) + ['created_by' => $request->user()->id]);

        return response()->json([
            'success' => true,
            'message' => 'Transaksi dicatat.',
            'data' => $transaction,
        ], 201);
    }

    public function updateTransaction(Request $request, FinanceTransaction $transaction): JsonResponse
    {
        $transaction->update($this->validateTransaction($request));

        return response()->json([
            'success' => true,
            'message' => 'Transaksi diperbarui.',
            'data' => $transaction->fresh(),
        ]);
    }

    public function destroyTransaction(FinanceTransaction $transaction): JsonResponse
    {
        $transaction->delete();

        return response()->json(['success' => true, 'message' => 'Transaksi dihapus.']);
    }

    /** Rekening penerima pesanan / sumber penarikan. */
    public function assignAccount(Request $request, string $source, int $id): JsonResponse
    {
        $validated = $request->validate([
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')],
        ]);

        $model = match ($source) {
            'order' => Order::whereIn('status', FinanceService::PAID_STATUSES)->findOrFail($id),
            'withdrawal' => WalletWithdrawal::where('status', 'paid')->findOrFail($id),
            default => abort(404),
        };

        $model->update(['payment_method_id' => $validated['payment_method_id'] ?? null]);

        return response()->json(['success' => true, 'message' => 'Rekening transaksi diperbarui.']);
    }

    public function packages(Request $request): JsonResponse
    {
        $range = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return $this->rows('Rincian paket berhasil diambil.', [
            'packages' => $this->finance->packageRows($range['from'] ?? null, $range['to'] ?? null),
            'book_chapters' => $this->finance->bookChapterRows(),
        ]);
    }

    public function books(Request $request): JsonResponse
    {
        $range = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return $this->rows('Rincian buku berhasil diambil.', $this->finance->bookRows($range['from'] ?? null, $range['to'] ?? null));
    }

    public function ebooks(Request $request): JsonResponse
    {
        $range = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return $this->rows('Rincian Tartila Book berhasil diambil.', $this->finance->ebookRows($range['from'] ?? null, $range['to'] ?? null));
    }

    public function events(): JsonResponse
    {
        return $this->rows('Rincian event berhasil diambil.', $this->finance->eventRows());
    }

    /** Isian admin untuk satu baris rincian (kosong = kembali otomatis). */
    public function updateDetail(Request $request): JsonResponse
    {
        $money = ['nullable', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT];
        $validated = $request->validate([
            'subject_type' => ['required', Rule::in(FinanceDetail::SUBJECTS)],
            'subject_id' => ['required', 'integer', 'min:1'],
            'book_price' => $money,
            'extra_copies' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'includes_hki' => ['nullable', 'boolean'],
            'admin_cover_cost' => $money,
            'speaker_fee' => $money,
            'other_costs' => $money,
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $exists = match ($validated['subject_type']) {
            'order' => Order::whereKey($validated['subject_id'])->exists(),
            'book' => Book::whereKey($validated['subject_id'])->exists(),
            'event' => Event::whereKey($validated['subject_id'])->exists(),
        };
        abort_unless($exists, 404, 'Data tidak ditemukan.');

        $fields = ['book_price', 'extra_copies', 'includes_hki', 'admin_cover_cost', 'speaker_fee', 'other_costs', 'note'];
        $values = array_intersect_key($validated, array_flip($fields));

        $detail = FinanceDetail::updateOrCreate(
            ['subject_type' => $validated['subject_type'], 'subject_id' => $validated['subject_id']],
            $values
        );

        return response()->json(['success' => true, 'message' => 'Rincian disimpan.', 'data' => $detail]);
    }

    public function settings(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pengaturan keuangan berhasil diambil.',
            'data' => $this->settingsPayload(),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $money = ['required', 'numeric', 'min:0', 'max:'.self::MAX_MONEY_AMOUNT];
        $validated = $request->validate([
            'admin_cover_cost' => $money,
            'print_cost_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'base_print_copies' => ['required', 'integer', 'min:0', 'max:1000'],
            'default_book_price' => $money,
            'hki_cost' => $money,
        ]);

        FinanceSetting::current()->update($validated + ['updated_by' => $request->user()->id]);

        return response()->json(['success' => true, 'message' => 'Pengaturan keuangan disimpan.', 'data' => $this->settingsPayload()]);
    }

    /** Saldo awal rekening (sebelum transaksi di sistem). */
    public function updateOpeningBalance(Request $request, PaymentMethod $paymentMethod): JsonResponse
    {
        $validated = $request->validate([
            'opening_balance' => ['required', 'numeric', 'min:-'.self::MAX_MONEY_AMOUNT, 'max:'.self::MAX_MONEY_AMOUNT],
        ]);

        $paymentMethod->update($validated);

        return response()->json(['success' => true, 'message' => 'Saldo awal rekening disimpan.']);
    }

    private function validateTransaction(Request $request): array
    {
        return $request->validate([
            'transaction_date' => ['required', 'date'],
            'direction' => ['required', Rule::in(['in', 'out'])],
            'category' => ['required', Rule::in(array_keys(FinanceTransaction::CATEGORIES))],
            'payment_method_id' => ['nullable', 'integer', Rule::exists('payment_methods', 'id')],
            'amount' => ['required', 'numeric', 'min:1', 'max:'.self::MAX_MONEY_AMOUNT],
            'status' => ['required', Rule::in(['completed', 'hold'])],
            'description' => ['required', 'string', 'max:500'],
        ]);
    }

    /** @return list<array{id: int, name: string, is_active: bool}> */
    private function accounts(): array
    {
        return PaymentMethod::orderBy('id')->get()
            ->map(fn (PaymentMethod $method) => [
                'id' => $method->id,
                'name' => $method->bank_name.' · '.$method->account_number,
                'is_active' => (bool) $method->is_active,
            ])->all();
    }

    private function settingsPayload(): array
    {
        $settings = FinanceSetting::current();

        return [
            'admin_cover_cost' => $settings->admin_cover_cost,
            'print_cost_percent' => $settings->print_cost_percent,
            'base_print_copies' => $settings->base_print_copies,
            'default_book_price' => $settings->default_book_price,
            // Biaya modal HKI (bukan biaya HKI di harga proyek Book Chapter).
            'hki_cost' => $settings->hki_cost,
        ];
    }

    private function rows(string $message, array $data): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'settings' => $this->settingsPayload(),
        ]);
    }
}
