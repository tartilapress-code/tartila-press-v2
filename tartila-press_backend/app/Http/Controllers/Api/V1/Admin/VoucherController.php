<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Voucher;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VoucherController extends Controller
{
    public function __construct(private readonly VoucherService $service) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Semua voucher (admin, hak voucher penulis/editor, dari royalti)
    | beserta statusnya: active, scheduled, expired, exhausted, inactive, reset
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $vouchers = Voucher::with(['user', 'grant'])->latest()->get();
        $usage = $this->service->usage($vouchers->pluck('id')->all());
        $targets = $this->service->labelsMany($vouchers->pluck('targets', 'id')->all());

        return response()->json([
            'success' => true,
            'message' => 'Daftar voucher berhasil diambil.',
            'data' => $vouchers->map(fn (Voucher $voucher) => $this->service->present($voucher, $usage[$voucher->id], $targets[$voucher->id]))->values(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Voucher buatan admin (potongan ditanggung perusahaan)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $targets = $this->targets($validated['targets']);

        $code = isset($validated['code'])
            ? Voucher::normalizeCode($validated['code'])
            : $this->service->generateCode('PROMO');

        if (Voucher::where('code', $code)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Kode voucher sudah dipakai. Pilih kode lain.',
                'errors' => ['code' => ['Kode voucher sudah dipakai. Pilih kode lain.']],
            ], 422);
        }

        $voucher = Voucher::create([
            'code' => $code,
            'source' => Voucher::SOURCE_ADMIN,
            'name' => $validated['name'] ?? null,
            'targets' => $targets,
            'discount_percent' => $validated['discount_percent'],
            'fee_percent' => 0,
            'max_uses' => $validated['max_uses'] ?? null,
            'starts_at' => $validated['starts_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Voucher berhasil dibuat.',
            'data' => $this->service->present($voucher->load('user')),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Ubah voucher admin / aktifkan-matikan voucher penulis/editor
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, Voucher $voucher): JsonResponse
    {
        abort_if($voucher->reset_at, 422, 'Voucher yang sudah direset tidak bisa diubah.');

        if ($voucher->source !== Voucher::SOURCE_ADMIN) {
            $validated = $request->validate(['is_active' => ['required', 'boolean']]);
            $voucher->update($validated);
        } else {
            $rules = $this->rules($voucher);
            $validated = $request->validate(array_map(fn ($rule) => ['sometimes', ...$rule], $rules));

            if (isset($validated['targets'])) {
                $validated['targets'] = $this->targets($validated['targets']);
            }

            if (isset($validated['code'])) {
                $validated['code'] = Voucher::normalizeCode($validated['code']);
            }

            $voucher->update($validated);
        }

        return response()->json([
            'success' => true,
            'message' => 'Voucher diperbarui.',
            'data' => $this->service->present($voucher->fresh(['user', 'grant'])),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Reset - Matikan permanen voucher terpilih (atau semua). Voucher yang
    | dibuat penulis/editor dari royaltinya sendiri tidak ikut direset.
    |--------------------------------------------------------------------------
    */

    public function reset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'all' => ['nullable', 'boolean'],
            'ids' => ['required_without:all', 'array'],
            'ids.*' => ['integer'],
        ]);

        $query = Voucher::whereNull('reset_at')
            ->where('source', '!=', Voucher::SOURCE_ROYALTY);

        if (empty($validated['all'])) {
            $query->whereIn('id', $validated['ids']);
        }

        $count = $query->update(['reset_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => "{$count} voucher direset.",
            'data' => ['reset' => $count],
        ]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(?Voucher $voucher = null): array
    {
        return [
            'name' => ['nullable', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{4,20}$/', Rule::unique('vouchers', 'code')->ignore($voucher?->id)],
            'targets' => ['required', 'array', 'min:1', 'max:200'],
            'targets.*.type' => ['required', Rule::in(VoucherService::TARGET_TYPES)],
            'targets.*.id' => ['nullable', 'integer'],
            'discount_percent' => ['required', 'numeric', 'gt:0', 'max:100'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param  list<array{type: string, id?: int|null}>  $input
     * @return list<array{type: string, id: int|null}>
     */
    private function targets(array $input): array
    {
        $targets = $this->service->normalizeTargets($input);

        abort_unless($this->service->targetsExist($targets), 422, 'Salah satu produk yang dipilih tidak ditemukan.');

        return $targets;
    }
}
