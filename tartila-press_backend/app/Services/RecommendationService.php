<?php

namespace App\Services;

use App\Models\Article;
use App\Models\Book;
use App\Models\CustomPackageItem;
use App\Models\EditorProfile;
use App\Models\Event;
use App\Models\Package;
use App\Models\PublicProfile;
use App\Models\Recommendation;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Rekomendasi: konten yang di-pin admin (maksimal 3 per menu) tampil paling atas di menunya
 * dan di beranda. Daftar publik memanggil pinFirst() untuk mengurutkan konten yang di-pin ke
 * atas, dan markRecommended() untuk menandainya (lencana "Rekomendasi").
 *
 * Bagian "editor" tidak memakai tabel ini: editor sudah dipromosikan lewat Kelola Editor
 * (EditorInsightService), supaya hanya ada satu sumber kebenaran.
 */
class RecommendationService
{
    public const LIMIT = 3;

    /** Bagian yang dikelola lewat tabel rekomendasi (kunci = nama di URL/API). */
    public const SECTIONS = ['service', 'package', 'book_chapter', 'book', 'author', 'event', 'article'];

    /** Bagian yang dikelola di tempat lain. */
    public const EXTERNAL = ['editor'];

    /** @var array<string, list<int>> */
    private array $pinned = [];

    public function label(string $section): string
    {
        return [
            'service' => 'Layanan',
            'package' => 'Paket',
            'book_chapter' => 'Book Chapter',
            'book' => 'Katalog Buku',
            'author' => 'Penulis',
            'editor' => 'Editor',
            'event' => 'Event',
            'article' => 'Artikel',
        ][$section] ?? $section;
    }

    /** @return list<int> id konten yang di-pin, urut dari posisi 1. */
    public function pinnedIds(string $section): array
    {
        return $this->pinned[$section] ??= Recommendation::where('section', $section)
            ->orderBy('position')
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Urutan daftar publik: konten yang di-pin (posisi 1, 2, 3) paling atas, lalu urutan
     * biasa dari pemanggil. Dipanggil tepat sebelum paginate()/get().
     *
     * @param  EloquentBuilder<*>|QueryBuilder  $query
     */
    public function pinFirst(EloquentBuilder|QueryBuilder $query, string $section, string $column): void
    {
        $ids = $this->pinnedIds($section);

        if ($ids === []) {
            return;
        }

        $cases = collect($ids)->values()->map(fn (int $id, int $index) => "WHEN {$id} THEN {$index}")->implode(' ');
        $base = $query instanceof EloquentBuilder ? $query->getQuery() : $query;

        $base->orders = [['type' => 'Raw', 'sql' => "CASE {$column} {$cases} ELSE ".count($ids).' END'], ...($base->orders ?? [])];
    }

    /**
     * Menandai item dengan `is_recommended`.
     *
     * @param  iterable<int, Model>  $items
     */
    public function markRecommended(iterable $items, string $section, string $idAttribute = 'id'): void
    {
        $ids = $this->pinnedIds($section);

        foreach ($items as $item) {
            $item->setAttribute('is_recommended', in_array((int) $item->{$idAttribute}, $ids, true));
        }
    }

    // ------------------------------------------------------------------ admin

    /** @return list<array<string, mixed>> konten yang di-pin saat ini (urut posisi) untuk halaman admin. */
    public function pinnedItems(string $section): array
    {
        if ($section === 'editor') {
            return $this->promotedEditors();
        }

        $ids = $this->pinnedIds($section);

        if ($ids === []) {
            return [];
        }

        $found = $this->query($section, onlyEligible: false)->get()->filter(
            fn ($model) => in_array((int) $this->idOf($section, $model), $ids, true)
        )->keyBy(fn ($model) => (int) $this->idOf($section, $model));

        return collect($ids)
            ->map(fn (int $id, int $index) => isset($found[$id])
                ? $this->present($section, $found[$id]) + ['position' => $index + 1, 'visible' => $this->eligible($section, $found[$id])]
                : ['id' => $id, 'title' => 'Konten tidak ditemukan', 'subtitle' => null, 'image' => null, 'position' => $index + 1, 'visible' => false])
            ->values()
            ->all();
    }

    /** @return list<array<string, mixed>> pilihan konten yang boleh di-pin (yang tampil publik). */
    public function options(string $section, ?string $search = null): array
    {
        abort_unless(in_array($section, self::SECTIONS, true), 404, 'Bagian tidak dikenal.');

        return $this->query($section, onlyEligible: true)
            ->get()
            ->map(fn ($model) => $this->present($section, $model))
            ->when($search !== null && trim($search) !== '', fn ($items) => $items->filter(
                fn (array $item) => str_contains(mb_strtolower($item['title'].' '.($item['subtitle'] ?? '')), mb_strtolower(trim($search)))
            ))
            ->sortBy(fn (array $item) => mb_strtolower($item['title']))
            ->take(40)
            ->values()
            ->all();
    }

    /**
     * Mengganti seluruh pin sebuah menu (urutan = posisi 1..3).
     *
     * @param  list<int|string>  $itemIds
     */
    public function replace(string $section, array $itemIds): void
    {
        abort_unless(in_array($section, self::SECTIONS, true), 404, 'Bagian tidak dikenal.');

        $ids = collect($itemIds)->map(fn ($id) => (int) $id)->unique()->values();

        if ($ids->count() > self::LIMIT) {
            throw ValidationException::withMessages(['item_ids' => 'Maksimal '.self::LIMIT.' konten rekomendasi per menu.']);
        }

        $valid = $this->query($section, onlyEligible: true)->get()
            ->map(fn ($model) => (int) $this->idOf($section, $model))->all();

        foreach ($ids as $id) {
            if (! in_array($id, $valid, true)) {
                throw ValidationException::withMessages(['item_ids' => 'Konten #'.$id.' tidak ditemukan atau belum tampil di publik.']);
            }
        }

        DB::transaction(function () use ($section, $ids) {
            Recommendation::where('section', $section)->delete();

            foreach ($ids as $index => $id) {
                Recommendation::create(['section' => $section, 'item_id' => $id, 'position' => $index + 1]);
            }
        });

        unset($this->pinned[$section]);
    }

    // ------------------------------------------------------------------ dasar

    /** @return EloquentBuilder<*> */
    private function query(string $section, bool $onlyEligible): EloquentBuilder
    {
        $query = match ($section) {
            'service' => CustomPackageItem::query(),
            'package' => Package::query(),
            'book_chapter' => Book::query()->where('is_chapter_offering', true),
            'book' => Book::query()->where('is_chapter_offering', false),
            'author' => PublicProfile::query()->with('user.roles')
                ->whereHas('user.roles', fn ($roles) => $roles->where('name', 'penulis')),
            'event' => Event::query(),
            'article' => Article::query(),
        };

        return $onlyEligible ? $this->scopeEligible($section, $query) : $query;
    }

    /** Hanya konten yang tampil di publik yang boleh di-pin. */
    private function scopeEligible(string $section, EloquentBuilder $query): EloquentBuilder
    {
        return match ($section) {
            'service', 'package', 'book', 'event' => $query->where('is_active', true),
            'book_chapter' => $query->where('is_active', true)
                ->whereHas('chapters', fn ($chapters) => $chapters->whereNull('manuscript_id')->whereNull('order_id'))
                ->where(fn ($open) => $open->whereNull('submission_deadline')->orWhere('submission_deadline', '>=', now())),
            'author' => $query->where('is_published', true),
            'article' => $query->where('status', 'approved'),
        };
    }

    private function eligible(string $section, mixed $model): bool
    {
        return $this->scopeEligible($section, $this->query($section, onlyEligible: false))
            ->whereKey($model->getKey())
            ->exists();
    }

    /** Id yang dipakai di daftar publik (penulis = id user, selain itu id baris). */
    private function idOf(string $section, mixed $model): int
    {
        return (int) ($section === 'author' ? $model->user_id : $model->getKey());
    }

    /** @return array{id: int, title: string, subtitle: ?string, image: ?string} */
    private function present(string $section, mixed $model): array
    {
        $id = $this->idOf($section, $model);

        return match ($section) {
            'service' => ['id' => $id, 'title' => $model->name, 'subtitle' => $model->type === 'facility' ? 'Fasilitas' : 'Layanan', 'image' => null],
            'package' => ['id' => $id, 'title' => $model->name, 'subtitle' => $model->category, 'image' => $model->photo],
            'book_chapter', 'book' => ['id' => $id, 'title' => $model->title, 'subtitle' => $model->authors_text, 'image' => is_string($model->front_cover) ? $model->front_cover : null],
            'author' => ['id' => $id, 'title' => $model->pen_name ?: $model->user->name, 'subtitle' => null, 'image' => $model->profile_photo],
            'event' => ['id' => $id, 'title' => $model->title, 'subtitle' => $model->starts_at?->format('d M Y'), 'image' => $model->banner],
            'article' => ['id' => $id, 'title' => $model->title, 'subtitle' => $model->published_at?->format('d M Y'), 'image' => $model->photo],
        };
    }

    /** @return list<array<string, mixed>> editor yang dipromosikan (hanya baca; dikelola di Kelola Editor). */
    private function promotedEditors(): array
    {
        $ids = app(EditorInsightService::class)->promotedTop();

        if ($ids === []) {
            return [];
        }

        $profiles = PublicProfile::with('user')->whereIn('user_id', $ids)->get()->keyBy('user_id');
        $names = EditorProfile::whereIn('user_id', $ids)->with('user:id,name')->get()->keyBy('user_id');

        return collect($ids)->values()->map(function ($id, $index) use ($profiles, $names) {
            $profile = $profiles->get($id);

            return [
                'id' => (int) $id,
                'title' => $profile?->pen_name ?: ($profile?->user->name ?? $names->get($id)?->user?->name ?? 'Editor #'.$id),
                'subtitle' => null,
                'image' => $profile?->profile_photo,
                'position' => $index + 1,
                'visible' => (bool) $profile?->is_published,
            ];
        })->all();
    }
}
