<?php

namespace App\Http\Controllers\Api\V1\Voucher;

use App\Http\Controllers\Controller;
use App\Models\Voucher;
use App\Models\VoucherGrant;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MyVoucherController extends Controller
{
    public function __construct(private readonly VoucherService $service) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Voucher Saya: hak voucher dari admin, voucher dari royalti buku
    | sendiri, dan fee yang sudah masuk
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $eligible = $this->service->hasPublishedBook($user);

        $vouchers = Voucher::with('grant')
            ->where('user_id', $user->id)
            ->whereIn('source', [Voucher::SOURCE_GRANT, Voucher::SOURCE_ROYALTY])
            ->latest()
            ->get();

        $usage = $this->service->usage($vouchers->pluck('id')->all());
        $voucherTargets = $this->service->labelsMany($vouchers->pluck('targets', 'id')->all());
        $present = fn (Voucher $voucher) => $this->service->present($voucher, $usage[$voucher->id], $voucherTargets[$voucher->id]);

        $grants = VoucherGrant::where('user_id', $user->id)->latest()->get();
        $grantTargets = $this->service->labelsMany($grants->pluck('targets', 'id')->all());

        $grants = $grants->map(function (VoucherGrant $grant) use ($vouchers, $present, $grantTargets) {
            $cycle = $grant->currentCycle();

            return [
                'id' => $grant->id,
                'name' => $grant->name,
                'targets' => $grantTargets[$grant->id],
                'pool_percent' => (float) $grant->pool_percent,
                'max_vouchers' => $grant->max_vouchers,
                'period_days' => $grant->period_days,
                'starts_at' => $grant->starts_at,
                'ends_at' => $grant->ends_at,
                'status' => $grant->status(),
                'cycle_starts_at' => $cycle === null ? null : $grant->cycleStart($cycle),
                'cycle_ends_at' => $cycle === null ? null : $grant->cycleEnd($cycle),
                'used_quota' => $grant->usedQuota($cycle),
                'vouchers' => $vouchers
                    ->where('grant_id', $grant->id)
                    ->map($present)
                    ->values(),
            ];
        })->values();

        $royaltyBooks = $this->service->royaltyBooks($user)->map(fn (array $row) => [
            'book_id' => $row['book']->id,
            'title' => $row['book']->title,
            'role' => $row['role'],
            'royalty_percentage' => $row['rate'],
            'vouchers' => $vouchers
                ->where('source', Voucher::SOURCE_ROYALTY)
                ->filter(fn (Voucher $voucher) => ($voucher->targets[0]['id'] ?? null) === $row['book']->id)
                ->map($present)
                ->values(),
        ])->values();

        $mine = $vouchers->map($present);

        return response()->json([
            'success' => true,
            'message' => 'Voucher Anda berhasil diambil.',
            'data' => [
                'eligible' => $eligible,
                'grants' => $grants,
                'royalty_books' => $eligible ? $royaltyBooks : [],
                'totals' => [
                    'fee_earned' => round($mine->sum('fee_earned'), 2),
                    'uses' => $mine->sum('uses'),
                ],
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Buat kode voucher dari hak voucher admin atau dari royalti buku
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source' => ['required', Rule::in([Voucher::SOURCE_GRANT, Voucher::SOURCE_ROYALTY])],
            'grant_id' => ['required_if:source,grant', 'nullable', 'integer'],
            'book_id' => ['required_if:source,royalty', 'nullable', 'integer'],
            'code' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{4,20}$/'],
            'discount_percent' => ['required', 'numeric', 'gt:0', 'max:100'],
            'fee_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [
            'code.regex' => 'Kode voucher hanya boleh huruf dan angka (4–20 karakter).',
        ]);

        $user = $request->user();

        abort_unless(
            $this->service->hasPublishedBook($user),
            403,
            'Voucher hanya untuk penulis/editor yang sudah memiliki naskah terbit.'
        );

        $discount = round((float) $validated['discount_percent'], 2);
        $fee = round((float) ($validated['fee_percent'] ?? 0), 2);

        if ($validated['source'] === Voucher::SOURCE_GRANT) {
            $attributes = $this->grantAttributes($user->id, (int) $validated['grant_id'], $discount, $fee);
        } else {
            abort_if($fee > 0, 422, 'Voucher dari royalti tidak punya fee.');
            $attributes = $this->royaltyAttributes($user, (int) $validated['book_id'], $discount);
        }

        $code = isset($validated['code'])
            ? Voucher::normalizeCode($validated['code'])
            : $this->service->generateCode();

        if (Voucher::where('code', $code)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Kode voucher sudah dipakai. Pilih kode lain.',
                'errors' => ['code' => ['Kode voucher sudah dipakai. Pilih kode lain.']],
            ], 422);
        }

        $voucher = Voucher::create($attributes + [
            'code' => $code,
            'user_id' => $user->id,
            'discount_percent' => $discount,
            'fee_percent' => $fee,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Voucher berhasil dibuat.',
            'data' => $this->service->present($voucher->load('grant')),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Aktifkan / matikan voucher milik sendiri
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Voucher $voucher): JsonResponse
    {
        abort_unless($voucher->user_id === $request->user()->id, 404);

        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        abort_if($voucher->reset_at, 422, 'Voucher yang sudah direset tidak bisa diubah.');

        $voucher->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'success' => true,
            'message' => 'Voucher diperbarui.',
            'data' => $this->service->present($voucher->load('grant')),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function grantAttributes(int $userId, int $grantId, float $discount, float $fee): array
    {
        $grant = VoucherGrant::where('user_id', $userId)->find($grantId);

        abort_unless($grant, 404, 'Hak voucher tidak ditemukan.');

        $cycle = $grant->currentCycle();

        abort_if($cycle === null, 422, 'Hak voucher ini tidak sedang berlaku.');

        abort_if(
            $grant->usedQuota($cycle) >= $grant->max_vouchers,
            422,
            'Kuota voucher untuk periode ini sudah habis.'
        );

        abort_if(
            $discount + $fee > (float) $grant->pool_percent + 0.0001,
            422,
            'Diskon + fee tidak boleh melebihi '.(float) $grant->pool_percent.'%.'
        );

        return [
            'source' => Voucher::SOURCE_GRANT,
            'grant_id' => $grant->id,
            'targets' => $grant->targets,
            'cycle' => $cycle,
            'starts_at' => $grant->cycleStart($cycle),
            'expires_at' => $grant->cycleEnd($cycle),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function royaltyAttributes($user, int $bookId, float $discount): array
    {
        $row = $this->service->royaltyBooks($user)->first(fn (array $row) => $row['book']->id === $bookId);

        abort_unless($row, 404, 'Buku tidak ditemukan di daftar buku terbit Anda.');

        abort_if(
            $discount > $row['rate'] + 0.0001,
            422,
            "Diskon tidak boleh melebihi royalti Anda untuk buku ini ({$row['rate']}%)."
        );

        return [
            'source' => Voucher::SOURCE_ROYALTY,
            'targets' => [['type' => 'book', 'id' => $bookId]],
        ];
    }
}
