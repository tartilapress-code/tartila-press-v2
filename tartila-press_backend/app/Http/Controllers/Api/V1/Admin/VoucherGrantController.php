<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherGrant;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VoucherGrantController extends Controller
{
    public function __construct(private readonly VoucherService $service) {}

    /*
    |--------------------------------------------------------------------------
    | Index - Hak voucher yang diberikan ke penulis/editor
    |--------------------------------------------------------------------------
    */

    public function index(): JsonResponse
    {
        $grants = VoucherGrant::with('user')->withCount('vouchers')->latest()->get();

        // Label target & kuota terpakai dihitung sekaligus untuk seluruh daftar.
        $targets = $this->service->labelsMany($grants->pluck('targets', 'id')->all());
        $quotas = Voucher::whereIn('grant_id', $grants->pluck('id'))
            ->whereNull('reset_at')
            ->selectRaw('grant_id, cycle, count(*) as total')
            ->groupBy('grant_id', 'cycle')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->grant_id.':'.$row->cycle => (int) $row->total]);

        return response()->json([
            'success' => true,
            'message' => 'Daftar hak voucher berhasil diambil.',
            'data' => $grants->map(fn (VoucherGrant $grant) => $this->present($grant, $targets[$grant->id], $quotas))->values(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Eligible users - Cari penulis/editor yang berhak (sudah punya naskah
    | terbit) untuk dipilih saat memberi hak voucher
    |--------------------------------------------------------------------------
    */

    public function eligibleUsers(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));

        $users = User::query()
            ->when($term !== '', function ($query) use ($term) {
                $like = '%'.mb_strtolower($term).'%';

                $query->where(fn ($q) => $q
                    ->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like]));
            })
            ->orderBy('name')
            ->limit(60)
            ->get()
            ->filter(fn (User $user) => $this->service->hasPublishedBook($user))
            ->take(20)
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email])
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Daftar penulis/editor berhasil diambil.',
            'data' => $users,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store / Update / Destroy
    |--------------------------------------------------------------------------
    */

    /**
     * Beri hak ke satu, beberapa, atau semua penulis/editor yang berhak
     * (all_eligible = true memakai daftar yang berhak saat ini). Satu hak
     * dibuat per penerima, jadi kuota dan periode masing-masing terpisah.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'all_eligible' => ['nullable', 'boolean'],
            'user_ids' => ['required_without:all_eligible', 'array', 'min:1', 'max:500'],
            'user_ids.*' => ['integer', Rule::exists('users', 'id')],
            ...$this->rules(),
        ]);

        if (! empty($validated['all_eligible'])) {
            $users = User::orderBy('id')->get()
                ->filter(fn (User $user) => $this->service->hasPublishedBook($user));

            abort_if($users->isEmpty(), 422, 'Belum ada penulis/editor dengan naskah terbit.');
        } else {
            $users = User::whereIn('id', array_unique($validated['user_ids']))->get();
            $rejected = $users->reject(fn (User $user) => $this->service->hasPublishedBook($user));

            abort_if(
                $rejected->isNotEmpty(),
                422,
                'Belum punya naskah terbit: '.$rejected->pluck('name')->implode(', ').'.'
            );
        }

        $targets = $this->targets($validated['targets']);

        $grants = DB::transaction(fn () => $users->map(fn (User $user) => VoucherGrant::create([
            'user_id' => $user->id,
            'name' => $validated['name'] ?? null,
            'targets' => $targets,
            'pool_percent' => $validated['pool_percent'],
            'max_vouchers' => $validated['max_vouchers'],
            'period_days' => $validated['period_days'],
            'starts_at' => $validated['starts_at'] ?? now(),
            'ends_at' => $validated['ends_at'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()->id,
        ]))->values());

        $grants->each(fn (VoucherGrant $grant) => $grant->load('user')->loadCount('vouchers'));

        return response()->json([
            'success' => true,
            'message' => "Hak voucher diberikan ke {$grants->count()} penulis/editor.",
            'data' => $grants->map(fn (VoucherGrant $grant) => $this->present($grant))->values(),
        ], 201);
    }

    public function update(Request $request, VoucherGrant $voucherGrant): JsonResponse
    {
        $validated = $request->validate(array_map(fn ($rule) => ['sometimes', ...$rule], $this->rules()));

        if (isset($validated['targets'])) {
            $validated['targets'] = $this->targets($validated['targets']);
        }

        $voucherGrant->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Hak voucher diperbarui.',
            'data' => $this->present($voucherGrant->fresh()->load('user')->loadCount('vouchers')),
        ]);
    }

    public function destroy(VoucherGrant $voucherGrant): JsonResponse
    {
        // Hak yang sudah pernah dipakai membuat voucher hanya dinonaktifkan,
        // supaya riwayat voucher + fee tetap utuh.
        if ($voucherGrant->vouchers()->exists()) {
            $voucherGrant->update(['is_active' => false]);

            return response()->json([
                'success' => true,
                'message' => 'Hak voucher dinonaktifkan (sudah punya voucher).',
            ]);
        }

        $voucherGrant->delete();

        return response()->json([
            'success' => true,
            'message' => 'Hak voucher dihapus.',
        ]);
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:120'],
            'targets' => ['required', 'array', 'min:1', 'max:200'],
            'targets.*.type' => ['required', Rule::in(VoucherService::TARGET_TYPES)],
            'targets.*.id' => ['nullable', 'integer'],
            'pool_percent' => ['required', 'numeric', 'gt:0', 'max:100'],
            'max_vouchers' => ['required', 'integer', 'min:1', 'max:1000'],
            'period_days' => ['required', 'integer', 'min:1', 'max:3650'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
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

    /**
     * @return array<string, mixed>
     */
    private function present(VoucherGrant $grant, ?array $targets = null, ?Collection $quotas = null): array
    {
        $cycle = $grant->currentCycle();

        return [
            'id' => $grant->id,
            'user_id' => $grant->user_id,
            'user_name' => $grant->user?->name,
            'user_email' => $grant->user?->email,
            'name' => $grant->name,
            'targets' => $targets ?? $this->service->labels($grant->targets),
            'pool_percent' => (float) $grant->pool_percent,
            'max_vouchers' => $grant->max_vouchers,
            'period_days' => $grant->period_days,
            'starts_at' => $grant->starts_at,
            'ends_at' => $grant->ends_at,
            'is_active' => $grant->is_active,
            'status' => $grant->status(),
            'cycle_ends_at' => $cycle === null ? null : $grant->cycleEnd($cycle),
            'used_quota' => $quotas === null
                ? $grant->usedQuota($cycle)
                : ($cycle === null ? 0 : $quotas->get($grant->id.':'.$cycle, 0)),
            'vouchers_count' => $grant->vouchers_count ?? $grant->vouchers()->count(),
        ];
    }
}
