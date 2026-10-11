<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookChapter;
use App\Models\CustomPackageItem;
use App\Models\Package;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Pengaturan diskon produk secara massal. "Diskon" di sini adalah kolom
 * discount (persen) yang sudah ada di paket, layanan, dan buku/Book Chapter -
 * halaman admin hanya memberi satu tempat untuk melihat, mengatur, dan
 * mereset semuanya. Diskon buku/proyek yang dikelola editor tidak disentuh
 * (diatur editor sendiri dari fee/royaltinya).
 */
class DiscountController extends Controller
{
    private const TYPES = ['package', 'custom_item', 'book'];

    /*
    |--------------------------------------------------------------------------
    | Index - Semua produk beserta diskonnya (aktif / tanpa diskon)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request): JsonResponse
    {
        $rows = collect()
            ->merge(Package::orderBy('name')->get()->map(fn (Package $p) => $this->row('package', $p->id, $p->name, $p->price, $p->discount, $p->is_active, false, 'Paket')))
            ->merge(CustomPackageItem::orderBy('name')->get()->map(fn (CustomPackageItem $i) => $this->row('custom_item', $i->id, $i->name, $i->price, $i->discount, $i->is_active, false, 'Layanan')))
            ->merge(Book::orderBy('title')->get()->map(fn (Book $b) => $this->row(
                'book',
                $b->id,
                $b->title,
                $b->price,
                $b->discount,
                $b->is_active,
                $this->isEditorOwned($b),
                $b->is_chapter_compilation ? 'Book Chapter' : 'Buku',
            )));

        // Dengan ?page=: per halaman + filter (?kind=, ?status=active|none,
        // ?search=) untuk tab Diskon. Tanpa ?page=: daftar ringkas lengkap,
        // dipakai pemilih target voucher.
        if ($request->has('page')) {
            $kind = (string) $request->query('kind', '');
            $status = (string) $request->query('status', '');
            $keyword = mb_strtolower(trim((string) $request->query('search', '')));

            $filtered = $rows
                ->when(in_array($kind, self::TYPES, true), fn ($c) => $c->where('type', $kind))
                ->when(in_array($status, ['active', 'none'], true), fn ($c) => $c->where('status', $status))
                ->when($keyword !== '', fn ($c) => $c->filter(fn (array $row) => str_contains(mb_strtolower($row['name']), $keyword)));

            return $this->pageResponse(
                $this->paginateCollection($filtered->values(), $request, 50),
                'Daftar diskon produk berhasil diambil.',
                meta: ['active_count' => $rows->where('status', 'active')->count()]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Daftar diskon produk berhasil diambil.',
            'data' => $rows->values(),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Apply - Atur diskon (%) untuk produk terpilih
    |--------------------------------------------------------------------------
    */

    public function apply(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*.type' => ['required', Rule::in(self::TYPES)],
            'items.*.id' => ['required', 'integer'],
            'percent' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $result = $this->update($validated['items'], (int) $validated['percent']);

        return response()->json([
            'success' => true,
            'message' => "Diskon {$validated['percent']}% diterapkan ke {$result['updated']} produk."
                .($result['skipped'] > 0 ? " {$result['skipped']} produk editor dilewati." : ''),
            'data' => $result,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Reset - Hapus diskon produk terpilih atau semua (kecuali yang dikelola editor)
    |--------------------------------------------------------------------------
    */

    public function reset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'all' => ['nullable', 'boolean'],
            'items' => ['required_without:all', 'array', 'max:500'],
            'items.*.type' => ['required', Rule::in(self::TYPES)],
            'items.*.id' => ['required', 'integer'],
        ]);

        if (! empty($validated['all'])) {
            $items = collect()
                ->merge(Package::where('discount', '>', 0)->pluck('id')->map(fn ($id) => ['type' => 'package', 'id' => $id]))
                ->merge(CustomPackageItem::where('discount', '>', 0)->pluck('id')->map(fn ($id) => ['type' => 'custom_item', 'id' => $id]))
                ->merge(Book::pluck('id')->map(fn ($id) => ['type' => 'book', 'id' => $id]))
                ->all();
        } else {
            $items = $validated['items'];
        }

        $result = $this->update($items, 0);

        return response()->json([
            'success' => true,
            'message' => "Diskon {$result['updated']} produk direset."
                .($result['skipped'] > 0 ? " {$result['skipped']} produk editor dilewati." : ''),
            'data' => $result,
        ]);
    }

    /**
     * @param  list<array{type: string, id: int}>  $items
     * @return array{updated: int, skipped: int}
     */
    private function update(array $items, int $percent): array
    {
        $updated = 0;
        $skipped = 0;

        DB::transaction(function () use ($items, $percent, &$updated, &$skipped) {
            foreach ($items as $item) {
                $id = (int) $item['id'];

                if ($item['type'] === 'package') {
                    $updated += Package::whereKey($id)->update(['discount' => $percent]);
                } elseif ($item['type'] === 'custom_item') {
                    $updated += CustomPackageItem::whereKey($id)->update(['discount' => $percent]);
                } else {
                    $book = Book::find($id);

                    if (! $book) {
                        continue;
                    }

                    if ($this->isEditorOwned($book)) {
                        $skipped++;

                        continue;
                    }

                    $book->update(['discount' => $percent]);

                    // Diskon per bab (kalau ada) menimpa diskon buku, jadi ikut
                    // dikosongkan supaya diskon buku yang berlaku.
                    if ($book->is_chapter_compilation) {
                        BookChapter::where('book_id', $book->id)->update(['discount' => null]);
                    }

                    $updated++;
                }
            }
        });

        return ['updated' => $updated, 'skipped' => $skipped];
    }

    private function isEditorOwned(Book $book): bool
    {
        return $book->owner_editor_id !== null || (bool) $book->is_editor_created;
    }

    /**
     * @return array<string, mixed>
     */
    private function row(string $type, int $id, string $name, mixed $price, mixed $discount, bool $isActive, bool $editorOwned, string $label): array
    {
        $discount = (int) $discount;

        return [
            'type' => $type,
            'id' => $id,
            'kind_label' => $label,
            'name' => $name,
            'price' => (float) $price,
            'discount' => $discount,
            'final_price' => round((float) $price * (100 - $discount) / 100, 2),
            'is_active' => $isActive,
            'status' => $discount > 0 ? 'active' : 'none',
            'editor_owned' => $editorOwned,
        ];
    }
}
