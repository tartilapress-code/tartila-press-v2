<?php

namespace App\Http\Controllers\Api\V1\Reader;

use App\Http\Controllers\Controller;
use App\Models\Reader\ReaderAccessRule;
use App\Models\Reader\ReaderBook;
use App\Models\Reader\ReaderPlan;
use App\Models\Reader\ReaderSetting;
use App\Models\Reader\ReaderTerm;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Admin Tartila Book: taksonomi, paket langganan, jadwal buka/kunci, pengaturan royalti. */
class AdminConfigController extends Controller
{
    public function __construct(private readonly Notifier $notifier) {}

    // --- Taksonomi -----------------------------------------------------------

    public function terms(): JsonResponse
    {
        return $this->ok('Daftar pilihan berhasil diambil.', ReaderTerm::orderBy('type')->orderBy('name')->get());
    }

    public function storeTerm(Request $request): JsonResponse
    {
        $validated = $this->validateTerm($request);

        abort_if(
            ReaderTerm::where('type', $validated['type'])->whereRaw('LOWER(name) = ?', [mb_strtolower($validated['name'])])->exists(),
            422,
            'Pilihan dengan nama itu sudah ada.'
        );

        return $this->ok('Pilihan ditambahkan.', ReaderTerm::create($validated), 201);
    }

    public function updateTerm(Request $request, ReaderTerm $term): JsonResponse
    {
        $validated = $this->validateTerm($request);

        abort_if($validated['type'] !== $term->type, 422, 'Jenis pilihan tidak bisa diubah.');
        abort_if(
            ReaderTerm::where('type', $term->type)->where('id', '<>', $term->id)->whereRaw('LOWER(name) = ?', [mb_strtolower($validated['name'])])->exists(),
            422,
            'Pilihan dengan nama itu sudah ada.'
        );

        $term->update($validated);

        return $this->ok('Pilihan diperbarui.', $term);
    }

    public function destroyTerm(ReaderTerm $term): JsonResponse
    {
        $term->delete(); // buku yang memakainya jadi tanpa pilihan (nullOnDelete)

        return $this->ok('Pilihan dihapus.');
    }

    // --- Paket langganan ------------------------------------------------------

    public function plans(): JsonResponse
    {
        return $this->ok('Paket langganan berhasil diambil.', ReaderPlan::orderBy('price')->get());
    }

    public function storePlan(Request $request): JsonResponse
    {
        return $this->ok('Paket langganan ditambahkan.', ReaderPlan::create($this->validatePlan($request)), 201);
    }

    public function updatePlan(Request $request, ReaderPlan $plan): JsonResponse
    {
        $plan->update($this->validatePlan($request));

        return $this->ok('Paket langganan diperbarui.', $plan);
    }

    public function destroyPlan(ReaderPlan $plan): JsonResponse
    {
        // Riwayat pesanan/hak baca tetap ada (paket dinonaktifkan agar tidak dijual lagi).
        $plan->update(['is_active' => false]);

        return $this->ok('Paket langganan dinonaktifkan.', $plan);
    }

    // --- Jadwal buka / kunci ----------------------------------------------------

    public function rules(): JsonResponse
    {
        return $this->ok('Jadwal akses berhasil diambil.', ReaderAccessRule::with('readerBook.book:id,title')->orderByDesc('starts_at')->limit(200)->get()->map(fn (ReaderAccessRule $rule) => [
            'id' => $rule->id,
            'reader_book_id' => $rule->reader_book_id,
            'title' => $rule->reader_book_id ? $rule->readerBook?->book?->title : null,
            'action' => $rule->action,
            'starts_at' => $rule->starts_at->toIso8601String(),
            'ends_at' => $rule->ends_at?->toIso8601String(),
            'note' => $rule->note,
            'active' => $rule->starts_at->lte(now()) && ($rule->ends_at === null || $rule->ends_at->gt(now())),
        ])->values());
    }

    public function storeRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reader_book_id' => ['nullable', 'integer', Rule::exists('reader_books', 'id')],
            'action' => ['required', Rule::in(array_keys(ReaderAccessRule::ACTIONS))],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $rule = ReaderAccessRule::create($validated);

        // Buku dibuka gratis: beri tahu yang sudah menyimpannya.
        if ($rule->action === 'open' && $rule->reader_book_id && $rule->starts_at->lte(now()->addMinute())) {
            $readerBook = ReaderBook::with('book:id,title')->find($rule->reader_book_id);
            $until = $rule->ends_at ? ' sampai '.$rule->ends_at->timezone('Asia/Jakarta')->format('d-m-Y H.i').' WIB' : '';

            $this->notifier->guard(fn () => $this->notifier->notify(
                User::whereIn('id', DB::table('reader_saves')->where('reader_book_id', $readerBook->id)->pluck('user_id'))->get(),
                'reader',
                'Buku tersimpan bisa dibaca gratis',
                $readerBook->book->title.' dibuka untuk dibaca gratis'.$until.'.',
                "/buku/{$readerBook->id}",
                ['subject_type' => 'reader_book', 'subject_id' => $readerBook->id]
            ));
        }

        return $this->ok('Jadwal disimpan.', $rule, 201);
    }

    public function destroyRule(ReaderAccessRule $rule): JsonResponse
    {
        $rule->delete();

        return $this->ok('Jadwal dihapus.');
    }

    // --- Pengaturan royalti ------------------------------------------------------

    public function settings(): JsonResponse
    {
        return $this->ok('Pengaturan berhasil diambil.', ReaderSetting::current());
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'purchase_royalty_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'read_fee' => ['required', 'numeric', 'min:0', 'max:1000000'],
        ]);

        $setting = ReaderSetting::current();
        $setting->update($validated);

        return $this->ok('Pengaturan royalti disimpan.', $setting);
    }

    // =========================================================================

    /** @return array<string, mixed> */
    private function validateTerm(Request $request): array
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(array_keys(ReaderTerm::TYPES))],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'pustaka' => ['nullable', Rule::in(array_keys(ReaderBook::PUSTAKA))],
        ]);

        $validated['name'] = trim($validated['name']);
        // Hanya kategori buku yang dibatasi per jenis pustaka.
        $validated['pustaka'] = $validated['type'] === 'category' ? ($validated['pustaka'] ?? null) : null;

        return $validated;
    }

    /** @return array<string, mixed> */
    private function validatePlan(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'period' => ['required', Rule::in(array_keys(ReaderPlan::PERIODS))],
            'price' => ['required', 'numeric', 'min:1', 'max:100000000'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function ok(string $message, mixed $data = null, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }
}
