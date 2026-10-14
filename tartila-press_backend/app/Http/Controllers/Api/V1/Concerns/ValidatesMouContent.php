<?php

namespace App\Http\Controllers\Api\V1\Concerns;

use App\Models\MouTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Aturan isi MOU — dipakai template utama dan penyesuaian MOU per judul. */
trait ValidatesMouContent
{
    /** @return array<string, mixed> */
    protected function mouContentRules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'opening' => ['required', 'string', 'max:5000'],
            'distribution_options' => ['required', 'array', 'min:1', 'max:20'],
            'distribution_options.*.key' => ['nullable', 'string', 'max:40', 'alpha_dash', 'distinct'],
            'distribution_options.*.name' => ['required', 'string', 'max:150'],
            'distribution_options.*.description' => ['nullable', 'string', 'max:500'],
            // Rincian hak berupa daftar poin (satu butir per baris di formulir admin).
            'distribution_options.*.points' => ['nullable', 'array', 'max:20'],
            'distribution_options.*.points.*' => ['nullable', 'string', 'max:600'],
            'distribution_mode' => ['required', Rule::in(MouTemplate::MODES)],
            'first_party_terms' => ['required', 'array', 'min:1', 'max:30'],
            'first_party_terms.*' => ['required', 'string', 'max:1500'],
            'second_party_terms' => ['required', 'array', 'min:1', 'max:30'],
            'second_party_terms.*' => ['required', 'string', 'max:1500'],
            'closing_terms' => ['required', 'array', 'min:1', 'max:30'],
            'closing_terms.*' => ['required', 'string', 'max:1500'],
            'contact_note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /** Opsi distribusi dengan kunci yang stabil (dibuat dari nama bila kosong). */
    protected function normalizeOptions(array $options): array
    {
        $used = [];

        return array_values(array_map(function (array $option) use (&$used) {
            $key = filled($option['key'] ?? null) ? $option['key'] : Str::slug($option['name'], '_');
            $base = $key !== '' ? $key : 'opsi';

            for ($i = 2; in_array($key, $used, true) || $key === ''; $i++) {
                $key = $base.'_'.$i;
            }

            $used[] = $key;

            return [
                'key' => $key,
                'name' => trim($option['name']),
                'description' => trim((string) ($option['description'] ?? '')),
                'points' => $this->cleanList((array) ($option['points'] ?? [])),
            ];
        }, $options));
    }

    /** @return list<string> */
    protected function cleanList(array $items): array
    {
        return array_values(array_filter(array_map('trim', $items), fn ($item) => $item !== ''));
    }

    protected function validatedMouContent(Request $request, array $extraRules = []): array
    {
        $validated = $request->validate($this->mouContentRules() + $extraRules);

        $validated['distribution_options'] = $this->normalizeOptions($validated['distribution_options']);

        foreach (['first_party_terms', 'second_party_terms', 'closing_terms'] as $key) {
            $validated[$key] = $this->cleanList($validated[$key]);
        }

        return $validated;
    }
}
