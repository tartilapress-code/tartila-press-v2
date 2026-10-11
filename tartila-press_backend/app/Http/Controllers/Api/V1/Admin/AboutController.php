<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\About\AboutController as PublicAboutController;
use App\Http\Controllers\Controller;
use App\Models\AboutLegality;
use App\Models\AboutProfile;
use App\Models\AboutTeamMember;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Kelola halaman "Tentang Kami": isi profil, legalitas, dan Tim Kami
 * (keduanya bisa diurutkan; anggota tim bisa disembunyikan).
 */
class AboutController extends Controller
{
    public function show(): JsonResponse
    {
        return $this->respond('Data Tentang Kami berhasil diambil.');
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'vision' => ['nullable', 'string', 'max:5000'],
            'mission' => ['nullable', 'string', 'max:5000'],
            'profile' => ['nullable', 'string', 'max:10000'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            // Nomor WhatsApp internasional tanpa tanda +, mis. 6281234567890.
            'whatsapp' => ['nullable', 'string', 'regex:/^[1-9][0-9]{7,14}$/'],
            'address' => ['nullable', 'string', 'max:1000'],
            'map_query' => ['nullable', 'string', 'max:500'],
            'social_links' => ['nullable', 'array'],
            'social_links.*' => ['nullable', 'string', 'max:500', 'http_url'],
            'show_team' => ['required', 'boolean'],
        ], [
            'whatsapp.regex' => 'Nomor WhatsApp ditulis dengan kode negara tanpa tanda + atau spasi, mis. 6281234567890.',
        ]);

        $social = collect($validated['social_links'] ?? [])
            ->only(AboutProfile::SOCIAL_PLATFORMS)
            ->filter(fn ($url) => filled($url))
            ->all();

        AboutProfile::current()->update([
            ...collect($validated)->except('social_links')->all(),
            'social_links' => $social,
            'updated_by' => $request->user()->id,
        ]);

        return $this->respond('Profil Tentang Kami berhasil disimpan.');
    }

    // ---------------------------------------------------------------------
    // Legalitas
    // ---------------------------------------------------------------------

    public function storeLegality(Request $request): JsonResponse
    {
        AboutLegality::create([
            ...$request->validate($this->legalityRules()),
            'sort_order' => (int) AboutLegality::max('sort_order') + 1,
        ]);

        return $this->respond('Legalitas berhasil ditambahkan.', 201);
    }

    public function updateLegality(Request $request, AboutLegality $legality): JsonResponse
    {
        $legality->update($request->validate($this->legalityRules()));

        return $this->respond('Legalitas berhasil disimpan.');
    }

    public function destroyLegality(AboutLegality $legality): JsonResponse
    {
        $legality->delete();

        return $this->respond('Legalitas berhasil dihapus.');
    }

    public function orderLegalities(Request $request): JsonResponse
    {
        $this->reorder($request, AboutLegality::class, 'about_legalities');

        return $this->respond('Urutan legalitas berhasil disimpan.');
    }

    // ---------------------------------------------------------------------
    // Tim Kami
    // ---------------------------------------------------------------------

    public function storeMember(Request $request): JsonResponse
    {
        AboutTeamMember::create([
            ...$request->validate($this->memberRules()),
            'sort_order' => (int) AboutTeamMember::max('sort_order') + 1,
        ]);

        return $this->respond('Anggota tim berhasil ditambahkan.', 201);
    }

    public function updateMember(Request $request, AboutTeamMember $member): JsonResponse
    {
        $member->update($request->validate($this->memberRules()));

        return $this->respond('Anggota tim berhasil disimpan.');
    }

    public function destroyMember(AboutTeamMember $member): JsonResponse
    {
        $member->delete();

        return $this->respond('Anggota tim berhasil dihapus.');
    }

    public function orderMembers(Request $request): JsonResponse
    {
        $this->reorder($request, AboutTeamMember::class, 'about_team_members');

        return $this->respond('Urutan tim berhasil disimpan.');
    }

    // ---------------------------------------------------------------------

    /** @return array<string, list<mixed>> */
    private function legalityRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'string', 'max:500', 'http_url'],
        ];
    }

    /** @return array<string, list<mixed>> */
    private function memberRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'photo_url' => ['nullable', 'string', 'max:500', 'http_url'],
            'position' => ['nullable', 'string', 'max:255'],
            'expertise' => ['nullable', 'string', 'max:500'],
            'is_visible' => ['required', 'boolean'],
        ];
    }

    /**
     * Simpan urutan baru: `ids` = semua id dalam urutan yang diinginkan.
     *
     * @param  class-string<Model>  $model
     */
    private function reorder(Request $request, string $model, string $table): void
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'distinct', Rule::exists($table, 'id')],
        ]);

        abort_unless(count($validated['ids']) === $model::count(), 422, 'Urutan harus memuat semua data.');

        DB::transaction(function () use ($validated, $model) {
            foreach ($validated['ids'] as $index => $id) {
                $model::whereKey($id)->update(['sort_order' => $index + 1]);
            }
        });
    }

    private function respond(string $message, int $status = 200): JsonResponse
    {
        $profile = AboutProfile::current();

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'profile' => [
                    ...PublicAboutController::publicProfile($profile),
                    // Admin mengisi semua kolom sosial media, termasuk yang kosong.
                    'social_links' => (array) $profile->social_links,
                ],
                'platforms' => AboutProfile::SOCIAL_PLATFORMS,
                'legalities' => AboutLegality::ordered()->get(),
                'team' => AboutTeamMember::ordered()->get(),
            ],
        ], $status);
    }
}
