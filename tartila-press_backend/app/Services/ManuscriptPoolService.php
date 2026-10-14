<?php

namespace App\Services;

use App\Models\FieldCategory;
use App\Models\Manuscript;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Kriteria editor untuk pool naskah.
 *
 * - Naskah pool tanpa kriteria bidang = "Umum": semua editor boleh mengambil.
 * - Naskah dengan kriteria bidang (Kategori Keilmuan) hanya untuk editor yang
 *   bidang keahliannya (diatur admin) memuat salah satu bidang itu.
 */
class ManuscriptPoolService
{
    /**
     * Bidang keahlian editor (id Kategori Keilmuan).
     *
     * @return list<int>
     */
    public function editorFieldIds(User $editor): array
    {
        $editor->loadMissing('editorProfile');

        return self::ids($editor->editorProfile?->field_category_ids);
    }

    /**
     * Kriteria bidang naskah pool (kosong = umum).
     *
     * @return list<int>
     */
    public function criteriaOf(Manuscript $manuscript): array
    {
        return self::ids($manuscript->pool_field_category_ids);
    }

    /**
     * @param  list<int>  $editorFieldIds
     */
    public function matches(Manuscript $manuscript, array $editorFieldIds): bool
    {
        $criteria = $this->criteriaOf($manuscript);

        return $criteria === [] || array_intersect($criteria, $editorFieldIds) !== [];
    }

    public function canClaim(User $editor, Manuscript $manuscript): bool
    {
        return $this->matches($manuscript, $this->editorFieldIds($editor));
    }

    /**
     * Editor yang memenuhi kriteria naskah ini.
     *
     * @return Collection<int, User>
     */
    public function eligibleEditors(Manuscript $manuscript): Collection
    {
        return User::whereHas('roles', fn ($query) => $query->where('name', 'editor'))
            ->whereDoesntHave('editorProfile', fn ($query) => $query->where('is_banned', true))
            ->with('editorProfile')
            ->get()
            ->filter(fn (User $editor) => $this->matches($manuscript, $this->editorFieldIds($editor)))
            ->values();
    }

    /**
     * Keterangan kriteria untuk ditampilkan: "Umum" atau daftar nama bidang.
     *
     * @return array{general: bool, field_categories: list<array{id: int, name: string}>}
     */
    public function describe(Manuscript $manuscript, ?Collection $fieldCategories = null): array
    {
        $criteria = $this->criteriaOf($manuscript);
        $fieldCategories ??= FieldCategory::whereIn('id', $criteria)->get(['id', 'name']);

        return [
            'general' => $criteria === [],
            'field_categories' => $fieldCategories
                ->whereIn('id', $criteria)
                ->map(fn (FieldCategory $category) => ['id' => $category->id, 'name' => $category->name])
                ->values()
                ->all(),
        ];
    }

    /**
     * Normalisasi daftar id (unik, bilangan bulat positif, urut).
     *
     * @return list<int>
     */
    public static function ids(mixed $value): array
    {
        $ids = collect(is_array($value) ? $value : [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $ids;
    }

    /**
     * Aturan validasi untuk daftar bidang.
     *
     * @return array<string, list<mixed>>
     */
    public static function fieldRules(string $key): array
    {
        return [
            $key => ['nullable', 'array', 'max:50'],
            $key.'.*' => ['integer', 'distinct', 'exists:field_categories,id'],
        ];
    }

    /**
     * Aturan validasi tingkat kesulitan.
     *
     * @return array<string, list<mixed>>
     */
    public static function difficultyRules(string $key = 'difficulty', bool $required = false): array
    {
        return [
            $key => [$required ? 'required' : 'nullable', 'string', 'in:'.implode(',', array_keys(Manuscript::DIFFICULTIES))],
        ];
    }
}
